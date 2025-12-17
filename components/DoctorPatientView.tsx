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

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'lab report': return 'bg-blue-500';
      case 'prescription': return 'bg-purple-500';
      case 'medical image': return 'bg-amber-500';
      case 'doctor\'s note': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'lab report': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'prescription': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'medical image': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'doctor\'s note': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-secondary-700 dark:bg-secondary-600 rounded-3xl p-4 sm:p-6 lg:p-8 border border-gray-200/60 dark:border-gray-700/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
            <button
              onClick={onBack}
              className="p-2 sm:p-3 rounded-xl bg-gray-800 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-200 transition-all duration-200 flex-shrink-0"
            >
              <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white dark:text-gray-900" />
            </button>
            <div className={`h-12 w-12 sm:h-16 sm:w-16 ${getInitialsColor(patient.name, patient.email)} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-base sm:text-xl font-bold">
                {getInitials(patient.name, patient.email)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white dark:text-gray-900 truncate">{patient.name}</h1>
              <p className="text-gray-300 dark:text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{patient.email}</p>
            </div>
          </div>
          <div className="bg-gray-800 dark:bg-gray-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl w-full sm:w-auto">
            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-600">Patient ID</p>
            <p className="text-white dark:text-gray-900 font-mono font-semibold text-xs sm:text-sm truncate">
              {patient.patientId || patient.patient_id || `${patient.id.slice(0, 8)}...`}
            </p>
          </div>
        </div>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Patient Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-3">Patient Information</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Condition</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{patient.condition}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Records</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{medicalRecords.length} docs</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Medications</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{patient.medications.length + prescriptionMedications.length}</p>
              </div>
            </div>
          </div>

          {/* Health Vitals Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Health Vitals</h3>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">Auto-updates</span>
            </div>
            <div className="space-y-2">
              {/* Blood Pressure */}
              <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <BloodPressureIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">BP</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {vitals?.bloodPressure?.value || 'N/A'}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">mmHg</span>
                  {vitals?.bloodPressure?.trend && vitals.bloodPressure.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {vitals.bloodPressure.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </div>

              {/* Heart Rate */}
              <div className="flex items-center justify-between p-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <FeatureVitalsIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">HR</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {vitals?.heartRate?.value || 'N/A'}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">bpm</span>
                  {vitals?.heartRate?.trend && vitals.heartRate.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      {vitals.heartRate.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </div>

              {/* Temperature */}
              <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <TemperatureIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Temp</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {vitals?.temperature?.value || 'N/A'}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">°F</span>
                  {vitals?.temperature?.trend && vitals.temperature.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                      {vitals.temperature.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Current Medications Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Medications</h3>
              <div className="flex items-center gap-2">
                {latestPrescription && (
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                    Rx: {new Date(latestPrescription.createdAt).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => setShowAddMedication(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
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
                {/* Prescription Medications */}
                {prescriptionMedications.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center mb-2">
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-wider">Prescribed</span>
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div className="space-y-2">
                      {prescriptionMedications.map((med, index) => (
                        <div key={`rx-${index}`} className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{med.name}</span>
                                <span className="text-[9px] bg-purple-200 dark:bg-purple-700 text-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded font-semibold shrink-0">Rx</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                {med.dosage} • {med.frequency}{med.timing ? ` • ${med.timing}` : ''}
                              </p>
                            </div>
                          </div>
                          {med.instructions && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 italic truncate">{med.instructions}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Patient Self-Managed Medications (Enhanced) */}
                {patientMedications.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-wider">Patient Tracked</span>
                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                      </div>
                      {adherenceStats && (
                        <span className={`text-xs font-bold ml-2 ${adherenceStats.adherencePercentage >= 80 ? 'text-green-600 dark:text-green-400' :
                          adherenceStats.adherencePercentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                          {adherenceStats.adherencePercentage}%
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {patientMedications.slice(0, 4).map((med) => (
                        <div key={med.id} className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 border border-rose-200 dark:border-rose-800">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{med.name}</span>
                                {med.category && (
                                  <span className="text-[9px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded shrink-0">{med.category}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                {med.dosage} {med.dosageUnit} • {med.scheduledTimes?.join(', ') || 'As needed'}
                              </p>
                            </div>
                            {med.reminderEnabled && (
                              <span className="text-sm ml-2 shrink-0">🔔</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {patientMedications.length > 4 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1.5">
                        +{patientMedications.length - 4} more
                      </p>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Case Details</h3>
              {caseDetails?.updatedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400 italic">
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
                        className="inline-flex items-center px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full"
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
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">{medicalRecords[0].type}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Medical Records</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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

        {/* Records List */}
        {filteredRecords.length > 0 ? (
          <div className="space-y-4">
            {filteredRecords.map((record, index) => {
              const isExpanded = expandedRecords.has(record.id);
              return (
                <div
                  key={record.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 animate-slideUp"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className={`${getCategoryColor(record.category)} p-4 rounded-2xl shadow-lg`}>
                        <DocumentIcon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3">
                          <div className="flex-1">
                            <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${getCategoryBadgeColor(record.category)} mb-2`}>
                              <TagIcon className="h-3.5 w-3.5 mr-1.5" />
                              {record.category}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{record.type}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                              {new Date(record.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {record.fileUrl && (
                              <a
                                href={record.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 rounded-xl bg-secondary-700 dark:bg-secondary-600 text-white dark:text-white hover:bg-secondary-800 dark:hover:bg-secondary-700 transition-all duration-200"
                                aria-label="Preview record"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-semibold text-gray-800 dark:text-gray-200">Doctor:</span> {record.doctor}
                            </p>
                            <button
                              onClick={() => toggleRecord(record.id)}
                              className="text-sm font-semibold text-rose-900 dark:text-rose-400 hover:text-rose-900 dark:hover:text-sky-300 transition-colors flex items-center gap-1"
                            >
                              {isExpanded ? (
                                <>
                                  <span>Hide Details</span>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </>
                              ) : (
                                <>
                                  <span>View Details</span>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </>
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-600 animate-fade-in">
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
  );
};

export default DoctorPatientView;
