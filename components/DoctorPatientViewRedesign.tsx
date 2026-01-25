
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Patient, MedicalRecord, Prescription, PrescriptionMedication, EnhancedMedication, CaseDetails } from '../types';
import { getInitials } from '../utils/avatarUtils';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { EyeIcon } from './icons/EyeIcon';
import { PillIcon } from './icons/PillIcon';
import RichSummaryDisplay from './RichSummaryDisplay';
import NephrologistSnapshot from './NephrologistSnapshot';
import PatientVisitHistoryView from './PatientVisitHistoryView';
import { PrescriptionService } from '../services/prescriptionService';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { VitalsService } from '../services/dataService';
import { CaseDetailsService } from '../services/caseDetailsService';
import { MedicationService } from '../services/medicationService';
import { ALL_PRESET_MEDICATIONS } from '../utils/presetMedications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DoctorPatientViewProps {
    patient: Patient;
    onBack: () => void;
}

const DoctorPatientView: React.FC<DoctorPatientViewProps> = ({ patient, onBack }) => {
    const { user } = useAuth();
    const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [prescriptionMedications, setPrescriptionMedications] = useState<PrescriptionMedication[]>([]);
    const [latestPrescription, setLatestPrescription] = useState<Prescription | null>(null);
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>(patient.records);
    const [latestComplaint, setLatestComplaint] = useState<string>('');
    const [caseHistory, setCaseHistory] = useState<string>('');
    const [vitals, setVitals] = useState(patient.vitals);
    const [isLoadingPrescription, setIsLoadingPrescription] = useState(true);
    const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
    const [patientMedications, setPatientMedications] = useState<EnhancedMedication[]>([]);
    const [adherenceStats, setAdherenceStats] = useState<{ adherencePercentage: number } | null>(null);
    const [showAddMedication, setShowAddMedication] = useState(false);
    const [newMedForm, setNewMedForm] = useState({ name: '', dosage: '', unit: 'mg', frequency: 'once daily', instructions: '' });
    const [isAddingMed, setIsAddingMed] = useState(false);
    const [medSearchQuery, setMedSearchQuery] = useState('');
    const [showMedDropdown, setShowMedDropdown] = useState(false);

    const filteredMedications = useMemo(() => {
        if (!medSearchQuery.trim()) return ALL_PRESET_MEDICATIONS.slice(0, 10);
        const query = medSearchQuery.toLowerCase();
        return ALL_PRESET_MEDICATIONS.filter(med =>
            med.name.toLowerCase().includes(query) ||
            med.category.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [medSearchQuery]);

    const fetchLatestPrescription = useCallback(async () => {
        if (!user?.id) return;

        setIsLoadingPrescription(true);
        try {
            const { data: activePrescriptions } = await PrescriptionService.getActivePrescriptions(patient.id);

            if (activePrescriptions && activePrescriptions.length > 0) {
                const latest = activePrescriptions[0];
                setLatestPrescription(latest);
                setPrescriptionMedications(latest.medications || []);
            } else {
                setLatestPrescription(null);
                setPrescriptionMedications([]);
            }
        } catch (error) {
            console.error('Error fetching prescription:', error);
            setPrescriptionMedications([]);
        } finally {
            setIsLoadingPrescription(false);
        }
    }, [patient.id, user?.id]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const extractCaseDetailsFromRecords = (records: MedicalRecord[]) => {
        if (records.length === 0) return;
        const latestRecord = records[0];

        if (typeof latestRecord.summary === 'string') {
            try {
                const summaryObj = JSON.parse(latestRecord.summary);
                if (summaryObj['Current Issue/Reason for Visit']) {
                    const complaint = Array.isArray(summaryObj['Current Issue/Reason for Visit'])
                        ? summaryObj['Current Issue/Reason for Visit'].join(' ')
                        : summaryObj['Current Issue/Reason for Visit'];
                    setLatestComplaint(complaint);
                }
                if (summaryObj['Medical History']) {
                    const history = Array.isArray(summaryObj['Medical History'])
                        ? summaryObj['Medical History'].join(' ')
                        : summaryObj['Medical History'];
                    setCaseHistory(history);
                }
            } catch {
                const summaryText = latestRecord.summary.substring(0, 200);
                setLatestComplaint(summaryText);
            }
        } else if (typeof latestRecord.summary === 'object' && latestRecord.summary !== null) {
            const summaryObj = latestRecord.summary as any;
            if (summaryObj['Current Issue/Reason for Visit']) {
                const complaint = Array.isArray(summaryObj['Current Issue/Reason for Visit'])
                    ? summaryObj['Current Issue/Reason for Visit'].join(' ')
                    : summaryObj['Current Issue/Reason for Visit'];
                setLatestComplaint(complaint);
            }
            if (summaryObj['Medical History']) {
                const history = Array.isArray(summaryObj['Medical History'])
                    ? summaryObj['Medical History'].join(' ')
                    : summaryObj['Medical History'];
                setCaseHistory(history);
            }
        }
    };

    const fetchMedicalRecords = useCallback(async () => {
        try {
            const records = await MedicalRecordsService.getMedicalRecordsByPatientId(patient.id);
            setMedicalRecords(records);
            extractCaseDetailsFromRecords(records);
        } catch (error) {
            console.error('Error fetching medical records:', error);
        }
    }, [patient.id]);

    const fetchVitals = useCallback(async () => {
        try {
            const latestVitals = await VitalsService.getLatestVitals(patient.id);
            if (latestVitals) {
                setVitals(latestVitals);
            }
        } catch (error) {
            console.error('Error fetching vitals:', error);
        }
    }, [patient.id]);

    const fetchCaseDetails = useCallback(async () => {
        try {
            const details = await CaseDetailsService.getCaseDetails(patient.id);
            setCaseDetails(details);
            if (details) {
                setLatestComplaint(details.latestComplaint || '');
                setCaseHistory(details.medicalHistory?.join(', ') || '');
            }
        } catch (error) {
            console.error('Error fetching case details:', error);
        }
    }, [patient.id]);

    const fetchPatientMedications = useCallback(async () => {
        try {
            const meds = await MedicationService.getMedications(patient.id);
            setPatientMedications(meds);
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const stats = await MedicationService.getAdherenceStats(patient.id, startDate, endDate);
            setAdherenceStats({ adherencePercentage: stats.adherencePercentage });
        } catch (error) {
            console.error('Error fetching patient medications:', error);
        }
    }, [patient.id]);

    useEffect(() => {
        fetchLatestPrescription();
        fetchMedicalRecords();
        fetchVitals();
        fetchCaseDetails();
        fetchPatientMedications();
    }, [fetchLatestPrescription, fetchMedicalRecords, fetchVitals, fetchCaseDetails, fetchPatientMedications]);

    useEffect(() => {
        const channel = supabase
            .channel(`medical_records_${patient.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records', filter: `patient_id=eq.${patient.id}` }, () => { fetchMedicalRecords(); fetchVitals(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [patient.id, fetchMedicalRecords, fetchVitals]);

    useEffect(() => {
        const channel = supabase
            .channel(`prescriptions_${patient.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions', filter: `patient_id=eq.${patient.id}` }, () => { fetchLatestPrescription(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [patient.id, fetchLatestPrescription]);

    useEffect(() => {
        const channel = supabase
            .channel(`vitals_${patient.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vitals', filter: `patient_id=eq.${patient.id}` }, () => { fetchVitals(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [patient.id, fetchVitals]);

    const toggleRecord = (recordId: string) => {
        setExpandedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) newSet.delete(recordId);
            else newSet.add(recordId);
            return newSet;
        });
    };

    const recordsByCategory = medicalRecords.reduce((acc, record) => {
        const category = record.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(record);
        return acc;
    }, {} as Record<string, MedicalRecord[]>);

    const categories = ['all', ...Object.keys(recordsByCategory).sort()];
    const filteredRecords = selectedCategory === 'all' ? medicalRecords : recordsByCategory[selectedCategory] || [];

    const getCategoryStyles = (category: string) => {
        switch (category.toLowerCase()) {
            case 'lab report': return { bg: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-100 dark:border-sky-900/20', text: 'text-sky-700 dark:text-sky-300', badge: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300', iconBg: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' };
            case 'prescription': return { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-100 dark:border-purple-900/20', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' };
            case 'medical image': return { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-100 dark:border-amber-900/20', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' };
            case 'doctor\'s note': return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' };
            default: return { bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-gray-100 dark:border-gray-700/50', text: 'text-gray-700 dark:text-gray-300', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', iconBg: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
        }
    };

    return (
        <div className="animate-fadeIn w-full space-y-6 sm:space-y-8 pb-12">
            {/* Header */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-6 shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start sm:items-center gap-4 sm:gap-6">
                        <button onClick={onBack} className="p-2 sm:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group -ml-2 shrink-0">
                            <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900 dark:text-white group-hover:scale-110 transition-transform" />
                        </button>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                            <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center shadow-xl ring-4 ring-white dark:ring-[#1e1e1e] shrink-0">
                                <span className="text-white dark:text-gray-900 text-xl sm:text-2xl font-bold">{getInitials(patient.name, patient.email)}</span>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight break-all sm:break-normal">{patient.name}</h1>
                                <p className="text-gray-500 dark:text-gray-400 font-medium text-base sm:text-lg mt-0.5 break-all sm:break-normal">{patient.email}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">ID: {patient.patientId || patient.patient_id || patient.id.slice(0, 6)}</span>
                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nephrologist Snapshot - Added from anacondafounder */}
            <div className="w-full">
                <NephrologistSnapshot
                    patient={patient}
                    patientMedications={patientMedications}
                    caseDetails={caseDetails}
                    vitals={vitals}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Sidebar Info (Vitals, Quick Stats, Case) */}
                <div className="contents xl:block xl:col-span-4 xl:sticky xl:top-6 xl:space-y-6">

                    {/* VITALS - High Priority */}
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 order-2 xl:order-none">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <FeatureVitalsIcon className="w-5 h-5 text-gray-500" />
                            Recent Vitals
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-red-900/30 rounded-full text-red-600 shrink-0"><BloodPressureIcon className="w-5 h-5" /></div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">BP</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white block whitespace-nowrap">{vitals?.bloodPressure?.value || '--'}</span>
                                    <span className="text-xs font-semibold text-red-500">mmHg</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-pink-50 dark:bg-pink-900/10 rounded-2xl border border-pink-100 dark:border-pink-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-pink-900/30 rounded-full text-pink-600 shrink-0"><FeatureVitalsIcon className="w-5 h-5" /></div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Heart Rate</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white block whitespace-nowrap">{vitals?.heartRate?.value || '--'}</span>
                                    <span className="text-xs font-semibold text-pink-500">bpm</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-amber-900/30 rounded-full text-amber-600 shrink-0"><TemperatureIcon className="w-5 h-5" /></div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Temp</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white block whitespace-nowrap">{vitals?.temperature?.value || '--'}</span>
                                    <span className="text-xs font-semibold text-amber-500">°F</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CASE DETAILS */}
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 order-3 xl:order-none">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Patient Overview</h3>
                        <div className="space-y-6">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Primary Condition</p>
                                <div className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {caseDetails?.primaryCondition || patient.condition}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                    Complaint {caseDetails?.complaintDate && <span className="text-gray-300 font-normal">({new Date(caseDetails.complaintDate).toLocaleDateString()})</span>}
                                </p>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed italic">
                                    "{latestComplaint || 'No recent complaint recorded'}"
                                </p>
                            </div>
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">History Tags</p>
                                <div className="flex flex-wrap gap-2">
                                    {(caseDetails?.medicalHistory || (caseHistory ? [caseHistory] : [])).map((tag, i) => (
                                        <span key={i} className="px-2.5 py-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300">
                                            {tag}
                                        </span>
                                    ))}
                                    {(!caseDetails?.medicalHistory && !caseHistory) && <span className="text-xs text-gray-400">None</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Actionable Content (Meds, Records) */}
                <div className="contents xl:block xl:col-span-8 xl:space-y-6">

                    {/* Visit History Section - Added from anacondafounder */}
                    <div className="order-1 xl:order-none w-full">
                        <PatientVisitHistoryView
                            patientId={patient.id}
                            patientMedications={patientMedications}
                            onVisitSaved={() => {
                                // Refresh data when a new visit is saved
                                fetchLatestPrescription();
                                fetchPatientMedications();
                            }}
                        />
                    </div>

                    {/* MEDICATIONS */}
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 order-4 xl:order-none">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Medications</h3>
                                <p className="text-sm text-gray-500 mt-1">{patientMedications.length + prescriptionMedications.length} Active Prescriptions</p>
                            </div>
                            <button onClick={() => setShowAddMedication(true)} className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-bold hover:opacity-80 transition-opacity w-full sm:w-auto text-center">
                                + Add Medication
                            </button>
                        </div>

                        {/* Add Med Form (Inline) */}
                        {showAddMedication && (
                            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 animate-slide-down">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-900 dark:text-white">New Prescription</h4>
                                    <button onClick={() => setShowAddMedication(false)} className="text-gray-400 hover:text-red-500">✕</button>
                                </div>
                                <div className="grid gap-4">
                                    <div className="relative">
                                        <input type="text" placeholder="Search drug name..." value={medSearchQuery || newMedForm.name} onChange={(e) => { setMedSearchQuery(e.target.value); setNewMedForm(p => ({ ...p, name: e.target.value })); setShowMedDropdown(true); }} className="w-full p-3 bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl" />
                                        {showMedDropdown && filteredMedications.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                                                {filteredMedications.map((m, i) => (
                                                    <div key={i} onClick={() => { setNewMedForm({ name: m.name, dosage: m.defaultDosage, unit: m.defaultUnit, frequency: m.defaultFrequency, instructions: m.instructions || '' }); setMedSearchQuery(''); setShowMedDropdown(false); }} className="p-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0">
                                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{m.name}</p>
                                                        <p className="text-xs text-gray-500">{m.category}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" placeholder="Dosage" value={newMedForm.dosage} onChange={e => setNewMedForm(p => ({ ...p, dosage: e.target.value }))} className="p-3 bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl" />
                                        <select value={newMedForm.frequency} onChange={e => setNewMedForm(p => ({ ...p, frequency: e.target.value }))} className="p-3 bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl">
                                            <option value="once daily">Once Daily</option>
                                            <option value="twice daily">Twice Daily</option>
                                            <option value="three times daily">3x Daily</option>
                                        </select>
                                    </div>
                                    <button disabled={!newMedForm.name || isAddingMed} onClick={async () => {
                                        if (!user?.id) return;
                                        setIsAddingMed(true);
                                        try {
                                            await MedicationService.addMedicationAsDoctor(user.id, patient.id, {
                                                name: newMedForm.name, dosage: newMedForm.dosage, dosageUnit: newMedForm.unit, frequency: newMedForm.frequency as any,
                                                scheduledTimes: ['09:00'], startDate: new Date().toISOString(), isActive: true, isCustom: false, reminderEnabled: true
                                            });
                                            fetchPatientMedications(); setShowAddMedication(false); setNewMedForm({ name: '', dosage: '', unit: 'mg', frequency: 'once daily', instructions: '' });
                                        } catch (e) { console.error(e); alert('Failed'); } finally { setIsAddingMed(false); }
                                    }} className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl mt-2 disabled:opacity-50">
                                        {isAddingMed ? 'Adding...' : 'Prescribe Medication'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                            {[...prescriptionMedications.map(m => ({ ...m, source: 'Rx' })), ...patientMedications.map(m => ({ ...m, source: 'Reported' }))].map((med, i) => (
                                <div key={i} className="flex items-start p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-2xl group hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                    <div className="h-10 w-10 bg-white dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400 mr-4 shadow-sm border border-gray-100 dark:border-gray-700 shrink-0">
                                        <PillIcon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h5 className="font-bold text-gray-900 dark:text-white text-base truncate">{med.name}</h5>
                                        <p className="text-sm text-gray-500 font-medium truncate">{med.dosage} • {med.frequency}</p>
                                        <div className="mt-2 flex gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${'source' in med && med.source === 'Rx' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
                                                {'source' in med ? med.source : 'Rx'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {[...prescriptionMedications, ...patientMedications].length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-400">No active medications</div>
                            )}
                        </div>
                    </div>

                    {/* MEDICAL RECORDS */}
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 order-5 xl:order-none">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Medical Records</h3>
                                <p className="text-sm text-gray-500 mt-1">{filteredRecords.length} records available</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${selectedCategory === cat ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {filteredRecords.map((record, i) => {
                                const styles = getCategoryStyles(record.category);
                                const isExpanded = expandedRecords.has(record.id);
                                return (
                                    <div key={record.id} className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-gray-700 shadow-md' : 'bg-white dark:bg-transparent border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                                        <div className="p-5 flex items-start gap-4 cursor-pointer" onClick={() => toggleRecord(record.id)}>
                                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                                                <DocumentIcon className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white text-lg truncate pr-2">{record.type}</h4>
                                                        <p className="text-sm text-gray-500 font-medium mt-0.5">{new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} • {record.doctor}</p>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${styles.badge}`}>{record.category}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-5 pb-5 pt-0 pl-4 sm:pl-[4.5rem] animate-slide-down">
                                                <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-gray-600 dark:text-gray-300">
                                                    <RichSummaryDisplay summary={record.summary} />
                                                </div>
                                                {record.fileUrl && (
                                                    <a href={record.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold hover:opacity-80">
                                                        <EyeIcon className="w-4 h-4" /> View Original File
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredRecords.length === 0 && <div className="py-12 text-center text-gray-400">No records found used filter</div>}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DoctorPatientView;
