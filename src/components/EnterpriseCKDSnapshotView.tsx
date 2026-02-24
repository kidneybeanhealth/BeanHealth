import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Patient, EnhancedMedication, CaseDetails, Vitals, Medication } from '../types';
import { LabTrendData, VisitRecord, VISIT_COLORS } from '../types/visitHistory';
import NephrologistSnapshot from './NephrologistSnapshot';
import LabTrendGraph from './LabTrendGraph';
import VisitCard from './VisitCard';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
}

interface HospitalPatient {
    id: string;
    name: string;
    age: number;
    token_number: string;
    phone?: string;
    address?: string;
    created_at?: string;
}

interface Prescription {
    id: string;
    created_at: string;
    medications: any[];
    notes?: string;
    status?: string;
}

interface PatientWithData extends HospitalPatient {
    prescriptions: Prescription[];
    lastVisit?: string;
}

type ActiveSection = 'snapshot' | 'visits' | 'labs';

interface EnterpriseCKDSnapshotViewProps {
    doctor: DoctorProfile;
    onBack: () => void;
}

// Helper to format doctor name professionally
const formatDoctorName = (name: string) => {
    if (!name) return "";
    // Remove existing Dr prefix and any trailing dots/spaces
    let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
    // Fix initials formatting (e.g., A.Divakar -> A. Divakar)
    cleanName = cleanName.replace(/([A-Z])\.(\S)/g, "$1. $2");
    return `Dr. ${cleanName}`;
};

const EnterpriseCKDSnapshotView: React.FC<EnterpriseCKDSnapshotViewProps> = ({ doctor, onBack }) => {
    const [patients, setPatients] = useState<PatientWithData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<Record<string, ActiveSection>>({});

    useEffect(() => {
        fetchPatients();
    }, [doctor.id]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            // Explicitly type the response to avoid 'any' if possible, or cast appropriately
            const { data: queueData, error: queueError } = await supabase
                .from('hospital_queues' as any)
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*)
                `)
                .eq('doctor_id', doctor.id)
                .eq('status', 'completed')
                .order('updated_at', { ascending: false });

            if (queueError) throw queueError;

            const patientMap = new Map<string, PatientWithData>();

            // Safely iterate assuming queueData is any[] to avoid strict type issues with 'never'
            const queues = queueData || [];
            for (const queue of queues) {
                if (queue.patient && !patientMap.has(queue.patient.id)) {
                    patientMap.set(queue.patient.id, {
                        ...queue.patient,
                        prescriptions: [],
                        lastVisit: queue.updated_at || queue.created_at
                    });
                }
            }

            const patientIds = Array.from(patientMap.keys());
            if (patientIds.length > 0) {
                const { data: prescriptionData, error: rxError } = await supabase
                    .from('hospital_prescriptions' as any)
                    .select('*')
                    .eq('doctor_id', doctor.id)
                    .in('patient_id', patientIds)
                    .order('created_at', { ascending: false });

                if (!rxError && prescriptionData) {
                    for (const rx of (prescriptionData as any[])) {
                        const patient = patientMap.get(rx.patient_id);
                        if (patient) {
                            patient.prescriptions.push(rx);
                        }
                    }
                }
            }

            setPatients(Array.from(patientMap.values()));
        } catch (error) {
            console.error('Error fetching patients:', error);
            toast.error('Failed to load patients');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (patientId: string) => {
        if (expandedPatient === patientId) {
            setExpandedPatient(null);
        } else {
            setExpandedPatient(patientId);
            if (!activeSection[patientId]) {
                setActiveSection(prev => ({ ...prev, [patientId]: 'snapshot' }));
            }
        }
    };

    const getActiveSection = (patientId: string): ActiveSection => {
        return activeSection[patientId] || 'snapshot';
    };

    const setPatientSection = (patientId: string, section: ActiveSection) => {
        setActiveSection(prev => ({ ...prev, [patientId]: section }));
    };

    // Convert hospital patient to Patient type
    const convertToPatient = (hospitalPatient: PatientWithData): Patient => {
        const defaultVitals: Vitals = {
            bloodPressure: { value: '--/--', unit: 'mmHg' },
            heartRate: { value: '--', unit: 'bpm' },
            temperature: { value: '--', unit: '°F' }
        };

        const medications: Medication[] = hospitalPatient.prescriptions
            .flatMap(rx => rx.medications || [])
            .slice(0, 5)
            .map((med, idx) => ({
                id: `med-${idx}`,
                name: med.name || med.medication_name || 'Unknown',
                dosage: med.dosage || '',
                frequency: med.frequency || 'as prescribed'
            }));

        return {
            id: hospitalPatient.id,
            name: hospitalPatient.name,
            email: hospitalPatient.phone || `patient-${hospitalPatient.token_number}@hospital.local`,
            role: 'patient' as const,
            dateOfBirth: '',
            condition: 'CKD Monitoring',
            vitals: defaultVitals,
            vitalsHistory: [],
            medications,
            records: [],
            doctors: [],
            chatMessages: [],
            subscriptionTier: 'FreeTrial' as const,
            urgentCredits: 0,
            patientId: hospitalPatient.token_number,
            patient_id: hospitalPatient.id
        };
    };

    // Convert to EnhancedMedication
    const convertToEnhancedMedications = (hospitalPatient: PatientWithData): EnhancedMedication[] => {
        return hospitalPatient.prescriptions
            .flatMap(rx => rx.medications || [])
            .map((med, idx) => ({
                id: `med-${hospitalPatient.id}-${idx}`,
                patientId: hospitalPatient.id,
                name: med.name || med.medication_name || 'Unknown',
                dosage: med.dosage || '',
                dosageUnit: 'mg',
                frequency: 'once_daily' as const,
                scheduledTimes: ['09:00'],
                startDate: new Date().toISOString(),
                isActive: true,
                reminderEnabled: false,
                source: 'doctor_prescribed' as const
            }));
    };

    // Create case details
    const createCaseDetails = (hospitalPatient: PatientWithData): CaseDetails | null => {
        if (hospitalPatient.prescriptions.length === 0) return null;
        const latestRx = hospitalPatient.prescriptions[0];
        return {
            id: `case-${hospitalPatient.id}`,
            patientId: hospitalPatient.id,
            primaryCondition: 'CKD Monitoring',
            latestComplaint: latestRx.notes || 'Regular checkup',
            medicalHistory: []
        };
    };

    // Convert prescriptions to VisitRecord for visit cards
    const convertToVisitRecords = (hospitalPatient: PatientWithData): VisitRecord[] => {
        const colorKeys = ['visit1', 'visit2', 'visit3'] as const;
        return hospitalPatient.prescriptions.slice(0, 3).map((rx, idx) => ({
            id: rx.id,
            visitDate: rx.created_at,
            visitNumber: hospitalPatient.prescriptions.length - idx,
            color: VISIT_COLORS[colorKeys[idx % 3]]?.primary || '#6B7280',
            colorClass: VISIT_COLORS[colorKeys[idx % 3]]?.bg || 'bg-gray-50',
            complaint: rx.notes || 'Routine checkup',
            medications: (rx.medications || []).map((med: any, mIdx: number) => ({
                id: `med-${mIdx}`,
                name: med.name || med.medication_name || 'Unknown',
                dosage: med.dosage || '',
                dosageUnit: 'mg',
                frequency: med.frequency || 'Daily',
                status: 'unchanged' as const
            })),
            dietRecommendation: '',
            dietFollowed: null,
            labResults: [],
            abnormalLabs: [],
            prescribedBy: formatDoctorName(doctor.name),
            notes: rx.notes
        }));
    };

    // Create placeholder lab trends (no real data for enterprise patients)
    const createLabTrends = (): LabTrendData[] => {
        return []; // Empty - will trigger LabTrendGraph's "No data" state
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Patient Health Snapshots</h2>
                    <p className="text-lg text-gray-700 mt-2">View complete health information for your patients</p>
                </div>

                <button
                    onClick={fetchPatients}
                    className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                    title="Reload"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Patient List */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Your Patients</h3>
                    <span className="text-sm font-medium text-gray-700">{patients.length} Patients</span>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-purple-600 rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-700">Loading patient data...</p>
                    </div>
                ) : patients.length === 0 ? (
                    <div className="p-24 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No Patients Found</h3>
                        <p className="text-gray-700 mt-1">You haven't consulted any patients yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {patients.map((patient) => (
                            <div key={patient.id} className="transition-all">
                                {/* Patient Row */}
                                <div
                                    className={`p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors ${expandedPatient === patient.id ? 'bg-purple-50/50' : ''}`}
                                    onClick={() => toggleExpand(patient.id)}
                                >
                                    <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center font-bold text-lg text-purple-600 flex-shrink-0">
                                            {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900">{patient.name}</h4>
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-700 font-medium">
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 whitespace-nowrap">Token: {patient.token_number}</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                                <span className="whitespace-nowrap">{patient.age} yrs</span>
                                                {patient.lastVisit && (
                                                    <>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                                        <span className="whitespace-nowrap">Last: {new Date(patient.lastVisit).toLocaleDateString()}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-16 sm:pl-0">
                                        <span className="text-sm font-medium text-purple-600 whitespace-nowrap">
                                            {patient.prescriptions.length} Visit{patient.prescriptions.length !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            className={`p-2 rounded-xl transition-all ${expandedPatient === patient.id ? 'bg-purple-100 text-purple-600 rotate-180' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            <svg className="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Section with Toggle Buttons */}
                                {expandedPatient === patient.id && (
                                    <div className="px-6 md:px-8 pb-8 pt-2 bg-gradient-to-b from-purple-50/50 to-white animate-fade-in">
                                        <div className="border border-purple-100 rounded-2xl overflow-hidden bg-white">
                                            {/* Header with Toggle Buttons */}
                                            <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-4">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div className="text-white">
                                                        <h4 className="font-bold text-lg">CKD Health Snapshot</h4>
                                                        <p className="text-purple-100 text-sm">Complete health overview for {patient.name}</p>
                                                    </div>

                                                    {/* Toggle Buttons */}
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setPatientSection(patient.id, 'snapshot'); }}
                                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${getActiveSection(patient.id) === 'snapshot'
                                                                ? 'bg-white text-purple-600 shadow-lg'
                                                                : 'bg-white/20 text-white hover:bg-white/30'
                                                                }`}
                                                        >
                                                            <span>🔬</span>
                                                            Snapshot
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setPatientSection(patient.id, 'visits'); }}
                                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${getActiveSection(patient.id) === 'visits'
                                                                ? 'bg-white text-purple-600 shadow-lg'
                                                                : 'bg-white/20 text-white hover:bg-white/30'
                                                                }`}
                                                        >
                                                            <span>📋</span>
                                                            Visit History
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setPatientSection(patient.id, 'labs'); }}
                                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${getActiveSection(patient.id) === 'labs'
                                                                ? 'bg-white text-purple-600 shadow-lg'
                                                                : 'bg-white/20 text-white hover:bg-white/30'
                                                                }`}
                                                        >
                                                            <span>📊</span>
                                                            Lab Trends
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content Section - Conditional Rendering */}
                                            <div className="p-6">
                                                {/* Snapshot Section */}
                                                {getActiveSection(patient.id) === 'snapshot' && (
                                                    <NephrologistSnapshot
                                                        patient={convertToPatient(patient)}
                                                        patientMedications={convertToEnhancedMedications(patient)}
                                                        caseDetails={createCaseDetails(patient)}
                                                        vitals={null}
                                                    />
                                                )}

                                                {/* Visit History Section */}
                                                {getActiveSection(patient.id) === 'visits' && (
                                                    <div className="space-y-4">
                                                        <h5 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                            📋 Visit History
                                                            <span className="text-sm font-normal text-gray-700">
                                                                ({patient.prescriptions.length} visits)
                                                            </span>
                                                        </h5>
                                                        {patient.prescriptions.length === 0 ? (
                                                            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-700">
                                                                No visits recorded yet
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {convertToVisitRecords(patient).map((visit, idx) => (
                                                                    <VisitCard
                                                                        key={visit.id}
                                                                        visit={visit}
                                                                        showConnectionArrow={idx < patient.prescriptions.length - 1}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Lab Trends Section */}
                                                {getActiveSection(patient.id) === 'labs' && (
                                                    <LabTrendGraph
                                                        trends={createLabTrends()}
                                                        visits={convertToVisitRecords(patient)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnterpriseCKDSnapshotView;
