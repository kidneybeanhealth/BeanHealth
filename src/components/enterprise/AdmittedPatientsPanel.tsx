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
    type AdmittedPatientRecord,
    type ReceptionVisitRecord,
} from '../../services/enterpriseReviewService';

const PrescriptionModalSelector = lazy(() => import('../prescriptions/PrescriptionModalSelector'));

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
    const [deceasedCandidate, setDeceasedCandidate] = useState<AdmittedPatientRecord | null>(null);
    const [rxModalPatient, setRxModalPatient] = useState<AdmittedPatientRecord | null>(null);
    const [rxModalLoading, setRxModalLoading] = useState(false);
    const [rxModalPrescriptions, setRxModalPrescriptions] = useState<ReceptionVisitRecord[]>([]);
    const [selectedRx, setSelectedRx] = useState<ReceptionVisitRecord | null>(null);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

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

    const handleConfirmDischarge = async () => {
        if (!dischargeCandidate) return;
        const { queueId, patient } = dischargeCandidate;
        setDischargeCandidate(null);
        const toastId = toast.loading('Discharging patient...');
        try {
            await dischargePatient({ queueId, hospitalId });
            toast.success(`${patient.name} discharged`, { id: toastId });
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
                        className="w-full sm:w-72 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />
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
                                            onClick={() => setDischargeCandidate(record)}
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

            {/* Discharge confirm */}
            <TwoStepConfirmModal
                isOpen={Boolean(dischargeCandidate)}
                title="Discharge this patient?"
                description={dischargeCandidate ? `${dischargeCandidate.patient.name} will be marked as discharged and removed from the Admitted Patients list.` : ''}
                continueLabel="Continue"
                confirmLabel="Yes, Discharge"
                onCancel={() => setDischargeCandidate(null)}
                onConfirm={handleConfirmDischarge}
            />

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
