/**
 * AdmittedPatientsPanel
 *
 * Shared panel used by the Reception dashboard and the
 * Enterprise Doctor dashboard to list currently-admitted
 * patients (patients admitted directly from the live queue,
 * skipping the prescription flow).
 *
 * Capabilities:
 *   - Search by name / MR / phone
 *   - View past prescriptions (opens modal via onViewPrescription)
 *   - Prescribe (doctor dashboard only — opens prescribe flow via onPrescribe)
 *   - Discharge (ends admission, row drops out of this list but
 *     remains in Past Records)
 */
import React, { useCallback, useEffect, useState, Suspense, lazy } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import TwoStepConfirmModal from '../common/TwoStepConfirmModal';
import {
    fetchAdmittedPatients,
    dischargePatient,
    markPatientDeceased,
    fetchPatientPrescriptions,
    admitPatientDirectly,
    fetchPatientPendingReviews,
    type AdmittedPatientRecord,
    type ReceptionVisitRecord,
    type PendingReviewInfo,
} from '../../services/enterpriseReviewService';

const PrescriptionModalSelector = lazy(() => import('../prescriptions/PrescriptionModalSelector'));

interface PatientSearchResult {
    id: string;
    name: string;
    age: number | null;
    gender?: string | null;
    mr_number: string | null;
    father_husband_name?: string | null;
    phone?: string | null;
}

export interface AdmittedPrescribeContext {
    queueId: string;
    patientId: string;
    tokenNumber: string | null;
    patient: AdmittedPatientRecord['patient'];
}

interface AdmittedPatientsPanelProps {
    hospitalId: string;
    /** Doctor profile passed from the parent — used for PrescriptionModalSelector header/print. */
    doctor?: any;
    /** When provided, only admissions for this doctor are shown. */
    doctorId?: string | null;
    /** Whether to show the Prescribe action (only doctor dashboard). */
    enablePrescribe?: boolean;
    /** Whether to show Mark Deceased action (reception dashboard only). */
    enableMarkDeceased?: boolean;
    /** Invoked when user clicks Prescribe for an admitted patient. */
    onPrescribe?: (ctx: AdmittedPrescribeContext) => void;
}

const formatAdmittedAt = (value?: string | null): string => {
    if (!value) return '--';
    const d = new Date(value);
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const AdmittedPatientsPanel: React.FC<AdmittedPatientsPanelProps> = ({
    hospitalId,
    doctor,
    doctorId,
    enablePrescribe = false,
    enableMarkDeceased = false,
    onPrescribe,
}) => {
    const [records, setRecords] = useState<AdmittedPatientRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [dischargeCandidate, setDischargeCandidate] = useState<AdmittedPatientRecord | null>(null);
    const [dischargeStep, setDischargeStep] = useState<1 | 2>(1);
    const [dischargeReviewDate, setDischargeReviewDate] = useState('');
    const [dischargeConfirmReady, setDischargeConfirmReady] = useState(false);
    const [deceasedCandidate, setDeceasedCandidate] = useState<AdmittedPatientRecord | null>(null);
    const [rxModalPatient, setRxModalPatient] = useState<AdmittedPatientRecord | null>(null);
    const [rxModalLoading, setRxModalLoading] = useState(false);
    const [rxModalPrescriptions, setRxModalPrescriptions] = useState<ReceptionVisitRecord[]>([]);
    const [selectedRx, setSelectedRx] = useState<ReceptionVisitRecord | null>(null);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

    // Add Patient modal
    const [showAddPatient, setShowAddPatient] = useState(false);
    const [addSearch, setAddSearch] = useState('');
    const [addDebouncedSearch, setAddDebouncedSearch] = useState('');
    const [addResults, setAddResults] = useState<PatientSearchResult[]>([]);
    const [addSearching, setAddSearching] = useState(false);
    const [addCandidate, setAddCandidate] = useState<PatientSearchResult | null>(null);
    const [addPendingReviews, setAddPendingReviews] = useState<PendingReviewInfo[]>([]);
    const [addReviewsLoading, setAddReviewsLoading] = useState(false);
    const [addConfirming, setAddConfirming] = useState(false);

    // Debounce search input
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
        return () => window.clearTimeout(t);
    }, [searchQuery]);

    // Fetch hospital logo from users.avatar_url (same query used by EnterpriseDoctorDashboard)
    useEffect(() => {
        if (!hospitalId) return;
        (async () => {
            try {
                const { data } = await (supabase.from('users') as any)
                    .select('avatar_url')
                    .eq('id', hospitalId)
                    .single();
                if (data?.avatar_url) setHospitalLogo(data.avatar_url);
            } catch {
                // non-critical — modal will fall back to default logo
            }
        })();
    }, [hospitalId]);

    const loadRecords = useCallback(async () => {
        if (!hospitalId) return;
        setLoading(true);
        try {
            const data = await fetchAdmittedPatients({
                hospitalId,
                doctorId: doctorId || undefined,
                searchQuery: debouncedQuery || undefined,
            });
            setRecords(data);
        } catch (err) {
            console.error('[AdmittedPatientsPanel] fetch failed', err);
            toast.error('Could not load admitted patients');
        } finally {
            setLoading(false);
        }
    }, [hospitalId, doctorId, debouncedQuery]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const openDischargeFlow = (record: AdmittedPatientRecord) => {
        setDischargeCandidate(record);
        setDischargeStep(1);
        setDischargeReviewDate('');
        setDischargeConfirmReady(false);
    };

    // When step 2 opens, unlock the confirm button after 1s (same safety delay as TwoStepConfirmModal)
    useEffect(() => {
        if (!dischargeCandidate || dischargeStep !== 2) return;
        setDischargeConfirmReady(false);
        const t = window.setTimeout(() => setDischargeConfirmReady(true), 1000);
        return () => window.clearTimeout(t);
    }, [dischargeCandidate, dischargeStep]);

    const handleConfirmDischarge = async () => {
        if (!dischargeCandidate) return;
        const { queueId, patient, patientId } = dischargeCandidate;
        const reviewDate = dischargeReviewDate.trim();
        setDischargeCandidate(null);
        const toastId = toast.loading('Discharging patient...');
        try {
            await dischargePatient({ queueId, hospitalId });
            // Schedule a follow-up review if a date was chosen
            if (reviewDate) {
                try {
                    await (supabase.from('hospital_patient_reviews' as any) as any).insert({
                        hospital_id: hospitalId,
                        patient_id: patientId,
                        next_review_date: reviewDate,
                        status: 'pending',
                    });
                } catch (reviewErr) {
                    console.error('[AdmittedPatientsPanel] review schedule failed', reviewErr);
                    // Non-fatal — discharge still succeeded
                }
            }
            toast.success(
                reviewDate
                    ? `${patient.name} discharged · Review scheduled for ${new Date(reviewDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : `${patient.name} discharged`,
                { id: toastId }
            );
            loadRecords();
        } catch (err) {
            console.error('[AdmittedPatientsPanel] discharge failed', err);
            toast.error('Could not discharge patient', { id: toastId });
        }
    };

    const handleConfirmDeceased = async () => {
        if (!deceasedCandidate) return;
        const { queueId, patient } = deceasedCandidate;
        setDeceasedCandidate(null);
        const toastId = toast.loading('Marking patient as deceased...');
        try {
            await markPatientDeceased({
                queueId,
                hospitalId,
                patientId: patient.id,
            });
            toast.success(`${patient.name} marked as deceased`, { id: toastId });
            loadRecords();
        } catch (err) {
            console.error('[AdmittedPatientsPanel] mark deceased failed', err);
            toast.error('Could not mark patient as deceased', { id: toastId });
        }
    };

    const openRxModal = async (record: AdmittedPatientRecord) => {
        setRxModalPatient(record);
        setRxModalPrescriptions([]);
        setRxModalLoading(true);
        try {
            const rxs = await fetchPatientPrescriptions(hospitalId, record.patient.id);
            setRxModalPrescriptions(rxs);
        } catch (err) {
            console.error('[AdmittedPatientsPanel] rx fetch failed', err);
            toast.error('Could not load prescriptions');
        } finally {
            setRxModalLoading(false);
        }
    };

    const handleRxRowClick = (rx: ReceptionVisitRecord) => {
        setSelectedRx(rx);
    };

    // ── Add Patient modal logic ────────────────────────────────────────
    useEffect(() => {
        const t = window.setTimeout(() => setAddDebouncedSearch(addSearch.trim()), 350);
        return () => window.clearTimeout(t);
    }, [addSearch]);

    useEffect(() => {
        if (!showAddPatient) return;
        if (!addDebouncedSearch) { setAddResults([]); return; }
        (async () => {
            setAddSearching(true);
            try {
                const { data } = await (supabase.from('hospital_patients') as any)
                    .select('id, name, age, gender, mr_number, father_husband_name, phone')
                    .eq('hospital_id', hospitalId)
                    .or(`name.ilike.%${addDebouncedSearch}%,mr_number.ilike.%${addDebouncedSearch}%`)
                    .order('name', { ascending: true })
                    .limit(20);
                setAddResults((data || []) as PatientSearchResult[]);
            } catch { /* non-critical */ }
            finally { setAddSearching(false); }
        })();
    }, [addDebouncedSearch, hospitalId, showAddPatient]);

    const selectAddCandidate = async (p: PatientSearchResult) => {
        setAddCandidate(p);
        setAddPendingReviews([]);
        setAddReviewsLoading(true);
        try {
            const reviews = await fetchPatientPendingReviews(hospitalId, p.id);
            setAddPendingReviews(reviews);
        } catch { /* non-critical */ }
        finally { setAddReviewsLoading(false); }
    };

    const resetAddPatientModal = () => {
        setShowAddPatient(false);
        setAddSearch('');
        setAddDebouncedSearch('');
        setAddResults([]);
        setAddCandidate(null);
        setAddPendingReviews([]);
    };

    const handleConfirmAddPatient = async () => {
        if (!addCandidate || addConfirming) return;
        setAddConfirming(true);
        const toastId = toast.loading('Admitting patient…');
        try {
            await admitPatientDirectly({ hospitalId, patientId: addCandidate.id });
            toast.success(`${addCandidate.name} admitted`, { id: toastId });
            resetAddPatientModal();
            loadRecords();
        } catch (err: any) {
            toast.error(err?.message || 'Could not admit patient', { id: toastId });
        } finally {
            setAddConfirming(false);
        }
    };

    const handlePrescribeClick = (record: AdmittedPatientRecord) => {
        if (!onPrescribe) return;
        onPrescribe({
            queueId: record.queueId,
            patientId: record.patientId,
            tokenNumber: record.tokenNumber,
            patient: record.patient,
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header / search */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" transform="rotate(180 12 12)" />
                    </svg>
                    <h3 className="text-sm font-bold text-gray-800">Admitted Patients</h3>
                    <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-200">
                        {records.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search name / MR / phone"
                        className="w-full sm:w-64 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />
                    <button
                        onClick={() => setShowAddPatient(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm whitespace-nowrap"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Patient
                    </button>
                    <button
                        onClick={loadRecords}
                        className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                        title="Refresh"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="p-10 text-center text-gray-500 text-sm font-medium">Loading...</div>
            ) : records.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm font-medium">No admitted patients</div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {records.map(record => {
                        const p = record.patient;
                        const relationLabel = p.gender === 'Female' ? 'W/o' : 'S/o';
                        return (
                            <div key={record.queueId} className="px-4 sm:px-6 py-4 hover:bg-gray-50/60 transition-colors">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="text-base font-bold text-gray-900">{p.name}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                                                Admitted
                                            </span>
                                            <span className="text-xs font-medium text-gray-500">
                                                Admitted: {formatAdmittedAt(record.admittedAt)}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                                            <span>Age: <span className="font-semibold text-gray-800">{p.age ?? '--'}</span></span>
                                            {p.father_husband_name && (
                                                <span>{relationLabel}: <span className="font-semibold text-gray-800">{p.father_husband_name}</span></span>
                                            )}
                                            <span>MR: <span className="font-mono font-bold text-gray-900">{p.mr_number || 'N/A'}</span></span>
                                            {record.doctorName && (
                                                <span>Doctor: <span className="font-semibold text-gray-800">{record.doctorName}</span></span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                                        <button
                                            onClick={() => openRxModal(record)}
                                            className="px-3 py-2 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg"
                                        >
                                            View Rx
                                        </button>
                                        {enablePrescribe && (
                                            <button
                                                onClick={() => handlePrescribeClick(record)}
                                                className="px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg"
                                            >
                                                Prescribe
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openDischargeFlow(record)}
                                            className="px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                                        >
                                            Discharge
                                        </button>
                                        {enableMarkDeceased && (
                                            <button
                                                onClick={() => setDeceasedCandidate(record)}
                                                className="px-3 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg"
                                            >
                                                Mark Deceased
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Discharge flow — custom multi-step modal */}
            {dischargeCandidate && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">

                        {/* Step 1 — Schedule review */}
                        {dischargeStep === 1 && (
                            <>
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <h3 className="text-base font-bold text-gray-900">Discharge patient</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{dischargeCandidate.patient.name} · MR {dischargeCandidate.patient.mr_number || 'N/A'}</p>
                                </div>
                                <div className="px-5 py-5 space-y-4">
                                    <p className="text-sm text-gray-700 font-medium">Would you like to schedule a follow-up review?</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Setting a review date will add this patient back into Past Records tracking so they don't fall out of the follow-up loop. This is optional.
                                    </p>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Review Date <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
                                        <input
                                            type="date"
                                            value={dischargeReviewDate}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={e => setDischargeReviewDate(e.target.value)}
                                            className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-200 bg-gray-50"
                                        />
                                        {dischargeReviewDate && (
                                            <p className="mt-1.5 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                Review on {new Date(dischargeReviewDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => setDischargeCandidate(null)}
                                        className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                                    >
                                        Cancel
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {dischargeReviewDate ? (
                                            <button
                                                onClick={() => { setDischargeReviewDate(''); setDischargeStep(2); }}
                                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                                            >
                                                Skip review
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setDischargeStep(2)}
                                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                                            >
                                                Continue without review
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDischargeStep(2)}
                                            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                                        >
                                            Continue
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Step 2 — Confirm summary */}
                        {dischargeStep === 2 && (
                            <>
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <h3 className="text-base font-bold text-gray-900">Please confirm once more</h3>
                                </div>
                                <div className="px-5 py-5 space-y-3">
                                    {/* Patient summary */}
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                                        <p className="text-sm font-bold text-gray-900">{dischargeCandidate.patient.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">MR: {dischargeCandidate.patient.mr_number || 'N/A'} · Age {dischargeCandidate.patient.age}</p>
                                    </div>

                                    {/* Review date confirmation */}
                                    {dischargeReviewDate ? (
                                        <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-3 flex items-start gap-3">
                                            <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-800">Follow-up review scheduled</p>
                                                <p className="text-sm font-bold text-emerald-900 mt-0.5">
                                                    {new Date(dischargeReviewDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                                </p>
                                                <p className="text-xs text-emerald-600 mt-0.5">Patient will appear in Past Records tracking after discharge.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2.5">
                                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-xs text-gray-500">No review scheduled — patient will be discharged without a follow-up date.</p>
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-400">This action was rechecked for safety.</p>
                                </div>
                                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => setDischargeStep(1)}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleConfirmDischarge}
                                        disabled={!dischargeConfirmReady}
                                        className="px-5 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {dischargeConfirmReady ? 'Yes, Discharge' : 'Confirming…'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Deceased confirm */}
            <TwoStepConfirmModal
                isOpen={Boolean(deceasedCandidate)}
                title="Mark this patient as deceased?"
                description={deceasedCandidate ? `${deceasedCandidate.patient.name} will be marked as deceased, upcoming reviews will be cancelled, and this patient will be removed from Admitted Patients.` : ''}
                continueLabel="Continue"
                confirmLabel="Yes, Mark Deceased"
                onCancel={() => setDeceasedCandidate(null)}
                onConfirm={handleConfirmDeceased}
            />

            {/* View Rx — prescription list modal */}
            {rxModalPatient && !selectedRx && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Past Prescriptions</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{rxModalPatient.patient.name} · MR {rxModalPatient.patient.mr_number || 'N/A'}</p>
                            </div>
                            <button
                                onClick={() => setRxModalPatient(null)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {rxModalLoading ? (
                                <div className="text-center py-8 text-gray-500 text-sm">Loading prescriptions...</div>
                            ) : rxModalPrescriptions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">No prescriptions found</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {rxModalPrescriptions.map(rx => {
                                        const date = rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
                                        const medCount = Array.isArray(rx.medications) ? rx.medications.length : 0;
                                        return (
                                            <li
                                                key={rx.id}
                                                className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors"
                                                onClick={() => handleRxRowClick(rx)}
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-gray-900">{date}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {rx.doctor?.name ? `By ${rx.doctor.name}` : 'Doctor —'}
                                                        {medCount > 0 ? ` · ${medCount} med${medCount !== 1 ? 's' : ''}` : ''}
                                                    </div>
                                                </div>
                                                <span className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg whitespace-nowrap flex-shrink-0">
                                                    View →
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Patient modal */}
            {showAddPatient && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) resetAddPatientModal(); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

                        {/* Modal header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Add Patient to Admitted</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Search from past records by name or MR number</p>
                            </div>
                            <button onClick={resetAddPatientModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* Search input */}
                            <div className="px-5 pt-4 pb-3">
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={addSearch}
                                        onChange={e => { setAddSearch(e.target.value); setAddCandidate(null); }}
                                        placeholder="Type name or MR number…"
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                                    />
                                    {addSearching && (
                                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Search results */}
                            {!addCandidate && (
                                <div className="px-3 pb-3">
                                    {!addDebouncedSearch ? (
                                        <p className="text-center text-sm text-gray-400 py-8">Start typing to search patients</p>
                                    ) : addResults.length === 0 && !addSearching ? (
                                        <p className="text-center text-sm text-gray-400 py-8">No patients found</p>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {addResults.map(p => {
                                                const rel = p.gender === 'Female' ? 'W/o' : 'S/o';
                                                return (
                                                    <li key={p.id}>
                                                        <button
                                                            onClick={() => selectAddCandidate(p)}
                                                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-between gap-3"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                                                                <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                                                                    <span>MR: <span className="font-mono font-semibold text-gray-700">{p.mr_number || 'N/A'}</span></span>
                                                                    {p.age && <span>Age {p.age}</span>}
                                                                    {p.father_husband_name && <span>{rel} {p.father_husband_name}</span>}
                                                                </p>
                                                            </div>
                                                            <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {/* Confirmation panel — shown after a patient is selected */}
                            {addCandidate && (
                                <div className="px-5 pb-5 space-y-4">
                                    {/* Back */}
                                    <button
                                        onClick={() => setAddCandidate(null)}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to search
                                    </button>

                                    {/* Patient card */}
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-black text-sm flex-shrink-0">
                                                {addCandidate.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900">{addCandidate.name}</p>
                                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600 mt-1">
                                                    <span>MR: <span className="font-mono font-bold text-gray-900">{addCandidate.mr_number || 'N/A'}</span></span>
                                                    {addCandidate.age && <span>Age {addCandidate.age}</span>}
                                                    {addCandidate.father_husband_name && (
                                                        <span>{addCandidate.gender === 'Female' ? 'W/o' : 'S/o'} {addCandidate.father_husband_name}</span>
                                                    )}
                                                    {addCandidate.phone && <span>{addCandidate.phone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pending reviews section */}
                                    {addReviewsLoading ? (
                                        <div className="text-xs text-gray-400 text-center py-2">Checking scheduled reviews…</div>
                                    ) : addPendingReviews.length > 0 ? (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <p className="text-xs font-bold text-amber-800">
                                                    {addPendingReviews.length} scheduled review{addPendingReviews.length !== 1 ? 's' : ''} will be cancelled
                                                </p>
                                            </div>
                                            <ul className="space-y-1 pl-6">
                                                {addPendingReviews.map(r => (
                                                    <li key={r.id} className="text-xs text-amber-700 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                                        {r.next_review_date
                                                            ? new Date(r.next_review_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : 'Date TBD'}
                                                        <span className="capitalize text-amber-500">({r.status})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-[11px] text-amber-600 pl-6">
                                                These will be automatically cancelled when you confirm admission.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-xs font-medium text-emerald-700">No scheduled reviews — patient can be admitted directly.</p>
                                        </div>
                                    )}

                                    {/* Confirm button */}
                                    <button
                                        onClick={handleConfirmAddPatient}
                                        disabled={addConfirming || addReviewsLoading}
                                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${addConfirming || addReviewsLoading ? 'bg-rose-200 text-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/25'}`}
                                    >
                                        {addConfirming ? (
                                            <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Admitting…</>
                                        ) : addPendingReviews.length > 0 ? (
                                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" transform="rotate(180 12 12)" /></svg>Cancel Reviews &amp; Admit Patient</>
                                        ) : (
                                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" transform="rotate(180 12 12)" /></svg>Confirm Admission</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Full prescription modal — read-only, exact same as Past Records view */}
            {selectedRx && rxModalPatient && (
                <Suspense fallback={null}>
                    <PrescriptionModalSelector
                        doctor={
                            doctor ||
                            (selectedRx.doctor
                                ? { id: selectedRx.doctor.id, name: selectedRx.doctor.name, specialty: selectedRx.doctor.specialty, hospital_id: hospitalId, signature_url: selectedRx.doctor.signature_url }
                                : { id: '', name: 'Doctor', specialty: '', hospital_id: hospitalId })
                        }
                        patient={{
                            id: rxModalPatient.patient.id,
                            name: rxModalPatient.patient.name,
                            age: rxModalPatient.patient.age,
                            token_number: rxModalPatient.tokenNumber || selectedRx.token_number || '',
                            mr_number: rxModalPatient.patient.mr_number,
                        }}
                        onClose={() => setSelectedRx(null)}
                        readOnly={true}
                        forcePrint={true}
                        existingData={selectedRx}
                        clinicLogo={hospitalLogo || undefined}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default AdmittedPatientsPanel;
