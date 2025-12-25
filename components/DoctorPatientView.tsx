import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Patient, MedicalRecord, Prescription, PrescriptionMedication, EnhancedMedication, CaseDetails } from '../types';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { TagIcon } from './icons/TagIcon';
import { EyeIcon } from './icons/EyeIcon';
import { PillIcon } from './icons/PillIcon';
import RichSummaryDisplay from './RichSummaryDisplay';
import NephrologistSnapshot from './NephrologistSnapshot';
import { PrescriptionService } from '../services/prescriptionService';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { VitalsService } from '../services/dataService';
import { CaseDetailsService } from '../services/caseDetailsService';
import { MedicationService } from '../services/medicationService';
import { ALL_PRESET_MEDICATIONS, PresetMedication } from '../utils/presetMedications';
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
  // New state for case details and enhanced medications
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [patientMedications, setPatientMedications] = useState<EnhancedMedication[]>([]);
  const [adherenceStats, setAdherenceStats] = useState<{ adherencePercentage: number } | null>(null);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [newMedForm, setNewMedForm] = useState({ name: '', dosage: '', unit: 'mg', frequency: 'once daily', instructions: '' });
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [showMedDropdown, setShowMedDropdown] = useState(false);

  // Collapsible sections - default collapsed
  const [expandedSections, setExpandedSections] = useState<{
    patientInfo: boolean;
    vitals: boolean;
    medications: boolean;
    caseDetails: boolean;
    records: boolean;
  }>({
    patientInfo: false,
    vitals: false,
    medications: false,
    caseDetails: false,
    records: true // Records stay expanded by default
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Filter medications based on search
  const filteredMedications = useMemo(() => {
    if (!medSearchQuery.trim()) return ALL_PRESET_MEDICATIONS.slice(0, 10);
    const query = medSearchQuery.toLowerCase();
    return ALL_PRESET_MEDICATIONS.filter(med =>
      med.name.toLowerCase().includes(query) ||
      med.category.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [medSearchQuery]);

  // Fetch latest prescription medications
  const fetchLatestPrescription = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingPrescription(true);
    try {
      const { data: activePrescriptions } = await PrescriptionService.getActivePrescriptions(patient.id);

      if (activePrescriptions && activePrescriptions.length > 0) {
        // Get the most recent prescription
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

  // Fetch medical records
  const fetchMedicalRecords = useCallback(async () => {
    try {
      const records = await MedicalRecordsService.getMedicalRecordsByPatientId(patient.id);
      setMedicalRecords(records);

      // Extract case details from latest records
      extractCaseDetailsFromRecords(records);
    } catch (error) {
      console.error('Error fetching medical records:', error);
    }
  }, [patient.id]);

  // Fetch latest vitals
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

  // Fetch case details from new service
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

  // Fetch patient's self-managed medications (enhanced)
  const fetchPatientMedications = useCallback(async () => {
    try {
      const meds = await MedicationService.getMedications(patient.id);
      setPatientMedications(meds);

      // Get adherence stats for last 7 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const stats = await MedicationService.getAdherenceStats(patient.id, startDate, endDate);
      setAdherenceStats({ adherencePercentage: stats.adherencePercentage });
    } catch (error) {
      console.error('Error fetching patient medications:', error);
    }
  }, [patient.id]);

  // Extract case details from medical records (complaint and history)
  const extractCaseDetailsFromRecords = (records: MedicalRecord[]) => {
    if (records.length === 0) return;

    // Get the most recent record
    const latestRecord = records[0];

    // Try to extract complaint and history from summary
    if (typeof latestRecord.summary === 'string') {
      // Check if summary contains structured data
      try {
        const summaryObj = JSON.parse(latestRecord.summary);

        // Extract complaint (Current Issue/Reason for Visit)
        if (summaryObj['Current Issue/Reason for Visit']) {
          const complaint = Array.isArray(summaryObj['Current Issue/Reason for Visit'])
            ? summaryObj['Current Issue/Reason for Visit'].join(' ')
            : summaryObj['Current Issue/Reason for Visit'];
          setLatestComplaint(complaint);
        }

        // Extract history (Medical History)
        if (summaryObj['Medical History']) {
          const history = Array.isArray(summaryObj['Medical History'])
            ? summaryObj['Medical History'].join(' ')
            : summaryObj['Medical History'];
          setCaseHistory(history);
        }
      } catch {
        // If not JSON, use the summary text as complaint
        const summaryText = latestRecord.summary.substring(0, 200);
        setLatestComplaint(summaryText);
      }
    } else if (typeof latestRecord.summary === 'object' && latestRecord.summary !== null) {
      // If summary is already an object
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

  // Initial data fetch
  useEffect(() => {
    fetchLatestPrescription();
    fetchMedicalRecords();
    fetchVitals();
    fetchCaseDetails();
    fetchPatientMedications();
  }, [fetchLatestPrescription, fetchMedicalRecords, fetchVitals, fetchCaseDetails, fetchPatientMedications]);

  // Real-time subscription for medical records
  useEffect(() => {
    const channel = supabase
      .channel(`medical_records_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medical_records',
          filter: `patient_id=eq.${patient.id}`
        },
        (payload) => {
          console.log('Medical record changed:', payload);
          // Refresh medical records and vitals
          fetchMedicalRecords();
          fetchVitals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id, fetchMedicalRecords, fetchVitals]);

  // Real-time subscription for prescriptions
  useEffect(() => {
    const channel = supabase
      .channel(`prescriptions_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prescriptions',
          filter: `patient_id=eq.${patient.id}`
        },
        (payload) => {
          console.log('Prescription changed:', payload);
          // Refresh prescriptions
          fetchLatestPrescription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id, fetchLatestPrescription]);

  // Real-time subscription for vitals
  useEffect(() => {
    const channel = supabase
      .channel(`vitals_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vitals',
          filter: `patient_id=eq.${patient.id}`
        },
        (payload) => {
          console.log('Vitals changed:', payload);
          // Refresh vitals
          fetchVitals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id, fetchVitals]);

  const toggleRecord = (recordId: string) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  // Group records by category
  const recordsByCategory = medicalRecords.reduce((acc, record) => {
    const category = record.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(record);
    return acc;
  }, {} as Record<string, MedicalRecord[]>);

  const categories = ['all', ...Object.keys(recordsByCategory).sort()];

  const filteredRecords = selectedCategory === 'all'
    ? medicalRecords
    : recordsByCategory[selectedCategory] || [];

  /* Helper to get theme styles for different record categories */
  const getCategoryStyles = (category: string) => {
    switch (category.toLowerCase()) {
      case 'lab report':
        return {
          bg: 'bg-sky-50 dark:bg-sky-900/10',
          border: 'border-sky-100 dark:border-sky-900/20',
          text: 'text-sky-700 dark:text-sky-300',
          badge: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
          iconBg: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
        };
      case 'prescription':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/10',
          border: 'border-purple-100 dark:border-purple-900/20',
          text: 'text-purple-700 dark:text-purple-300',
          badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
          iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
        };
      case 'medical image':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/10',
          border: 'border-amber-100 dark:border-amber-900/20',
          text: 'text-amber-700 dark:text-amber-300',
          badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
          iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        };
      case 'doctor\'s note':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-900/10',
          border: 'border-emerald-100 dark:border-emerald-900/20',
          text: 'text-emerald-700 dark:text-emerald-300',
          badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800/50',
          border: 'border-gray-100 dark:border-gray-700/50',
          text: 'text-gray-700 dark:text-gray-300',
          badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          iconBg: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      {/* Header */}
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-8 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <button
              onClick={onBack}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
            >
              <ArrowLeftIcon className="h-5 w-5 text-[#222222] dark:text-gray-200 group-hover:text-black dark:group-hover:text-white" />
            </button>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-[#222222] dark:bg-white rounded-full flex items-center justify-center shadow-lg ring-4 ring-gray-50 dark:ring-gray-800">
                <span className="text-white dark:text-[#222222] text-xl font-bold">
                  {getInitials(patient.name, patient.email)}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-[#222222] dark:text-white tracking-tight leading-tight">
                  {patient.name}
                </h1>
                <p className="text-[#717171] dark:text-[#a0a0a0] text-sm font-medium mt-1">
                  {patient.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pl-14 md:pl-0">
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 px-5 py-2.5 rounded-full flex flex-col items-start">
              <span className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-widest">Patient ID</span>
              <span className="text-sm font-bold text-[#222222] dark:text-white font-mono mt-0.5">
                {patient.patientId || patient.patient_id || `${patient.id.slice(0, 8)}...`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nephrologist Snapshot */}
      <NephrologistSnapshot
        patient={patient}
        patientMedications={patientMedications}
        caseDetails={caseDetails}
        vitals={vitals}
      />

      {/* Collapsible Details Section */}
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
        {/* Collapsible Header */}
        <button
          onClick={() => toggleSection('patientInfo')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📋</span>
            <h3 className="text-lg font-bold text-[#222222] dark:text-white">Patient Details</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Info • Vitals • Medications • Case
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.patientInfo ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Collapsible Content */}
        {expandedSections.patientInfo && (
          <div className="px-6 pb-6 animate-slideDown">
            {/* Patient Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Patient Information Card */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-bold text-[#222222] dark:text-white mb-3">Patient Information</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Condition</p>
                      <p className="text-sm font-bold text-[#222222] dark:text-white truncate">{patient.condition}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Records</p>
                      <p className="text-lg font-bold text-[#222222] dark:text-white">{medicalRecords.length}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Medications</p>
                      <p className="text-lg font-bold text-[#222222] dark:text-white">{patient.medications.length + prescriptionMedications.length}</p>
                    </div>
                  </div>
                </div>

                {/* Health Vitals Card - Redesigned */}
                <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 md:p-8 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-extrabold text-[#222222] dark:text-white">Health Vitals</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Blood Pressure Card - Crimson/Deep Red */}
                    <div className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-500/20 dark:to-rose-600/10 p-4 rounded-2xl border border-red-200/50 dark:border-red-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/10 group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-red-500/20 dark:bg-red-500/30 rounded-lg">
                          <BloodPressureIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">BP</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                          {vitals?.bloodPressure?.value || '--'}
                        </span>
                        <span className="text-xs font-semibold text-red-500 dark:text-red-400 ml-1">mmHg</span>
                      </div>
                    </div>

                    {/* Heart Rate Card - Vibrant Pink/Magenta */}
                    <div className="bg-gradient-to-br from-pink-50 to-fuchsia-100 dark:from-pink-500/20 dark:to-fuchsia-600/10 p-4 rounded-2xl border border-pink-200/50 dark:border-pink-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-pink-500/10 group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-pink-500/20 dark:bg-pink-500/30 rounded-lg">
                          <FeatureVitalsIcon className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                        </div>
                        <span className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider">Heart Rate</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                          {vitals?.heartRate?.value || '--'}
                        </span>
                        <span className="text-xs font-semibold text-pink-500 dark:text-pink-400 ml-1">bpm</span>
                      </div>
                    </div>

                    {/* Temperature Card - Warm Amber/Orange */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-500/20 dark:to-orange-600/10 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/10 group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-amber-500/20 dark:bg-amber-500/30 rounded-lg">
                          <TemperatureIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Temp</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                          {vitals?.temperature?.value || '--'}
                        </span>
                        <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 ml-1">°F</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Current Medications Card */}
                <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-[#222222] dark:text-white">Medications</h3>
                    <div className="flex items-center gap-2">
                      {latestPrescription && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-bold">
                          Rx: {new Date(latestPrescription.createdAt).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        onClick={() => setShowAddMedication(true)}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-[#222222] dark:bg-white dark:text-[#222222] hover:opacity-90 rounded-full transition-colors"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Add Medication Form */}
                  {showAddMedication && (
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">Add Medication</h4>
                        <button
                          onClick={() => {
                            setShowAddMedication(false);
                            setNewMedForm({ name: '', dosage: '', unit: 'mg', frequency: 'once daily', instructions: '' });
                            setMedSearchQuery('');
                            setShowMedDropdown(false);
                          }}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Medication Search Dropdown */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          placeholder="Search medications..."
                          value={medSearchQuery || newMedForm.name}
                          onChange={(e) => {
                            setMedSearchQuery(e.target.value);
                            setNewMedForm(prev => ({ ...prev, name: e.target.value }));
                            setShowMedDropdown(true);
                          }}
                          onFocus={() => setShowMedDropdown(true)}
                          className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        {showMedDropdown && filteredMedications.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredMedications.map((med, idx) => (
                              <button
                                key={idx}
                                className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                onClick={() => {
                                  setNewMedForm({
                                    name: med.name,
                                    dosage: med.defaultDosage,
                                    unit: med.defaultUnit,
                                    frequency: med.defaultFrequency.replace('_', ' '),
                                    instructions: med.instructions || '',
                                  });
                                  setMedSearchQuery('');
                                  setShowMedDropdown(false);
                                }}
                              >
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{med.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {med.category} • {med.defaultDosage}{med.defaultUnit}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dosage Row */}
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Dosage"
                          value={newMedForm.dosage}
                          onChange={(e) => setNewMedForm(prev => ({ ...prev, dosage: e.target.value }))}
                          className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <select
                          value={newMedForm.unit}
                          onChange={(e) => setNewMedForm(prev => ({ ...prev, unit: e.target.value }))}
                          className="w-16 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="mg">mg</option>
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="mcg">mcg</option>
                          <option value="units">units</option>
                        </select>
                        <select
                          value={newMedForm.frequency}
                          onChange={(e) => setNewMedForm(prev => ({ ...prev, frequency: e.target.value }))}
                          className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="once daily">Once daily</option>
                          <option value="twice daily">Twice daily</option>
                          <option value="three times daily">3x daily</option>
                          <option value="four times daily">4x daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="as needed">As needed</option>
                        </select>
                      </div>

                      {/* Instructions & Submit */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Instructions (optional)"
                          value={newMedForm.instructions}
                          onChange={(e) => setNewMedForm(prev => ({ ...prev, instructions: e.target.value }))}
                          className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={async () => {
                            if (!newMedForm.name || !newMedForm.dosage || !user?.id) return;
                            setIsAddingMed(true);
                            try {
                              await MedicationService.addMedicationAsDoctor(user.id, patient.id, {
                                name: newMedForm.name,
                                dosage: newMedForm.dosage,
                                dosageUnit: newMedForm.unit,
                                frequency: newMedForm.frequency as any,
                                scheduledTimes: ['08:00'],
                                instructions: newMedForm.instructions,
                                startDate: new Date().toISOString().split('T')[0],
                                isActive: true,
                                isCustom: false,
                                reminderEnabled: true,
                              });
                              const meds = await MedicationService.getMedications(patient.id);
                              setPatientMedications(meds);
                              setShowAddMedication(false);
                              setNewMedForm({ name: '', dosage: '', unit: 'mg', frequency: 'once daily', instructions: '' });
                              setMedSearchQuery('');
                            } catch (error) {
                              console.error('Error adding medication:', error);
                              alert('Failed to add medication');
                            } finally {
                              setIsAddingMed(false);
                            }
                          }}
                          disabled={!newMedForm.name || !newMedForm.dosage || isAddingMed}
                          className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-gray-400 rounded-lg whitespace-nowrap"
                        >
                          {isAddingMed ? '...' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {isLoadingPrescription ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-900 dark:border-rose-400"></div>
                    </div>
                  ) : (
                    <>
                      {/* Prescription Medications - Clean List */}
                      {prescriptionMedications.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-[10px] font-bold text-[#8AC43C] uppercase tracking-widest">Prescribed</span>
                            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                          </div>
                          <div className="space-y-3">
                            {prescriptionMedications.map((med, index) => (
                              <div key={`rx-${index}`} className="flex items-start justify-between group py-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#222222] dark:text-white text-sm">{med.name}</span>
                                    {med.instructions && (
                                      <span className="text-[10px] text-[#717171] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                                        {med.instructions}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-medium text-[#717171] dark:text-[#a0a0a0] mt-0.5">
                                    {med.dosage} • {med.frequency}
                                  </p>
                                </div>
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#f0f9e8] text-[#8AC43C] dark:bg-[#8AC43C]/20 shrink-0">
                                  <PillIcon className="w-4 h-4" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Patient Self-Managed Medications (Enhanced) - Clean List */}
                      {patientMedications.length > 0 && (
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-[10px] font-bold text-[#717171] uppercase tracking-widest">Self-Reported</span>
                            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800"></div>
                            {adherenceStats && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${adherenceStats.adherencePercentage >= 80 ? 'bg-green-100 text-green-700' :
                                adherenceStats.adherencePercentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {adherenceStats.adherencePercentage}% Adherence
                              </span>
                            )}
                          </div>

                          <div className="space-y-3">
                            {patientMedications.slice(0, 4).map((med) => (
                              <div key={med.id} className="flex items-start justify-between group py-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#222222] dark:text-white text-sm">{med.name}</span>
                                    {med.category && (
                                      <span className="text-[9px] font-bold text-[#717171] border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-md">
                                        {med.category}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-medium text-[#717171] dark:text-[#a0a0a0] mt-0.5">
                                    {med.dosage} {med.dosageUnit} • {med.scheduledTimes?.join(', ') || 'As needed'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {med.reminderEnabled && (
                                    <span className="text-xs text-[#8AC43C]">
                                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {patientMedications.length > 4 && (
                            <button className="w-full mt-4 text-xs font-bold text-[#717171] hover:text-[#222222] transition-colors py-2 border-t border-gray-100 dark:border-gray-800">
                              View {patientMedications.length - 4} more
                            </button>
                          )}
                        </div>
                      )}

                      {/* Legacy Manual Medications (fallback) */}
                      {patientMedications.length === 0 && patient.medications.length > 0 && (
                        <div>
                          <div className="flex items-center mb-3">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 px-2">PATIENT-REPORTED MEDICATIONS</span>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {patient.medications.slice(0, 4).map((med) => (
                              <div key={med.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">{med.name}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{med.dosage}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{med.frequency}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No medications */}
                      {prescriptionMedications.length === 0 && patientMedications.length === 0 && patient.medications.length === 0 && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No medications recorded</p>
                      )}
                    </>
                  )}
                </div>

                {/* Case Details Card */}
                <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-[#222222] dark:text-white">Case Details</h3>
                    {caseDetails?.updatedAt && (
                      <span className="text-xs font-medium text-[#717171] dark:text-[#a0a0a0]">
                        Updated {new Date(caseDetails.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Primary Condition</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                        {caseDetails?.primaryCondition || patient.condition}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                        Latest Complaint / Chief Issue
                        {caseDetails?.complaintDate && (
                          <span className="ml-2 text-gray-400 normal-case">
                            ({new Date(caseDetails.complaintDate).toLocaleDateString()})
                          </span>
                        )}
                      </p>
                      {latestComplaint ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{latestComplaint}</p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">No recent complaint recorded</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Medical History</p>
                      {caseDetails?.medicalHistory && caseDetails.medicalHistory.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {caseDetails.medicalHistory.map((item, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2.5 py-1 bg-gray-100 dark:bg-white/10 text-[#717171] dark:text-gray-300 text-xs font-medium rounded-full border border-gray-200 dark:border-gray-700"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : caseHistory ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{caseHistory}</p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">No medical history recorded</p>
                      )}
                    </div>
                    {medicalRecords.length > 0 && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">Latest Record</p>
                        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                          <p className="text-xs font-bold text-[#8AC43C] uppercase tracking-wider mb-1">{medicalRecords[0].type}</p>
                          <p className="text-sm font-medium text-[#222222] dark:text-white">
                            {new Date(medicalRecords[0].date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Records Section */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-8 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#222222] dark:text-white">Medical Records</h2>
                  <p className="text-sm font-medium text-[#717171] dark:text-[#a0a0a0] mt-1">
                    {filteredRecords.length} {selectedCategory === 'all' ? 'total' : selectedCategory} record(s)
                  </p>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${selectedCategory === category
                        ? 'bg-secondary-700 dark:bg-secondary-600 text-white dark:text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                      {category === 'all' ? 'All Records' : category}
                      {category !== 'all' && (
                        <span className="ml-2 px-2 py-0.5 bg-gray-700/20 dark:bg-gray-200/20 rounded-full text-xs">
                          {recordsByCategory[category]?.length || 0}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Records List - Redesigned to HUD style */}
              {filteredRecords.length > 0 ? (
                <div className="space-y-4">
                  {filteredRecords.map((record, index) => {
                    const isExpanded = expandedRecords.has(record.id);
                    const styles = getCategoryStyles(record.category);

                    return (
                      <div
                        key={record.id}
                        className={`${styles.bg} rounded-2xl border ${styles.border} overflow-hidden hover:shadow-md transition-all duration-300 group`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="p-6">
                          <div className="flex items-start gap-5">
                            <div className={`p-3 rounded-xl ${styles.iconBg} transition-colors shadow-sm`}>
                              <DocumentIcon className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}>
                                      {record.category}
                                    </span>
                                    <span className={`text-xs font-medium ${styles.text} opacity-70`}>
                                      {new Date(record.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <h3 className={`text-lg font-bold ${styles.text.split(' ')[0]} dark:text-white mb-1`}>{record.type}</h3>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {record.fileUrl && (
                                    <a
                                      href={record.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`p-2.5 rounded-full ${styles.badge} hover:opacity-80 transition-all duration-200`}
                                      aria-label="Preview record"
                                    >
                                      <EyeIcon className="h-5 w-5" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between pt-2">
                                  <p className={`text-sm ${styles.text} opacity-90`}>
                                    <span className="font-bold opacity-100">Doctor:</span> {record.doctor}
                                  </p>
                                  <button
                                    onClick={() => toggleRecord(record.id)}
                                    className={`text-sm font-bold ${styles.text} hover:opacity-80 transition-colors flex items-center gap-1.5`}
                                  >
                                    {isExpanded ? 'Hide Details' : 'View Details'}
                                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className={`pt-4 border-t ${styles.border} animate-slide-down`}>
                                    <RichSummaryDisplay summary={record.summary} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gray-100 dark:bg-gray-700 p-8 rounded-3xl inline-block mb-4">
                    <DocumentIcon className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    No {selectedCategory === 'all' ? '' : selectedCategory} records found
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorPatientView;

