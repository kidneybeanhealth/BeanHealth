/**
 * EnterpriseCKDSnapshotView — BeanHealth AI · Prescription Analysis Engine
 *
 * Three-column workspace:
 *   Col 1 — Patient search (MR / name) → selectable list
 *   Col 2 — Prescription history for selected patient
 *   Col 3 — Animated drug decomposition + rule-engine analysis
 *            powered by the reference_drugs table
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

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

interface DrugResolution {
    brandInput: string;       // exactly as written in prescription
    dosage: string;
    frequency: string;
    duration: string;
    timing: string;
    generic_name: string | null;
    category: string | null;
    resolved: boolean;
    status: 'pending' | 'resolving' | 'done';
}

interface AnalysisResult {
    drugs: DrugResolution[];
    resolvedCount: number;
    unresolvedCount: number;
    categoryBreakdown: Record<string, string[]>;   // category → [brand, ...]
    concerns: string[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const CONCERN_RULES: Array<{
    categories: string[];
    condition: string;
    message: string;
}> = [
    { categories: ['NSAID', 'ANALGESICS'], condition: 'always', message: 'NSAIDs may worsen renal function — verify eGFR before continuing.' },
    { categories: ['ACE INHIBITOR', 'ARB'], condition: 'both', message: 'ACE inhibitor + ARB combination detected — dual blockade increases hyperkalaemia risk.' },
    { categories: ['DIURETICS'], condition: 'always', message: 'Diuretic present — monitor electrolytes, especially potassium.' },
    { categories: ['IMMUNOSUPPRESSANT'], condition: 'always', message: 'Immunosuppressant detected — check trough levels and renal dosing.' },
    { categories: ['ANTIBIOTIC'], condition: 'always', message: 'Antibiotic course — confirm renal dose adjustment if eGFR < 60.' },
];

function deriveAnalysisConcerns(drugs: DrugResolution[]): string[] {
    const resolvedCategories = drugs
        .filter(d => d.resolved && d.category)
        .map(d => d.category!.toUpperCase());

    const concerns: string[] = [];
    const seen = new Set<string>();

    for (const rule of CONCERN_RULES) {
        if (rule.condition === 'both') {
            const hits = rule.categories.filter(c => resolvedCategories.includes(c));
            if (hits.length === rule.categories.length) {
                if (!seen.has(rule.message)) { concerns.push(rule.message); seen.add(rule.message); }
            }
        } else {
            const hit = rule.categories.some(c => resolvedCategories.includes(c));
            if (hit && !seen.has(rule.message)) { concerns.push(rule.message); seen.add(rule.message); }
        }
    }
    return concerns;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
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
    return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
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
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analysisRunning, setAnalysisRunning] = useState(false);
    const analysisCancelRef = useRef(false);

    /* ── Debounce search ──────────────────────────────────────────────── */
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
        return () => window.clearTimeout(t);
    }, [searchQuery]);

    /* ── Fetch patients ───────────────────────────────────────────────── */
    useEffect(() => {
        fetchPatients();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery]);

    const fetchPatients = async () => {
        if (!doctor.hospital_id) return;
        setPatientsLoading(true);
        try {
            let q = (supabase.from('hospital_patients') as any)
                .select('id, name, age, mr_number, token_number, phone, gender, father_husband_name')
                .eq('hospital_id', doctor.hospital_id)
                .order('name', { ascending: true })
                .limit(80);

            if (debouncedQuery) {
                q = q.or(
                    `name.ilike.%${debouncedQuery}%,mr_number.ilike.%${debouncedQuery}%`
                );
            }

            const { data, error } = await q;
            if (error) throw error;
            setPatients((data as PatientRow[]) || []);
        } catch (err) {
            console.error('[AI Panel] patient fetch', err);
            toast.error('Could not load patients');
        } finally {
            setPatientsLoading(false);
        }
    };

    /* ── Fetch prescriptions for selected patient ─────────────────────── */
    const selectPatient = async (p: PatientRow) => {
        setSelectedPatient(p);
        setSelectedRx(null);
        setAnalysisResult(null);
        setPrescriptions([]);
        setRxLoading(true);
        try {
            const { data, error } = await (supabase.from('hospital_prescriptions') as any)
                .select(`
                    id, created_at, medications, notes, token_number,
                    doctor:hospital_doctors!hospital_prescriptions_doctor_id_fkey(name, specialty)
                `)
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', p.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPrescriptions((data as PrescriptionRow[]) || []);
        } catch (err) {
            console.error('[AI Panel] rx fetch', err);
            toast.error('Could not load prescriptions');
        } finally {
            setRxLoading(false);
        }
    };

    /* ── Run analysis ─────────────────────────────────────────────────── */
    const runAnalysis = async () => {
        if (!selectedRx || analysisRunning) return;
        const meds: MedItem[] = Array.isArray(selectedRx.medications) ? selectedRx.medications : [];
        if (meds.length === 0) { toast.error('No medications in this prescription'); return; }

        setAnalysisRunning(true);
        analysisCancelRef.current = false;
        setAnalysisResult(null);

        /* Build skeleton — all pending */
        const skeleton: DrugResolution[] = meds.map(m => ({
            brandInput: m.name || 'Unknown',
            dosage: m.dosage || '',
            frequency: m.frequency || '',
            duration: m.duration || '',
            timing: m.timing || '',
            generic_name: null,
            category: null,
            resolved: false,
            status: 'pending',
        }));
        setAnalysisResult({ drugs: skeleton, resolvedCount: 0, unresolvedCount: 0, categoryBreakdown: {}, concerns: [] });

        /* Resolve one by one with visible animation */
        const resolved: DrugResolution[] = [...skeleton];

        for (let i = 0; i < meds.length; i++) {
            if (analysisCancelRef.current) break;

            /* Mark as resolving */
            resolved[i] = { ...resolved[i], status: 'resolving' };
            setAnalysisResult(prev => prev ? { ...prev, drugs: [...resolved] } : null);

            await new Promise(r => setTimeout(r, 320)); // visual pause

            /* Query reference_drugs */
            const brandInput = meds[i].name || '';
            try {
                const { data } = await (supabase.from('reference_drugs') as any)
                    .select('generic_name, category')
                    .ilike('brand_name', `%${brandInput.split(' ')[0]}%`)
                    .limit(1)
                    .maybeSingle();

                resolved[i] = {
                    ...resolved[i],
                    generic_name: data?.generic_name ?? null,
                    category: data?.category ?? null,
                    resolved: !!data,
                    status: 'done',
                };
            } catch {
                resolved[i] = { ...resolved[i], status: 'done', resolved: false };
            }

            /* Recompute summary after each step */
            const resolvedCount = resolved.filter(d => d.status === 'done' && d.resolved).length;
            const unresolvedCount = resolved.filter(d => d.status === 'done' && !d.resolved).length;
            const categoryBreakdown: Record<string, string[]> = {};
            resolved.filter(d => d.resolved && d.category).forEach(d => {
                const cat = d.category!;
                if (!categoryBreakdown[cat]) categoryBreakdown[cat] = [];
                categoryBreakdown[cat].push(d.brandInput);
            });
            const concerns = deriveAnalysisConcerns(resolved);

            setAnalysisResult({ drugs: [...resolved], resolvedCount, unresolvedCount, categoryBreakdown, concerns });

            await new Promise(r => setTimeout(r, 180)); // stagger
        }

        setAnalysisRunning(false);
    };

    /* ─── Render ────────────────────────────────────────────────────── */
    return (
        <div className="flex flex-col h-full min-h-screen bg-gray-50">

            {/* Top bar */}
            <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <span className="text-sm font-bold text-gray-900">BeanHealth AI</span>
                    <span className="text-gray-300 text-sm">·</span>
                    <span className="text-sm text-gray-500 font-medium">Prescription Analysis Engine</span>
                </div>
            </div>

            {/* Three columns */}
            <div className="flex flex-1 overflow-hidden divide-x divide-gray-100">

                {/* ── Column 1: Patients ─────────────────────────────────── */}
                <div className="w-72 flex-shrink-0 flex flex-col bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Patients</p>
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
                            <div className="p-6 text-center text-xs text-gray-400 font-medium">Loading patients...</div>
                        ) : patients.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-400 font-medium">No patients found</div>
                        ) : (
                            patients.map(p => {
                                const isActive = selectedPatient?.id === p.id;
                                const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => selectPatient(p)}
                                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-50 hover:bg-violet-50/50
                                            ${isActive ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0
                                            ${isActive ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                            {initials}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                                            <p className="text-[10px] text-gray-500 font-mono truncate">
                                                {p.mr_number || 'No MR'}{p.age ? ` · ${p.age} yrs` : ''}
                                            </p>
                                        </div>
                                        {isActive && (
                                            <svg className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Column 2: Prescriptions ────────────────────────────── */}
                <div className="w-72 flex-shrink-0 flex flex-col bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {selectedPatient ? `${selectedPatient.name.split(' ')[0]}'s Prescriptions` : 'Prescriptions'}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {!selectedPatient ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center gap-3 h-full">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <p className="text-xs text-gray-400 font-medium">Select a patient<br />to view prescriptions</p>
                            </div>
                        ) : rxLoading ? (
                            <div className="p-6 text-center text-xs text-gray-400 font-medium">Loading prescriptions...</div>
                        ) : prescriptions.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-400 font-medium">No prescriptions found</div>
                        ) : (
                            prescriptions.map((rx, idx) => {
                                const isActive = selectedRx?.id === rx.id;
                                const medCount = Array.isArray(rx.medications) ? rx.medications.length : 0;
                                return (
                                    <button
                                        key={rx.id}
                                        onClick={() => { setSelectedRx(rx); setAnalysisResult(null); }}
                                        className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors border-b border-gray-50 hover:bg-violet-50/50
                                            ${isActive ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                                            ${isActive ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {prescriptions.length - idx}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-gray-900">{formatDate(rx.created_at)}</p>
                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                {medCount} drug{medCount !== 1 ? 's' : ''}
                                                {rx.doctor?.name ? ` · ${rx.doctor.name}` : ''}
                                            </p>
                                            {/* Drug preview chips */}
                                            {medCount > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {(rx.medications as MedItem[]).slice(0, 3).map((m, mi) => (
                                                        <span key={mi} className="text-[9px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                                                            {m.name}
                                                        </span>
                                                    ))}
                                                    {medCount > 3 && (
                                                        <span className="text-[9px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                                                            +{medCount - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {isActive && (
                                            <svg className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── Column 3: Analysis ─────────────────────────────────── */}
                <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analysis</p>
                        {selectedRx && (
                            <button
                                onClick={runAnalysis}
                                disabled={analysisRunning}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                    ${analysisRunning
                                        ? 'bg-violet-100 text-violet-400 cursor-not-allowed'
                                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/25'}`}
                            >
                                {analysisRunning ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Analysing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Analyse
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">

                        {/* Empty states */}
                        {!selectedRx && !analysisResult && (
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

                        {/* Analysis in progress or done */}
                        {analysisResult && (
                            <div className="space-y-4">

                                {/* Prescription context header */}
                                {selectedRx && selectedPatient && (
                                    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{selectedPatient.name}</p>
                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                MR: {selectedPatient.mr_number || 'N/A'} · Rx: {formatDate(selectedRx.created_at)}
                                            </p>
                                        </div>
                                        {!analysisRunning && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                    {analysisResult.resolvedCount} resolved
                                                </span>
                                                {analysisResult.unresolvedCount > 0 && (
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                                        {analysisResult.unresolvedCount} unknown
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Drug cards */}
                                <div className="space-y-2.5">
                                    {analysisResult.drugs.map((drug, idx) => (
                                        <DrugCard key={idx} drug={drug} index={idx} />
                                    ))}
                                </div>

                                {/* Summary — shown only after all resolved */}
                                {!analysisRunning && analysisResult.drugs.every(d => d.status === 'done') && (
                                    <AnalysisSummary result={analysisResult} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── DrugCard ────────────────────────────────────────────────────────── */

const DrugCard: React.FC<{ drug: DrugResolution; index: number }> = ({ drug, index }) => {
    const isPending = drug.status === 'pending';
    const isResolving = drug.status === 'resolving';
    const isDone = drug.status === 'done';

    return (
        <div className={`bg-white rounded-xl border transition-all duration-300
            ${isResolving ? 'border-violet-300 shadow-sm shadow-violet-100' : 'border-gray-100'}
            ${isPending ? 'opacity-40' : 'opacity-100'}`}
        >
            <div className="px-4 py-3 flex items-start gap-3">
                {/* Index bubble */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                    ${isPending ? 'bg-gray-100 text-gray-400' :
                      isResolving ? 'bg-violet-100 text-violet-500' :
                      drug.resolved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {isPending ? index + 1 :
                     isResolving ? (
                         <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                         </svg>
                     ) : drug.resolved ? (
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                         </svg>
                     ) : (
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                     )}
                </div>

                {/* Drug details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{drug.brandInput}</p>
                            {(drug.dosage || drug.frequency || drug.duration) && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                    {[drug.dosage, drug.frequency, drug.duration, drug.timing].filter(Boolean).join(' · ')}
                                </p>
                            )}
                        </div>
                        {isDone && drug.resolved && drug.category && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${categoryColor(drug.category)}`}>
                                {drug.category}
                            </span>
                        )}
                    </div>

                    {/* Resolution line */}
                    {isResolving && (
                        <div className="mt-2 flex items-center gap-1.5">
                            <div className="flex gap-0.5">
                                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                            </div>
                            <span className="text-[10px] text-violet-500 font-medium">Looking up in drug database...</span>
                        </div>
                    )}
                    {isDone && drug.resolved && drug.generic_name && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="text-[11px] font-semibold text-emerald-700">{drug.generic_name}</span>
                        </div>
                    )}
                    {isDone && !drug.resolved && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-[10px] text-amber-600 font-medium">Not in drug database — flagged for review</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─── AnalysisSummary ─────────────────────────────────────────────────── */

const AnalysisSummary: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const categories = Object.entries(result.categoryBreakdown);

    return (
        <div className="space-y-3 pt-2">
            {/* Drug class breakdown */}
            {categories.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Drug Classes Detected</p>
                    <div className="space-y-2">
                        {categories.map(([cat, brands]) => (
                            <div key={cat} className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColor(cat)}`}>
                                    {cat}
                                </span>
                                <span className="text-[10px] text-gray-500">{brands.join(', ')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Clinical concerns */}
            {result.concerns.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Clinical Alerts</p>
                    </div>
                    <ul className="space-y-2">
                        {result.concerns.map((c, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                                <p className="text-[11px] text-amber-800 leading-relaxed">{c}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* All clear */}
            {result.concerns.length === 0 && result.resolvedCount > 0 && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-3 flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[11px] font-semibold text-emerald-700">
                        No clinical concerns detected from current rule set.
                    </p>
                </div>
            )}

            {/* Unresolved notice */}
            {result.unresolvedCount > 0 && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        <span className="font-bold text-gray-700">{result.unresolvedCount} drug{result.unresolvedCount > 1 ? 's' : ''}</span> could not be identified in the database.
                        These have been flagged for curation. Analysis was performed on resolved drugs only.
                    </p>
                </div>
            )}
        </div>
    );
};

export default EnterpriseCKDSnapshotView;
