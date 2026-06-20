/**
 * EnterpriseCKDSnapshotView — BeanHealth AI · Prescription Analysis Engine
 *
 * Three-column workspace:
 *   Col 1 — Patient search (MR / name) → selectable list
 *   Col 2 — Prescription history for selected patient
 *   Col 3 — Drug decomposition (7-step pipeline) + KFRE risk panel
 *
 * Resolution order:
 *   1. Combo drug table (brand → expanded ingredients with per-salt strengths)
 *   2. INDIAN_DRUG_DATABASE direct slug match
 *   3. Fuzzy prefix match
 *   4. → drug_review_queue (unknown brands surfaced within 24h)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { runPipeline, CanonicalDrug, PipelineStep } from '../utils/drugNormalizer';
import { calculateEGFR, calculateKFRE, calculateKFRE8, KFREResult } from '../utils/ckdUtils';
import { checkRenalDose, RenalDoseAlert, SEVERITY_CONFIG, highestSeverity, isEgfrStale } from '../services/renalDoseCheckerService';

const PrescriptionModalSelector = lazy(() => import('./prescriptions/PrescriptionModalSelector'));

/* ─── Types ──────────────────────────────────────────────────────────── */

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
}

interface PatientRow {
    id: string;
    name: string;
    age: number | null;
    mr_number: string | null;
    token_number: string | null;
    phone: string | null;
    gender?: string | null;
    father_husband_name?: string | null;
}

interface PrescriptionRow {
    id: string;
    created_at: string;
    medications: MedItem[];
    notes?: string | null;
    doctor?: { name: string; specialty: string } | null;
    token_number?: string | null;
}

interface MedItem {
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    timing?: string;
    instructions?: string;
}

/** A hospital-wide issued prescription row (joined with patient + doctor) for the Issued Rx browser. */
interface IssuedRxRow {
    id: string;
    created_at: string;
    medications: MedItem[];
    notes?: string | null;
    token_number?: string | null;
    doctor?: { name: string; specialty: string } | null;
    patient?: { id: string; name: string; age: number | string | null; mr_number: string | null } | null;
}

interface PatientLabSnapshot {
    creatinine?: number;
    egfr?: number;
    egfrDate?: string;
    acr?: number;
    albumin?: number;
    phosphorus?: number;
    bicarbonate?: number;
    calcium?: number;
}

interface ReviewQueueItem {
    id: string;
    brand_name: string;
    raw_names: string[] | null;
    status: string;
}

interface ReviewQueueDraft {
    generic_name: string;
    category: string;
    atc_code: string;
    cdsco_schedule: string;
}

interface CatalogueAnalysisResult {
    total: number;
    resolved: number;
    pending_review: number;
    combos_expanded: number;
    new_queue_items: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function categoryColor(cat: string | null): string {
    if (!cat) return 'bg-gray-100 text-gray-600';
    const c = cat.toUpperCase();
    if (c.includes('ANTIBIOTIC')) return 'bg-amber-50 text-amber-700 border border-amber-200';
    if (c.includes('DIURETIC')) return 'bg-blue-50 text-blue-700 border border-blue-200';
    if (c.includes('ACE') || c.includes('ARB')) return 'bg-rose-50 text-rose-700 border border-rose-200';
    if (c.includes('CCB')) return 'bg-purple-50 text-purple-700 border border-purple-200';
    if (c.includes('NSAID') || c.includes('ANALGESIC')) return 'bg-orange-50 text-orange-700 border border-orange-200';
    if (c.includes('IMMUNO')) return 'bg-pink-50 text-pink-700 border border-pink-200';
    if (c.includes('DIABETIC') || c.includes('INSULIN')) return 'bg-teal-50 text-teal-700 border border-teal-200';
    if (c.includes('STEROID')) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    if (c.includes('STATIN')) return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    if (c.includes('BETA')) return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    if (c.includes('PHOSPHATE')) return 'bg-lime-50 text-lime-700 border border-lime-200';
    if (c.includes('HAEM')) return 'bg-red-50 text-red-700 border border-red-200';
    if (c.includes('VITAMIN') || c.includes('MINERAL') || c.includes('ELECTROLYTE')) return 'bg-green-50 text-green-700 border border-green-200';
    return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
}

const KFRE_TIER_COLORS: Record<string, string> = {
    'low': 'bg-emerald-50 border-emerald-200 text-emerald-800',
    'moderate': 'bg-amber-50 border-amber-200 text-amber-800',
    'high': 'bg-orange-50 border-orange-200 text-orange-800',
    'very-high': 'bg-red-50 border-red-200 text-red-800',
};

const KFRE_TIER_LABEL: Record<string, string> = {
    'low': 'Low Risk',
    'moderate': 'Moderate Risk',
    'high': 'High Risk',
    'very-high': 'Very High Risk',
};

const CONCERN_RULES: Array<{ categories: string[]; condition: string; message: string }> = [
    { categories: ['NSAID', 'ANALGESICS'], condition: 'always', message: 'NSAIDs may worsen renal function — verify eGFR before continuing.' },
    { categories: ['ACE INHIBITOR', 'ARB'], condition: 'both', message: 'ACE inhibitor + ARB combination detected — dual RAS blockade increases hyperkalaemia risk.' },
    { categories: ['DIURETICS'], condition: 'always', message: 'Diuretic present — monitor electrolytes, especially potassium.' },
    { categories: ['IMMUNOSUPPRESSANT'], condition: 'always', message: 'Immunosuppressant detected — check trough levels and renal dosing.' },
    { categories: ['ANTIBIOTIC'], condition: 'always', message: 'Antibiotic course — confirm renal dose adjustment if eGFR < 60.' },
    { categories: ['ANTI-DIABETIC'], condition: 'always', message: 'Anti-diabetic agent — metformin/SGLT2i require eGFR monitoring.' },
    { categories: ['ANTI-DIABETIC', 'DIURETICS'], condition: 'both', message: 'SGLT2i + diuretic — volume depletion risk; monitor BP and renal function.' },
];

function deriveAnalysisConcerns(drugs: CanonicalDrug[]): string[] {
    const resolvedCategories = drugs
        .filter(d => d.review_status === 'approved' && d.category)
        .map(d => d.category!.toUpperCase());

    const renalFlagged = drugs.filter(d => d.review_status === 'approved' && d.renal_precaution).map(d => d.name);

    const concerns: string[] = [];
    const seen = new Set<string>();

    for (const rule of CONCERN_RULES) {
        if (rule.condition === 'both') {
            if (rule.categories.every(c => resolvedCategories.includes(c))) {
                if (!seen.has(rule.message)) { concerns.push(rule.message); seen.add(rule.message); }
            }
        } else {
            if (rule.categories.some(c => resolvedCategories.includes(c))) {
                if (!seen.has(rule.message)) { concerns.push(rule.message); seen.add(rule.message); }
            }
        }
    }

    if (renalFlagged.length > 0) {
        const msg = `Renal precaution: ${renalFlagged.join(', ')} — dose adjustment may be required based on eGFR.`;
        if (!seen.has(msg)) concerns.push(msg);
    }

    return concerns;
}

/* ─── Component ──────────────────────────────────────────────────────── */

interface Props {
    doctor: DoctorProfile;
    onBack: () => void;
}

const EnterpriseCKDSnapshotView: React.FC<Props> = ({ doctor }) => {
    /* Patient column */
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [patients, setPatients] = useState<PatientRow[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);

    /* Prescription column */
    const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
    const [rxLoading, setRxLoading] = useState(false);
    const [selectedRx, setSelectedRx] = useState<PrescriptionRow | null>(null);

    /* Analysis column */
    const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
    const [canonicalDrugs, setCanonicalDrugs] = useState<CanonicalDrug[]>([]);
    const [analysisRunning, setAnalysisRunning] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [concerns, setConcerns] = useState<string[]>([]);

    /* KFRE panel */
    const [labSnapshot, setLabSnapshot] = useState<PatientLabSnapshot>({});
    const [kfre, setKfre] = useState<KFREResult | null>(null);
    const [computedEGFR, setComputedEGFR] = useState<number | null>(null);
    const [showKFREPanel, setShowKFREPanel] = useState(false);

    /* Full prescription modal */
    const [showRxModal, setShowRxModal] = useState(false);

    /* Issued prescriptions browser */
    const [showIssuedRx, setShowIssuedRx] = useState(false);
    const [issuedRxToView, setIssuedRxToView] = useState<IssuedRxRow | null>(null);

    /* Column collapse */
    const [col1Open, setCol1Open] = useState(true);
    const [col2Open, setCol2Open] = useState(true);

    /* Review queue modal */
    const [showReviewQueue, setShowReviewQueue] = useState(false);
    const [reviewQueueItems, setReviewQueueItems] = useState<ReviewQueueItem[]>([]);
    const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
    const [pendingQueueCount, setPendingQueueCount] = useState(0);
    const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewQueueDraft>>({});
    const [approvingId, setApprovingId] = useState<string | null>(null);

    /* Renal safety flags */
    const [renalAlerts, setRenalAlerts] = useState<Map<number, RenalDoseAlert[]>>(new Map());

    /* Catalogue analysis */
    const [analysingCatalogue, setAnalysingCatalogue] = useState(false);
    const [catalogueResult, setCatalogueResult] = useState<CatalogueAnalysisResult | null>(null);
    const [showCatalogueResult, setShowCatalogueResult] = useState(false);

    /* ── Debounce search ──────────────────────────────────────────────── */
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
        return () => window.clearTimeout(t);
    }, [searchQuery]);

    /* ── Renal dose alerts — recompute when drugs or eGFR changes ─────── */
    useEffect(() => {
        if (canonicalDrugs.length === 0) { setRenalAlerts(new Map()); return; }
        const effectiveEGFR = labSnapshot.egfr ?? computedEGFR ?? null;
        const alertMap = new Map<number, RenalDoseAlert[]>();
        canonicalDrugs.forEach((drug, idx) => {
            // Use pipeline-resolved ingredients when available; fall back to raw name
            const searchTerms = drug.components.length > 0 ? drug.components : [drug.name];
            const alerts: RenalDoseAlert[] = [];
            const seen = new Set<string>();
            for (const term of searchTerms) {
                for (const a of checkRenalDose(term, effectiveEGFR)) {
                    if (!seen.has(a.label)) { alerts.push(a); seen.add(a.label); }
                }
            }
            if (alerts.length > 0) alertMap.set(idx, alerts);
        });
        setRenalAlerts(alertMap);
    }, [canonicalDrugs, labSnapshot.egfr, computedEGFR]);

    /* ── Fetch patients ───────────────────────────────────────────────── */
    const fetchPatients = useCallback(async () => {
        if (!doctor.hospital_id) return;
        setPatientsLoading(true);
        try {
            let q = (supabase.from('hospital_patients') as any)
                .select('id, name, age, mr_number, token_number, phone, gender, father_husband_name')
                .eq('hospital_id', doctor.hospital_id)
                .order('name', { ascending: true })
                .limit(80);
            if (debouncedQuery) {
                q = q.or(`name.ilike.%${debouncedQuery}%,mr_number.ilike.%${debouncedQuery}%`);
            }
            const { data, error } = await q;
            if (error) throw error;
            setPatients((data as PatientRow[]) || []);
        } catch {
            toast.error('Could not load patients');
        } finally {
            setPatientsLoading(false);
        }
    }, [debouncedQuery, doctor.hospital_id]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    /* ── Fetch prescriptions + latest labs ───────────────────────────── */
    const selectPatient = async (p: PatientRow) => {
        setSelectedPatient(p);
        setSelectedRx(null);
        setCanonicalDrugs([]);
        setPipelineSteps([]);
        setAnalysisComplete(false);
        setConcerns([]);
        setKfre(null);
        setComputedEGFR(null);
        setShowKFREPanel(false);
        setPrescriptions([]);
        setRxLoading(true);
        try {
            const { data, error } = await (supabase.from('hospital_prescriptions') as any)
                .select(`id, created_at, medications, notes, token_number,
                    doctor:hospital_doctors!hospital_prescriptions_doctor_id_fkey(name, specialty)`)
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', p.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setPrescriptions((data as PrescriptionRow[]) || []);
        } catch {
            toast.error('Could not load prescriptions');
        } finally {
            setRxLoading(false);
        }

        // Fetch latest labs for KFRE (best-effort, non-blocking)
        try {
            const { data: labs } = await (supabase.from('lab_results') as any)
                .select('test_type, value, test_date')
                .eq('patient_id', p.id)
                .in('test_type', ['creatinine', 'egfr', 'acr', 'albumin', 'bicarbonate'])
                .order('test_date', { ascending: false })
                .limit(10);

            if (labs && labs.length > 0) {
                const snap: PatientLabSnapshot = {};
                for (const lab of labs) {
                    if (!snap[lab.test_type as keyof PatientLabSnapshot]) {
                        (snap as any)[lab.test_type] = lab.value;
                        if (lab.test_type === 'egfr') snap.egfrDate = lab.test_date;
                    }
                }
                setLabSnapshot(snap);
            }
        } catch { /* non-critical */ }
    };

    /* ── Run analysis pipeline ────────────────────────────────────────── */
    const runAnalysis = async () => {
        if (!selectedRx || analysisRunning) return;
        const meds: MedItem[] = Array.isArray(selectedRx.medications) ? selectedRx.medications : [];
        if (meds.length === 0) { toast.error('No medications in this prescription'); return; }

        setAnalysisRunning(true);
        setAnalysisComplete(false);
        setCanonicalDrugs([]);
        setPipelineSteps([]);
        setConcerns([]);

        const rawList = meds.map(m => ({ raw_name: m.name || '', times_prescribed: 1 }));

        const result = await runPipeline(rawList, (step) => {
            setPipelineSteps(prev => {
                const next = [...prev];
                const idx = step.step - 1;
                next[idx] = step;
                return next;
            });
        });

        setCanonicalDrugs(result.canonical);
        setConcerns(deriveAnalysisConcerns(result.canonical));
        setAnalysisRunning(false);
        setAnalysisComplete(true);

        // Push unknowns to drug_review_queue (best-effort)
        const unknowns = result.canonical.filter(d => d.review_status === 'pending_review');
        if (unknowns.length > 0 && doctor.hospital_id) {
            try {
                const inserts = unknowns.map(d => ({
                    hospital_id: doctor.hospital_id,
                    brand_name: d.name,
                    raw_names: d.source_raws,
                    status: 'pending',
                }));
                await (supabase.from('drug_review_queue') as any).upsert(inserts, {
                    onConflict: 'hospital_id,brand_name',
                    ignoreDuplicates: true,
                });
            } catch { /* non-critical */ }
        }

        // Log telemetry
        try {
            await (supabase.from('drug_resolution_events') as any).insert({
                hospital_id: doctor.hospital_id,
                doctor_id: doctor.id,
                patient_id: selectedPatient?.id,
                prescription_id: selectedRx.id,
                total_drugs: result.canonical.length,
                resolved_count: result.resolvedCount,
                pending_review_count: result.pendingReviewCount,
                resolved_at: new Date().toISOString(),
            });
        } catch { /* non-critical */ }
    };

    /* ── Compute KFRE ─────────────────────────────────────────────────── */
    const computeKFRE = () => {
        if (!selectedPatient) return;
        const age = selectedPatient.age ?? 60;
        const sex = (selectedPatient.gender?.toLowerCase() === 'female' || selectedPatient.gender?.toLowerCase() === 'f') ? 'female' : 'male';
        const { creatinine, egfr, acr, albumin, phosphorus, bicarbonate, calcium } = labSnapshot;

        let effectiveEGFR = egfr ?? null;
        if (!effectiveEGFR && creatinine && creatinine > 0) {
            effectiveEGFR = calculateEGFR(creatinine, age, sex);
            setComputedEGFR(effectiveEGFR);
        }

        if (!effectiveEGFR || !acr) {
            toast.error('Need eGFR (or creatinine) and ACR to compute KFRE. Enter values below.');
            return;
        }

        const hasFullLabs = albumin && phosphorus && bicarbonate && calcium;
        const result = hasFullLabs
            ? calculateKFRE8(age, sex, effectiveEGFR, acr, albumin!, phosphorus!, bicarbonate!, calcium!)
            : calculateKFRE(age, sex, effectiveEGFR, acr);

        setKfre(result);
    };

    /* ── Fetch pending queue count (badge) ────────────────────────── */
    const fetchPendingQueueCount = useCallback(async () => {
        if (!doctor.hospital_id) return;
        try {
            const { count } = await (supabase.from('drug_review_queue') as any)
                .select('id', { count: 'exact', head: true })
                .eq('hospital_id', doctor.hospital_id)
                .eq('status', 'pending');
            setPendingQueueCount(count ?? 0);
        } catch { /* non-critical */ }
    }, [doctor.hospital_id]);

    useEffect(() => { fetchPendingQueueCount(); }, [fetchPendingQueueCount]);

    /* ── Open review queue modal ───────────────────────────────────── */
    const openReviewQueue = async () => {
        setShowReviewQueue(true);
        setReviewQueueLoading(true);
        try {
            const { data, error } = await (supabase.from('drug_review_queue') as any)
                .select('id, brand_name, raw_names, status')
                .eq('hospital_id', doctor.hospital_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true });
            if (error) throw error;
            const items = (data || []) as ReviewQueueItem[];
            setReviewQueueItems(items);
            const drafts: Record<string, ReviewQueueDraft> = {};
            items.forEach(item => {
                drafts[item.id] = { generic_name: '', category: '', atc_code: '', cdsco_schedule: '' };
            });
            setReviewDrafts(drafts);
        } catch {
            toast.error('Could not load review queue');
        } finally {
            setReviewQueueLoading(false);
        }
    };

    /* ── Approve a queue item → promote to reference_drugs ─────────── */
    const approveQueueItem = async (item: ReviewQueueItem) => {
        const draft = reviewDrafts[item.id];
        if (!draft?.generic_name.trim()) {
            toast.error('Enter a generic name before approving');
            return;
        }
        setApprovingId(item.id);
        try {
            await (supabase.from('reference_drugs') as any).upsert({
                brand_name: item.brand_name,
                generic_name: draft.generic_name.trim(),
                category: draft.category.trim() || null,
                atc_code: draft.atc_code.trim() || null,
                cdsco_schedule: draft.cdsco_schedule.trim() || null,
                components: [draft.generic_name.trim()],
                renal_precaution: false,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'brand_name' });
            await (supabase.from('drug_review_queue') as any)
                .update({ status: 'approved' })
                .eq('id', item.id);
            toast.success(`${item.brand_name} approved`);
            setReviewQueueItems(prev => prev.filter(i => i.id !== item.id));
            setPendingQueueCount(prev => Math.max(0, prev - 1));
        } catch (e: any) {
            toast.error(e?.message || 'Approval failed');
        } finally {
            setApprovingId(null);
        }
    };

    /* ── Skip a queue item ────────────────────────────────────────── */
    const skipQueueItem = async (item: ReviewQueueItem) => {
        try {
            await (supabase.from('drug_review_queue') as any)
                .update({ status: 'rejected' })
                .eq('id', item.id);
            setReviewQueueItems(prev => prev.filter(i => i.id !== item.id));
            setPendingQueueCount(prev => Math.max(0, prev - 1));
        } catch {
            toast.error('Could not skip item');
        }
    };

    /* ── Analyse full hospital drug catalogue ─────────────────────── */
    const analyseCatalogue = async () => {
        if (analysingCatalogue) return;
        setAnalysingCatalogue(true);
        try {
            const { data: savedDrugs, error } = await (supabase.from('hospital_saved_drugs') as any)
                .select('name')
                .eq('hospital_id', doctor.hospital_id);
            if (error) throw error;
            if (!savedDrugs || savedDrugs.length === 0) {
                toast.error('No saved drugs found in hospital catalogue');
                return;
            }
            const rawList = (savedDrugs as { name: string }[]).map(d => ({ raw_name: d.name, times_prescribed: 1 }));
            const result = await runPipeline(rawList);

            const unknowns = result.canonical.filter(d => d.review_status === 'pending_review');
            if (unknowns.length > 0) {
                const inserts = unknowns.map(d => ({
                    hospital_id: doctor.hospital_id,
                    brand_name: d.name,
                    raw_names: d.source_raws,
                    status: 'pending',
                }));
                await (supabase.from('drug_review_queue') as any).upsert(inserts, {
                    onConflict: 'hospital_id,brand_name',
                    ignoreDuplicates: true,
                });
                fetchPendingQueueCount();
            }

            setCatalogueResult({
                total: result.canonical.length,
                resolved: result.resolvedCount,
                pending_review: result.pendingReviewCount,
                combos_expanded: result.canonical.filter(d => d.is_combo).length,
                new_queue_items: unknowns.length,
            });
            setShowCatalogueResult(true);
        } catch (e: any) {
            toast.error(e?.message || 'Catalogue analysis failed');
        } finally {
            setAnalysingCatalogue(false);
        }
    };

    /* ─── Render ────────────────────────────────────────────────────── */
    return (
        <div className="flex flex-col h-full min-h-screen bg-gray-50">

            {/* Top bar */}
            <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <span className="text-sm font-bold text-gray-900">BeanHealth AI</span>
                <span className="text-gray-300 text-sm">·</span>
                <span className="text-sm text-gray-500 font-medium">Prescription Analysis Engine</span>
                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                    {analysisComplete && canonicalDrugs.length > 0 && (
                        <>
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {canonicalDrugs.filter(d => d.review_status === 'approved').length} resolved
                            </span>
                            {canonicalDrugs.filter(d => d.review_status === 'pending_review').length > 0 && (
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                    {canonicalDrugs.filter(d => d.review_status === 'pending_review').length} in queue
                                </span>
                            )}
                        </>
                    )}
                    {/* Analyse Catalogue */}
                    <button
                        onClick={analyseCatalogue}
                        disabled={analysingCatalogue}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${analysingCatalogue ? 'bg-emerald-50 text-emerald-400 border-emerald-200 cursor-not-allowed' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20'}`}
                    >
                        {analysingCatalogue ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                        )}
                        {analysingCatalogue ? 'Scanning…' : 'Analyse Catalogue'}
                    </button>
                    {/* See Issued Prescriptions */}
                    <button
                        onClick={() => setShowIssuedRx(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Issued Prescriptions
                    </button>
                    {/* Review Queue */}
                    <button
                        onClick={openReviewQueue}
                        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white border border-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-500/20 transition-all"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        Review Queue
                        {pendingQueueCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                                {pendingQueueCount > 99 ? '99+' : pendingQueueCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Three columns */}
            <div className="flex flex-1 overflow-hidden divide-x divide-gray-100">

                {/* ── Col 1: Patients ────────────────────────────────────── */}
                <div
                    style={{ width: col1Open ? '256px' : '36px' }}
                    className="flex-shrink-0 flex flex-col bg-white overflow-hidden transition-all duration-200 ease-in-out"
                >
                    {col1Open ? (
                        <>
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Patients</p>
                                    <button
                                        onClick={() => setCol1Open(false)}
                                        title="Collapse"
                                        className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search MR ID or name..."
                                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 placeholder:text-gray-400"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {patientsLoading ? (
                                    <div className="p-6 text-center text-xs text-gray-400">Loading patients...</div>
                                ) : patients.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-gray-400">No patients found</div>
                                ) : (
                                    patients.map(p => {
                                        const isActive = selectedPatient?.id === p.id;
                                        const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                        return (
                                            <button key={p.id} onClick={() => selectPatient(p)}
                                                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 hover:bg-violet-50/50 ${isActive ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isActive ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                    {initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono truncate">
                                                        {p.mr_number || 'No MR'}{p.age ? ` · ${p.age}y` : ''}
                                                    </p>
                                                </div>
                                                {isActive && (
                                                    <svg className="w-3 h-3 text-violet-500 flex-shrink-0 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : (
                        /* Collapsed strip */
                        <button
                            onClick={() => setCol1Open(true)}
                            title="Expand Patients"
                            className="flex-1 flex flex-col items-center justify-center gap-2 hover:bg-violet-50/60 transition-colors group"
                        >
                            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            <span
                                className="text-[9px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-violet-500 transition-colors"
                                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                            >
                                Patients{selectedPatient ? ` · ${selectedPatient.name.split(' ')[0]}` : ''}
                            </span>
                        </button>
                    )}
                </div>

                {/* ── Col 2: Prescriptions ───────────────────────────────── */}
                <div
                    style={{ width: col2Open ? '256px' : '36px' }}
                    className="flex-shrink-0 flex flex-col bg-white overflow-hidden transition-all duration-200 ease-in-out"
                >
                    {col2Open ? (
                        <>
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {selectedPatient ? `${selectedPatient.name.split(' ')[0]}'s Rx` : 'Prescriptions'}
                                </p>
                                <button
                                    onClick={() => setCol2Open(false)}
                                    title="Collapse"
                                    className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {!selectedPatient ? (
                                    <div className="p-8 flex flex-col items-center justify-center text-center gap-3 h-full">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <p className="text-xs text-gray-400">Select a patient</p>
                                    </div>
                                ) : rxLoading ? (
                                    <div className="p-6 text-center text-xs text-gray-400">Loading prescriptions...</div>
                                ) : prescriptions.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-gray-400">No prescriptions found</div>
                                ) : (
                                    prescriptions.map((rx, idx) => {
                                        const isActive = selectedRx?.id === rx.id;
                                        const medCount = Array.isArray(rx.medications) ? rx.medications.length : 0;
                                        return (
                                            <button key={rx.id}
                                                onClick={() => { setSelectedRx(rx); setCanonicalDrugs([]); setPipelineSteps([]); setAnalysisComplete(false); setConcerns([]); setShowRxModal(false); }}
                                                className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors border-b border-gray-50 hover:bg-violet-50/50 ${isActive ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}>
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${isActive ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    {prescriptions.length - idx}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold text-gray-900">{formatDate(rx.created_at)}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        {medCount} drug{medCount !== 1 ? 's' : ''}{rx.doctor?.name ? ` · ${rx.doctor.name}` : ''}
                                                    </p>
                                                    {medCount > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {(rx.medications as MedItem[]).slice(0, 3).map((m, mi) => (
                                                                <span key={mi} className="text-[9px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">{m.name}</span>
                                                            ))}
                                                            {medCount > 3 && <span className="text-[9px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">+{medCount - 3}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                {isActive && (
                                                    <svg className="w-3 h-3 text-violet-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : (
                        /* Collapsed strip */
                        <button
                            onClick={() => setCol2Open(true)}
                            title="Expand Prescriptions"
                            className="flex-1 flex flex-col items-center justify-center gap-2 hover:bg-violet-50/60 transition-colors group"
                        >
                            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            <span
                                className="text-[9px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-violet-500 transition-colors"
                                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                            >
                                {selectedPatient ? `${selectedPatient.name.split(' ')[0]}'s Rx` : 'Prescriptions'}
                                {selectedRx ? ` · ${formatDate(selectedRx.created_at)}` : ''}
                            </span>
                        </button>
                    )}
                </div>

                {/* ── Col 3: Analysis ────────────────────────────────────── */}
                <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between gap-2 flex-shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analysis</p>
                        {selectedRx && (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowKFREPanel(v => !v)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showKFREPanel ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    KFRE
                                </button>
                                <button onClick={() => setShowRxModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-all">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    View Rx
                                </button>
                                <button onClick={runAnalysis} disabled={analysisRunning}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${analysisRunning ? 'bg-violet-100 text-violet-400 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/25'}`}>
                                    {analysisRunning ? (
                                        <><svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Analysing...</>
                                    ) : (
                                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{analysisComplete ? 'Re-analyse' : 'Analyse'}</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">

                        {/* Empty state */}
                        {!selectedRx && (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                                    <svg className="w-7 h-7 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">Select a prescription</p>
                                    <p className="text-xs text-gray-400 mt-1">then click Analyse to decompose drugs</p>
                                </div>
                            </div>
                        )}

                        {/* KFRE Panel */}
                        {showKFREPanel && selectedPatient && (
                            <KFREPanel
                                patient={selectedPatient}
                                labSnapshot={labSnapshot}
                                computedEGFR={computedEGFR}
                                kfre={kfre}
                                onLabChange={(key, val) => setLabSnapshot(prev => ({ ...prev, [key]: val }))}
                                onCompute={computeKFRE}
                            />
                        )}

                        {/* Pipeline progress */}
                        {(analysisRunning || (analysisComplete && pipelineSteps.length > 0)) && (
                            <PipelineProgress steps={pipelineSteps} />
                        )}

                        {/* Context header */}
                        {analysisComplete && selectedRx && selectedPatient && (
                            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold text-gray-800">{selectedPatient.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        MR: {selectedPatient.mr_number || 'N/A'} · Rx: {formatDate(selectedRx.created_at)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        {canonicalDrugs.filter(d => d.review_status === 'approved').length} resolved
                                    </span>
                                    {canonicalDrugs.filter(d => d.review_status === 'pending_review').length > 0 && (
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                            {canonicalDrugs.filter(d => d.review_status === 'pending_review').length} flagged
                                        </span>
                                    )}
                                    {canonicalDrugs.some(d => d.is_combo) && (
                                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                                            {canonicalDrugs.filter(d => d.is_combo).length} combos expanded
                                        </span>
                                    )}
                                    {renalAlerts.size > 0 && (
                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span>⚠</span>
                                            {Array.from(renalAlerts.values()).reduce((sum, a) => sum + a.length, 0)} renal {Array.from(renalAlerts.values()).reduce((sum, a) => sum + a.length, 0) === 1 ? 'flag' : 'flags'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Drug cards */}
                        {canonicalDrugs.length > 0 && (
                            <div className="space-y-2.5">
                                {canonicalDrugs.map((drug, idx) => (
                                    <DrugCard key={idx} drug={drug} rawMed={selectedRx?.medications[idx]} />
                                ))}
                            </div>
                        )}

                        {/* Renal Safety Flags */}
                        {analysisComplete && renalAlerts.size > 0 && (() => {
                            const effectiveEGFR = labSnapshot.egfr ?? computedEGFR ?? null;
                            const egfrStale = isEgfrStale(labSnapshot.egfrDate);
                            const hasHardStop = Array.from(renalAlerts.values()).flat().some(a => a.hardStop);
                            return (
                                <div className="rounded-xl border overflow-hidden" style={{ borderColor: hasHardStop ? '#fca5a5' : '#fed7aa' }}>
                                    {/* Panel header */}
                                    <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${hasHardStop ? 'bg-red-50' : 'bg-orange-50'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{hasHardStop ? '🛑' : '⚠️'}</span>
                                            <span className={`text-xs font-bold ${hasHardStop ? 'text-red-700' : 'text-orange-700'}`}>
                                                Renal Safety Flags
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {effectiveEGFR !== null ? (
                                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${egfrStale ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                                    eGFR {Math.round(effectiveEGFR)}{egfrStale ? ' ⚠ stale' : ''}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-50 border-gray-200 text-gray-500">
                                                    eGFR unknown — run KFRE ↑
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Per-drug alert rows */}
                                    <div className="divide-y divide-gray-100 bg-white">
                                        {Array.from(renalAlerts.entries()).map(([drugIdx, alerts]) => {
                                            const drug = canonicalDrugs[drugIdx];
                                            if (!drug) return null;
                                            const worst = highestSeverity(alerts);
                                            const cfg = SEVERITY_CONFIG[worst];
                                            return (
                                                <div key={drugIdx} className={`px-4 py-3 ${cfg.bg}`}>
                                                    {/* Drug name row */}
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div>
                                                            <span className="text-xs font-bold text-gray-800">{drug.name}</span>
                                                            {drug.components.length > 0 && (
                                                                <span className="ml-2 text-[10px] text-gray-500">
                                                                    ({drug.components.join(' + ')})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                                                            {cfg.icon} {cfg.label}
                                                        </span>
                                                    </div>
                                                    {/* Individual alerts */}
                                                    <div className="space-y-2">
                                                        {alerts.map((alert, ai) => (
                                                            <div key={ai} className={`rounded-lg border px-3 py-2 ${SEVERITY_CONFIG[alert.severity].bg} ${SEVERITY_CONFIG[alert.severity].border}`}>
                                                                <p className={`text-[11px] font-semibold ${SEVERITY_CONFIG[alert.severity].text}`}>
                                                                    {alert.egfrUnavailable
                                                                        ? `⚠ ${alert.message}`
                                                                        : `${SEVERITY_CONFIG[alert.severity].icon} ${alert.message}`
                                                                    }
                                                                </p>
                                                                <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                                                                    {alert.fullRecommendation}
                                                                </p>
                                                                <p className="text-[9px] text-gray-400 mt-1 font-mono">
                                                                    {alert.source}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Summary */}
                        {analysisComplete && canonicalDrugs.length > 0 && (
                            <AnalysisSummary drugs={canonicalDrugs} concerns={concerns} />
                        )}
                    </div>
                </div>
            </div>

            {/* Full prescription modal */}
            {showRxModal && selectedRx && selectedPatient && (
                <Suspense fallback={null}>
                    <PrescriptionModalSelector
                        doctor={{ id: doctor.id, name: doctor.name, specialty: doctor.specialty, hospital_id: doctor.hospital_id }}
                        patient={{ id: selectedPatient.id, name: selectedPatient.name, age: selectedPatient.age, mr_number: selectedPatient.mr_number, token_number: selectedRx.token_number || selectedPatient.token_number || '' }}
                        onClose={() => setShowRxModal(false)}
                        readOnly={true}
                        forcePrint={true}
                        existingData={selectedRx}
                    />
                </Suspense>
            )}

            {/* Issued Prescriptions browser */}
            {showIssuedRx && (
                <IssuedPrescriptionsModal
                    hospitalId={doctor.hospital_id}
                    hidden={!!issuedRxToView}
                    onView={(rx) => setIssuedRxToView(rx)}
                    onClose={() => setShowIssuedRx(false)}
                />
            )}

            {/* Read-only viewer for a selected issued prescription (stacks above the browser) */}
            {issuedRxToView && issuedRxToView.patient && (
                <Suspense fallback={null}>
                    <PrescriptionModalSelector
                        doctor={{
                            id: doctor.id,
                            name: issuedRxToView.doctor?.name || doctor.name,
                            specialty: issuedRxToView.doctor?.specialty || doctor.specialty,
                            hospital_id: doctor.hospital_id,
                        }}
                        patient={{
                            id: issuedRxToView.patient.id,
                            name: issuedRxToView.patient.name,
                            age: issuedRxToView.patient.age,
                            mr_number: issuedRxToView.patient.mr_number,
                            token_number: issuedRxToView.token_number || '',
                        }}
                        onClose={() => setIssuedRxToView(null)}
                        readOnly={true}
                        forcePrint={true}
                        existingData={issuedRxToView}
                    />
                </Suspense>
            )}

            {/* Drug Review Queue Modal */}
            {showReviewQueue && (
                <DrugReviewQueueModal
                    items={reviewQueueItems}
                    loading={reviewQueueLoading}
                    drafts={reviewDrafts}
                    approvingId={approvingId}
                    onDraftChange={(id, field, value) =>
                        setReviewDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
                    }
                    onApprove={approveQueueItem}
                    onSkip={skipQueueItem}
                    onClose={() => setShowReviewQueue(false)}
                />
            )}

            {/* Catalogue Analysis Result Modal */}
            {showCatalogueResult && catalogueResult && (
                <CatalogueResultModal
                    result={catalogueResult}
                    onClose={() => setShowCatalogueResult(false)}
                    onOpenQueue={() => { setShowCatalogueResult(false); openReviewQueue(); }}
                />
            )}
        </div>
    );
};

/* ─── PipelineProgress ────────────────────────────────────────────────── */

const STEP_LABELS = [
    'Load raw list',
    'Preprocess',
    'Cluster variants',
    'Canonical drugs',
    'Map forms',
    'Entity resolution',
    'Output',
];

const PipelineProgress: React.FC<{ steps: PipelineStep[] }> = ({ steps }) => (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Pipeline</p>
        <div className="grid grid-cols-7 gap-1">
            {STEP_LABELS.map((label, i) => {
                const step = steps[i];
                const status = step?.status ?? 'idle';
                return (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all
                            ${status === 'done' ? 'bg-violet-600 text-white' : status === 'running' ? 'bg-violet-100 text-violet-500 ring-2 ring-violet-300 ring-offset-1' : 'bg-gray-100 text-gray-400'}`}>
                            {status === 'running' ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            ) : status === 'done' ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (i + 1)}
                        </div>
                        <p className="text-[8px] text-gray-400 text-center leading-tight">{label}</p>
                        {step?.count !== undefined && status === 'done' && (
                            <span className="text-[8px] font-bold text-violet-600">{step.count}</span>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
);

/* ─── DrugCard ────────────────────────────────────────────────────────── */

const DrugCard: React.FC<{ drug: CanonicalDrug; rawMed?: MedItem }> = ({ drug, rawMed }) => {
    const approved = drug.review_status === 'approved';

    return (
        <div className={`bg-white rounded-xl border transition-all ${approved ? 'border-gray-100' : 'border-amber-200'}`}>
            <div className="px-4 py-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${approved ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                            {approved ? (
                                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900">{drug.name}</p>
                            {rawMed && (rawMed.dosage || rawMed.frequency || rawMed.duration) && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                    {[rawMed.dosage, rawMed.frequency, rawMed.duration, rawMed.timing].filter(Boolean).join(' · ')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {drug.category && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${categoryColor(drug.category)}`}>
                                {drug.category}
                            </span>
                        )}
                        {drug.renal_precaution && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                ⚠ Renal
                            </span>
                        )}
                        {drug.is_combo && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                                Combo
                            </span>
                        )}
                    </div>
                </div>

                {/* Ingredient expansion */}
                {approved && drug.ingredients.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 pl-7">
                        {drug.ingredients.map((ing, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="text-[11px] font-semibold text-emerald-700">{ing.name}</span>
                                {ing.strength && ing.strength !== 'unspecified' && (
                                    <span className="text-[10px] text-gray-500">{ing.strength}</span>
                                )}
                                {ing.atc_code && (
                                    <span className="text-[9px] font-mono text-gray-400 ml-auto">{ing.atc_code}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Unresolved */}
                {!approved && (
                    <div className="mt-2 pl-7 flex items-center gap-1.5">
                        <p className="text-[10px] text-amber-600">Not in drug database — flagged for curation within 24h</p>
                    </div>
                )}

                {/* Footer metadata */}
                {approved && (drug.atc_code || drug.cdsco_schedule) && (
                    <div className="mt-2 pl-7 flex items-center gap-3">
                        {drug.atc_code && !drug.is_combo && (
                            <span className="text-[9px] font-mono text-gray-400">ATC: {drug.atc_code}</span>
                        )}
                        {drug.cdsco_schedule && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${drug.cdsco_schedule === 'H1' || drug.cdsco_schedule === 'X' ? 'bg-red-50 text-red-600' : drug.cdsco_schedule === 'H' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                                Sch {drug.cdsco_schedule}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── AnalysisSummary ─────────────────────────────────────────────────── */

const AnalysisSummary: React.FC<{ drugs: CanonicalDrug[]; concerns: string[] }> = ({ drugs, concerns }) => {
    const categories = Object.entries(
        drugs.filter(d => d.review_status === 'approved' && d.category)
            .reduce((acc, d) => { acc[d.category!] = [...(acc[d.category!] || []), d.name]; return acc; }, {} as Record<string, string[]>)
    );

    return (
        <div className="space-y-3 pt-1">
            {categories.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Drug Classes</p>
                    <div className="space-y-2">
                        {categories.map(([cat, brands]) => (
                            <div key={cat} className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColor(cat)}`}>{cat}</span>
                                <span className="text-[10px] text-gray-500">{brands.join(', ')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {concerns.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Clinical Alerts</p>
                    </div>
                    <ul className="space-y-2">
                        {concerns.map((c, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                                <p className="text-[11px] text-amber-800 leading-relaxed">{c}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {concerns.length === 0 && drugs.some(d => d.review_status === 'approved') && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-3 flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[11px] font-semibold text-emerald-700">No clinical concerns from current rule set.</p>
                </div>
            )}

            {drugs.some(d => d.review_status === 'pending_review') && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        <span className="font-bold text-gray-700">{drugs.filter(d => d.review_status === 'pending_review').length} drug{drugs.filter(d => d.review_status === 'pending_review').length > 1 ? 's' : ''}</span> not found in local database — added to the hospital curation queue for review within 24h.
                    </p>
                </div>
            )}
        </div>
    );
};

/* ─── KFREPanel ───────────────────────────────────────────────────────── */

const KFREPanel: React.FC<{
    patient: PatientRow;
    labSnapshot: PatientLabSnapshot;
    computedEGFR: number | null;
    kfre: KFREResult | null;
    onLabChange: (key: string, val: number) => void;
    onCompute: () => void;
}> = ({ patient, labSnapshot, computedEGFR, kfre, onLabChange, onCompute }) => {
    const fields: { key: string; label: string; unit: string; placeholder: string }[] = [
        { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', placeholder: '1.2' },
        { key: 'egfr', label: 'eGFR (measured)', unit: 'mL/min', placeholder: 'auto-computed if blank' },
        { key: 'acr', label: 'ACR', unit: 'mg/g', placeholder: '300' },
        { key: 'albumin', label: 'Albumin', unit: 'g/dL', placeholder: '4.0' },
        { key: 'bicarbonate', label: 'Bicarbonate', unit: 'mEq/L', placeholder: '24' },
    ];

    const effectiveEGFR = labSnapshot.egfr ?? computedEGFR;
    const sex = (patient.gender?.toLowerCase() === 'female' || patient.gender?.toLowerCase() === 'f') ? 'female' : 'male';
    const computedFromCr = !labSnapshot.egfr && labSnapshot.creatinine && patient.age
        ? calculateEGFR(labSnapshot.creatinine, patient.age, sex)
        : null;

    return (
        <div className="bg-white rounded-xl border border-rose-100 overflow-hidden">
            <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest">KFRE — Kidney Failure Risk</p>
                <span className="ml-auto text-[9px] text-rose-500">Tangri 2016 · CKD 3–5</span>
            </div>

            <div className="px-4 py-3 space-y-3">
                {/* Patient context */}
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>{patient.name}</span>
                    <span className="text-gray-300">·</span>
                    <span>{patient.age ? `${patient.age} yrs` : 'Age unknown'}</span>
                    <span className="text-gray-300">·</span>
                    <span className="capitalize">{sex}</span>
                    {effectiveEGFR && <span className="ml-auto font-bold text-gray-700">eGFR: {effectiveEGFR} mL/min {computedFromCr ? <span className="text-violet-500">(CKD-EPI 2021)</span> : ''}</span>}
                </div>

                {/* Lab inputs grid */}
                <div className="grid grid-cols-3 gap-2">
                    {fields.map(f => (
                        <div key={f.key}>
                            <p className="text-[9px] font-bold text-gray-500 mb-1">{f.label} <span className="font-normal text-gray-400">({f.unit})</span></p>
                            <input
                                type="number"
                                step="any"
                                value={(labSnapshot as any)[f.key] ?? ''}
                                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onLabChange(f.key, v); }}
                                placeholder={f.placeholder}
                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-gray-300"
                            />
                        </div>
                    ))}
                    <div className="flex items-end">
                        <button onClick={onCompute}
                            className="w-full px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors">
                            Compute
                        </button>
                    </div>
                </div>

                {/* KFRE result */}
                {kfre && (
                    <div className={`rounded-xl border px-4 py-3 ${KFRE_TIER_COLORS[kfre.riskTier]}`}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold">{KFRE_TIER_LABEL[kfre.riskTier]}</p>
                            <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                                {labSnapshot.albumin && labSnapshot.bicarbonate ? '8-variable' : '4-variable'}
                            </span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div>
                                <p className="text-[9px] opacity-70 font-medium">2-year risk</p>
                                <p className="text-xl font-black">{kfre.risk2yrPct}%</p>
                            </div>
                            <div>
                                <p className="text-[9px] opacity-70 font-medium">5-year risk</p>
                                <p className="text-xl font-black">{kfre.risk5yrPct}%</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-[9px] opacity-60 leading-relaxed">
                                    Risk of kidney failure<br />requiring dialysis or transplant
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── DrugReviewQueueModal ────────────────────────────────────────────── */

const DrugReviewQueueModal: React.FC<{
    items: ReviewQueueItem[];
    loading: boolean;
    drafts: Record<string, ReviewQueueDraft>;
    approvingId: string | null;
    onDraftChange: (id: string, field: keyof ReviewQueueDraft, value: string) => void;
    onApprove: (item: ReviewQueueItem) => void;
    onSkip: (item: ReviewQueueItem) => void;
    onClose: () => void;
}> = ({ items, loading, drafts, approvingId, onDraftChange, onApprove, onSkip, onClose }) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900">Drug Review Queue</p>
                    <p className="text-[11px] text-gray-500">Map unknown brands → generic names · Approved entries go live immediately</p>
                </div>
                <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="py-16 text-center text-sm text-gray-400">Loading queue…</div>
                ) : items.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">Queue is empty</p>
                        <p className="text-xs text-gray-400">All unknown drugs have been curated or skipped</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(item => {
                            const draft = drafts[item.id] || { generic_name: '', category: '', atc_code: '', cdsco_schedule: '' };
                            const isApproving = approvingId === item.id;
                            return (
                                <div key={item.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                    {/* Brand name + raw aliases */}
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 font-mono">{item.brand_name}</p>
                                            {item.raw_names && item.raw_names.length > 0 && (
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    Raw: {item.raw_names.slice(0, 3).join(', ')}{item.raw_names.length > 3 ? ` +${item.raw_names.length - 3}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                            UNKNOWN
                                        </span>
                                    </div>

                                    {/* Edit fields */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="col-span-2">
                                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Generic Name *</label>
                                            <input
                                                type="text"
                                                value={draft.generic_name}
                                                onChange={e => onDraftChange(item.id, 'generic_name', e.target.value)}
                                                placeholder="e.g. Metoprolol Succinate"
                                                className="mt-0.5 w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-gray-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Category</label>
                                            <input
                                                type="text"
                                                value={draft.category}
                                                onChange={e => onDraftChange(item.id, 'category', e.target.value)}
                                                placeholder="e.g. BETA BLOCKER"
                                                className="mt-0.5 w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-gray-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">ATC Code</label>
                                            <input
                                                type="text"
                                                value={draft.atc_code}
                                                onChange={e => onDraftChange(item.id, 'atc_code', e.target.value.toUpperCase())}
                                                placeholder="e.g. C07AB12"
                                                className="mt-0.5 w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-gray-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">CDSCO Schedule</label>
                                            <input
                                                type="text"
                                                value={draft.cdsco_schedule}
                                                onChange={e => onDraftChange(item.id, 'cdsco_schedule', e.target.value.toUpperCase())}
                                                placeholder="H, H1, X, or blank"
                                                className="mt-0.5 w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-gray-300"
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => onSkip(item)}
                                            disabled={isApproving}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            Skip for now
                                        </button>
                                        <button
                                            onClick={() => onApprove(item)}
                                            disabled={isApproving || !draft.generic_name.trim()}
                                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isApproving || !draft.generic_name.trim() ? 'bg-amber-100 text-amber-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/25'}`}
                                        >
                                            {isApproving ? (
                                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                            )}
                                            {isApproving ? 'Approving…' : 'Approve'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            {!loading && items.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                    <p className="text-[10px] text-gray-500">
                        <span className="font-bold text-amber-600">{items.length}</span> item{items.length !== 1 ? 's' : ''} pending · Approved entries are immediately available in the drug pipeline
                    </p>
                </div>
            )}
        </div>
    </div>
);

/* ─── CatalogueResultModal ────────────────────────────────────────────── */

const CatalogueResultModal: React.FC<{
    result: CatalogueAnalysisResult;
    onClose: () => void;
    onOpenQueue: () => void;
}> = ({ result, onClose, onOpenQueue }) => {
    const resolvedPct = result.total > 0 ? Math.round((result.resolved / result.total) * 100) : 0;
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 bg-emerald-600 text-white">
                    <div className="flex items-center gap-3 mb-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        <p className="text-sm font-bold">Catalogue Analysis Complete</p>
                    </div>
                    <p className="text-[11px] text-emerald-100">Full hospital drug catalogue has been scanned</p>
                </div>

                {/* Stats */}
                <div className="p-6 space-y-4">
                    {/* Resolution rate bar */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-bold text-gray-700">Resolution Rate</p>
                            <span className="text-sm font-black text-emerald-600">{resolvedPct}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${resolvedPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Stat grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 text-center">
                            <p className="text-2xl font-black text-gray-900">{result.total}</p>
                            <p className="text-[10px] text-gray-500 font-medium mt-0.5">Total Drugs</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3 text-center">
                            <p className="text-2xl font-black text-emerald-600">{result.resolved}</p>
                            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Resolved</p>
                        </div>
                        <div className="bg-violet-50 rounded-xl border border-violet-100 px-4 py-3 text-center">
                            <p className="text-2xl font-black text-violet-600">{result.combos_expanded}</p>
                            <p className="text-[10px] text-violet-600 font-medium mt-0.5">Combos Expanded</p>
                        </div>
                        <div className={`rounded-xl border px-4 py-3 text-center ${result.pending_review > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                            <p className={`text-2xl font-black ${result.pending_review > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{result.pending_review}</p>
                            <p className={`text-[10px] font-medium mt-0.5 ${result.pending_review > 0 ? 'text-amber-600' : 'text-gray-400'}`}>Unknown / Queued</p>
                        </div>
                    </div>

                    {result.new_queue_items > 0 && (
                        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3 flex items-center gap-3">
                            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-[11px] text-amber-800">
                                <span className="font-bold">{result.new_queue_items} new drug{result.new_queue_items !== 1 ? 's' : ''}</span> added to the review queue — open it to map them to generics.
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-6 pb-5 flex items-center gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                        Close
                    </button>
                    {result.pending_review > 0 && (
                        <button onClick={onOpenQueue} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/25 transition-all flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            Open Review Queue
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─── Issued Prescriptions Browser ───────────────────────────────────── */

const toLocalISODate = (d: Date): string => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const IssuedPrescriptionsModal: React.FC<{
    hospitalId: string;
    hidden?: boolean;
    onView: (rx: IssuedRxRow) => void;
    onClose: () => void;
}> = ({ hospitalId, hidden, onView, onClose }) => {
    const today = toLocalISODate(new Date());
    const [mode, setMode] = useState<'date' | 'month' | 'custom'>('month');
    const [dateVal, setDateVal] = useState(today);
    const [monthVal, setMonthVal] = useState(today.slice(0, 7));
    const [fromVal, setFromVal] = useState(today);
    const [toVal, setToVal] = useState(today);
    const [drugSearch, setDrugSearch] = useState('');
    const [debouncedDrug, setDebouncedDrug] = useState('');
    const [rows, setRows] = useState<IssuedRxRow[]>([]);
    const [loading, setLoading] = useState(false);

    /* Debounce the drug search */
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedDrug(drugSearch.trim().toLowerCase()), 300);
        return () => window.clearTimeout(t);
    }, [drugSearch]);

    /* Active [start, end) window from the chosen filter */
    const range = useMemo(() => {
        if (mode === 'date') {
            if (!dateVal) return null;
            const start = new Date(`${dateVal}T00:00:00`);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            return { start, end };
        }
        if (mode === 'month') {
            const [y, m] = monthVal.split('-').map(Number);
            if (!y || !m) return null;
            return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
        }
        if (!fromVal || !toVal) return null;
        const start = new Date(`${fromVal}T00:00:00`);
        let end = new Date(`${toVal}T00:00:00`); end.setDate(end.getDate() + 1);
        if (end <= start) end = new Date(start.getTime() + 86400000);
        return { start, end };
    }, [mode, dateVal, monthVal, fromVal, toVal]);

    const fetchRows = useCallback(async () => {
        if (!range) { setRows([]); return; }
        setLoading(true);
        try {
            const PAGE = 1000;
            const all: IssuedRxRow[] = [];
            let from = 0;
            while (true) {
                const { data, error } = await (supabase.from('hospital_prescriptions') as any)
                    .select(`id, created_at, medications, notes, token_number,
                        doctor:hospital_doctors!hospital_prescriptions_doctor_id_fkey(name, specialty),
                        patient:hospital_patients!hospital_prescriptions_patient_id_fkey(id, name, age, mr_number)`)
                    .eq('hospital_id', hospitalId)
                    .gte('created_at', range.start.toISOString())
                    .lt('created_at', range.end.toISOString())
                    .order('created_at', { ascending: false })
                    .range(from, from + PAGE - 1);
                if (error) throw error;
                const batch = (data as IssuedRxRow[]) || [];
                all.push(...batch);
                if (batch.length < PAGE) break;
                from += PAGE;
            }
            setRows(all);
        } catch {
            toast.error('Could not load issued prescriptions');
        } finally {
            setLoading(false);
        }
    }, [range, hospitalId]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    /* Drug-name filter, applied client-side within the loaded window */
    const filtered = useMemo(() => {
        if (!debouncedDrug) return rows;
        return rows.filter(r => (r.medications || []).some(m => (m.name || '').toLowerCase().includes(debouncedDrug)));
    }, [rows, debouncedDrug]);

    const formatDateTime = (iso: string): string => {
        try {
            const d = new Date(iso);
            return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        } catch { return iso; }
    };

    const inputCls = 'px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white focus:border-indigo-400 outline-none';

    return (
        <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 ${hidden ? 'hidden' : ''}`}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">Issued Prescriptions</p>
                        <p className="text-[11px] text-gray-400">Browse prescriptions issued by the hospital</p>
                    </div>
                    <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-col gap-3 flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                            {(['date', 'month', 'custom'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    {m === 'date' ? 'By Date' : m === 'month' ? 'By Month' : 'Custom Range'}
                                </button>
                            ))}
                        </div>
                        {mode === 'date' && (
                            <input type="date" value={dateVal} max={today} onChange={e => setDateVal(e.target.value)} className={inputCls} />
                        )}
                        {mode === 'month' && (
                            <input type="month" value={monthVal} max={today.slice(0, 7)} onChange={e => setMonthVal(e.target.value)} className={inputCls} />
                        )}
                        {mode === 'custom' && (
                            <div className="flex items-center gap-1.5">
                                <input type="date" value={fromVal} max={today} onChange={e => setFromVal(e.target.value)} className={inputCls} />
                                <span className="text-xs text-gray-400 font-medium">to</span>
                                <input type="date" value={toVal} max={today} onChange={e => setToVal(e.target.value)} className={inputCls} />
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            value={drugSearch}
                            onChange={e => setDrugSearch(e.target.value)}
                            placeholder="Search by drug name (e.g. Lasix, Telma)…"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-indigo-400 outline-none"
                        />
                    </div>
                    <div className="text-[11px] text-gray-400">
                        {loading
                            ? 'Loading…'
                            : `${filtered.length} prescription${filtered.length === 1 ? '' : 's'}${debouncedDrug ? ` containing “${debouncedDrug}”` : ''}`}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                            <svg className="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Loading prescriptions…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-sm font-medium">No prescriptions found</p>
                            <p className="text-xs">Adjust the date filter or drug search.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map(rx => {
                                const meds = rx.medications || [];
                                const matched = debouncedDrug ? meds.filter(m => (m.name || '').toLowerCase().includes(debouncedDrug)) : [];
                                const chips = matched.length ? matched : meds;
                                return (
                                    <button
                                        key={rx.id}
                                        onClick={() => onView(rx)}
                                        className="w-full text-left bg-white border border-gray-200 rounded-xl p-3.5 hover:border-indigo-300 hover:shadow-sm transition-all flex items-start gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-gray-900 truncate">{rx.patient?.name || 'Unknown patient'}</span>
                                                {rx.patient?.mr_number && <span className="text-[11px] font-mono font-bold text-gray-500">{rx.patient.mr_number}</span>}
                                                {rx.patient?.age != null && rx.patient.age !== '' && (
                                                    <span className="text-[11px] text-gray-400">
                                                        {/[a-zA-Z]/.test(String(rx.patient.age)) ? String(rx.patient.age) : `${rx.patient.age}y`}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-gray-400 mt-0.5">
                                                {formatDateTime(rx.created_at)}{rx.doctor?.name ? ` · Dr. ${rx.doctor.name}` : ''}
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {chips.slice(0, 6).map((m, i) => (
                                                    <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${matched.length ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-600'}`}>
                                                        {m.name}
                                                    </span>
                                                ))}
                                                {chips.length > 6 && <span className="text-[10px] text-gray-400 px-1 self-center">+{chips.length - 6} more</span>}
                                                {meds.length === 0 && <span className="text-[10px] text-gray-400">No medications</span>}
                                            </div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnterpriseCKDSnapshotView;
