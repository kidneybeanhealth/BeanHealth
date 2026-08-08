import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
    fetchPatientAdmissionEvents,
    fetchAllPatientPrescriptions,
    type PatientAdmissionEvent,
    type ReceptionVisitRecord,
} from '../../services/enterpriseReviewService';

const PrescriptionModalSelector = lazy(() => import('../prescriptions/PrescriptionModalSelector'));
const DischargeCardModal = lazy(() => import('./DischargeCardModal'));

interface VisitJourneyModalProps {
    hospitalId: string;
    patient: any;
    /**
     * Initial prescription list (typically what's already loaded in the parent
     * past-records query). Used as a fast first paint while we fetch the full,
     * un-truncated history per-patient in the background.
     */
    prescriptions: ReceptionVisitRecord[];
    clinicLogo?: string;
    /** Optional Edit & Resend handler — shown for prescriptions and discharge cards. */
    onEditResend?: (rx: ReceptionVisitRecord) => void;
    onClose: () => void;
}

type EventType = 'prescription' | 'discharge_card' | 'admitted' | 'discharged' | 'deceased';

interface JourneyEvent {
    id: string;
    date: string;
    type: EventType;
    /** For prescription / discharge_card events. */
    prescription?: ReceptionVisitRecord;
    /** For admission events. */
    admission?: PatientAdmissionEvent;
    /** Doctor display name when available. */
    doctorName?: string | null;
}

const isDischargeCardRx = (rx: ReceptionVisitRecord) => {
    const docType = (rx?.metadata as any)?.documentType;
    if (docType === 'discharge_card') return true;
    return typeof rx?.notes === 'string' && rx.notes.startsWith('DocType: discharge_card');
};

const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ''; }
};

const formatTime = (iso: string | null) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
};

const VisitJourneyModal: React.FC<VisitJourneyModalProps> = ({
    hospitalId,
    patient,
    prescriptions,
    clinicLogo,
    onEditResend,
    onClose,
}) => {
    const [admissions, setAdmissions] = useState<PatientAdmissionEvent[]>([]);
    const [loadingAdmissions, setLoadingAdmissions] = useState(true);
    // Fresh full prescription history fetched per-patient (bypasses any truncation
    // from the parent past-records list query).
    const [fullPrescriptions, setFullPrescriptions] = useState<ReceptionVisitRecord[] | null>(null);
    const [loadingPrescriptions, setLoadingPrescriptions] = useState(true);
    const [activeRx, setActiveRx] = useState<ReceptionVisitRecord | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoadingAdmissions(true);
        fetchPatientAdmissionEvents(hospitalId, patient.id)
            .then(events => { if (mounted) setAdmissions(events); })
            .catch(() => { if (mounted) setAdmissions([]); })
            .finally(() => { if (mounted) setLoadingAdmissions(false); });
        return () => { mounted = false; };
    }, [hospitalId, patient?.id]);

    useEffect(() => {
        let mounted = true;
        setLoadingPrescriptions(true);
        fetchAllPatientPrescriptions(hospitalId, patient.id)
            .then(rxs => { if (mounted) setFullPrescriptions(rxs); })
            .catch(() => { if (mounted) setFullPrescriptions(null); })
            .finally(() => { if (mounted) setLoadingPrescriptions(false); });
        return () => { mounted = false; };
    }, [hospitalId, patient?.id]);

    const effectivePrescriptions = fullPrescriptions ?? prescriptions ?? [];

    const events = useMemo<JourneyEvent[]>(() => {
        const list: JourneyEvent[] = [];

        // Prescriptions + discharge cards
        for (const rx of effectivePrescriptions || []) {
            const isDC = isDischargeCardRx(rx);
            list.push({
                id: `rx-${rx.id}`,
                date: rx.created_at,
                type: isDC ? 'discharge_card' : 'prescription',
                prescription: rx,
                doctorName: rx.doctor?.name || null,
            });
        }

        // Admission events — one event for admitted, one for discharged (if applicable)
        for (const adm of admissions) {
            if (adm.admittedAt) {
                list.push({
                    id: `adm-${adm.queueId}`,
                    date: adm.admittedAt,
                    type: 'admitted',
                    admission: adm,
                });
            }
            if (adm.dischargedAt) {
                list.push({
                    id: `dis-${adm.queueId}`,
                    date: adm.dischargedAt,
                    type: adm.admissionStatus === 'deceased' ? 'deceased' : 'discharged',
                    admission: adm,
                });
            }
        }

        // Newest first
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [effectivePrescriptions, admissions]);

    const getBadge = (type: EventType) => {
        switch (type) {
            case 'prescription':
                return { label: 'Prescription', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
            case 'discharge_card':
                return { label: 'Discharge Card', cls: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' };
            case 'admitted':
                return { label: 'Admitted', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
            case 'discharged':
                return { label: 'Discharged', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
            case 'deceased':
                return { label: 'Deceased', cls: 'bg-gray-100 text-gray-700 border-gray-300', dot: 'bg-gray-500' };
        }
    };

    const handleOpenRx = (rx: ReceptionVisitRecord) => setActiveRx(rx);
    const handleCloseRx = () => setActiveRx(null);

    const activeRxIsDischargeCard = activeRx ? isDischargeCardRx(activeRx) : false;

    return (
        <>
            <div
                className="fixed inset-0 z-[97] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
                style={{ display: activeRx ? 'none' : undefined }}
            >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[88vh] flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-orange-50 to-white">
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900">Visit History</h3>
                            <p className="text-sm text-gray-500 mt-0.5 truncate">
                                {patient?.name}
                                {patient?.mr_number ? ` · ${patient.mr_number}` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                            aria-label="Close"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto flex-1">
                        {(loadingPrescriptions || loadingAdmissions) && events.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">Loading visit history…</p>
                        ) : events.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No visit history found for this patient.</p>
                        ) : (
                            <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
                                {events.map(ev => {
                                    const badge = getBadge(ev.type);
                                    const isRxLike = ev.type === 'prescription' || ev.type === 'discharge_card';
                                    return (
                                        <li key={ev.id} className="ml-5">
                                            <span className={`absolute -left-[7px] flex items-center justify-center w-3 h-3 rounded-full ring-4 ring-white ${badge.dot}`} />
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded ${badge.cls}`}>
                                                            {badge.label}
                                                        </span>
                                                        <span className="text-sm font-semibold text-gray-800">
                                                            {formatDate(ev.date)}
                                                            <span className="text-gray-400 font-normal ml-1.5">{formatTime(ev.date)}</span>
                                                        </span>
                                                    </div>
                                                    {ev.doctorName && (
                                                        <p className="text-xs text-gray-500 mt-1 truncate">By {ev.doctorName}</p>
                                                    )}
                                                    {isRxLike && Array.isArray(ev.prescription?.medications) && ev.prescription!.medications!.length > 0 && (
                                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                                            💊 {ev.prescription!.medications!.slice(0, 3).map((m: any) => m?.name || '').filter(Boolean).join(', ')}
                                                            {ev.prescription!.medications!.length > 3 ? ` +${ev.prescription!.medications!.length - 3} more` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                {isRxLike && ev.prescription && (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenRx(ev.prescription!)}
                                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                                                ev.type === 'discharge_card'
                                                                    ? 'border-purple-200 text-purple-700 hover:bg-purple-50'
                                                                    : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                                                            }`}
                                                        >
                                                            {ev.type === 'discharge_card' ? 'View Discharge Card' : 'View Rx'}
                                                        </button>
                                                        {onEditResend && (ev.type === 'prescription' || ev.type === 'discharge_card') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onEditResend(ev.prescription!)}
                                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                                                            >
                                                                Edit & Resend
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl font-semibold text-sm text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {activeRx && (
                <Suspense fallback={null}>
                    {activeRxIsDischargeCard ? (
                        <DischargeCardModal
                            doctor={activeRx.doctor || {}}
                            patient={{
                                ...patient,
                                // A discharge card has no OP token; the patient-level
                                // fallback would surface one from an earlier visit.
                                token_number: '',
                            }}
                            onClose={handleCloseRx}
                            readOnly
                            forcePrint
                            existingData={activeRx}
                            clinicLogo={clinicLogo}
                            actorAttribution={
                                (activeRx as any).metadata?.actorType
                                    ? {
                                        actorType: (activeRx as any).metadata.actorType,
                                        actorDisplayName: (activeRx as any).metadata.actorDisplayName,
                                    }
                                    : undefined
                            }
                        />
                    ) : (
                        <PrescriptionModalSelector
                            doctor={activeRx.doctor || {}}
                            patient={{
                                ...patient,
                                token_number: activeRx.token_number || patient?.token_number,
                            }}
                            onClose={handleCloseRx}
                            readOnly
                            forcePrint
                            existingData={activeRx}
                            clinicLogo={clinicLogo}
                            actorAttribution={
                                (activeRx as any).metadata?.actorType
                                    ? {
                                        actorType: (activeRx as any).metadata.actorType,
                                        actorDisplayName: (activeRx as any).metadata.actorDisplayName,
                                    }
                                    : undefined
                            }
                        />
                    )}
                </Suspense>
            )}
        </>
    );
};

export default VisitJourneyModal;
