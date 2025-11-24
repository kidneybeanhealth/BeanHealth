import React, { useState, useEffect, useCallback } from 'react';
import { Patient, MedicalRecord, Prescription, PrescriptionMedication } from '../types';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { TagIcon } from './icons/TagIcon';
import { EyeIcon } from './icons/EyeIcon';
import RichSummaryDisplay from './RichSummaryDisplay';
import { PrescriptionService } from '../services/prescriptionService';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { VitalsService } from '../services/dataService';
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
  }, [fetchLatestPrescription, fetchMedicalRecords, fetchVitals]);

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
    switch(category.toLowerCase()) {
      case 'lab report': return 'bg-secondary-500';
      case 'prescription': return 'bg-purple-500';
      case 'medical image': return 'bg-secondary-500';
      case 'doctor\'s note': return 'bg-secondary-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch(category.toLowerCase()) {
      case 'lab report': return 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300';
      case 'prescription': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'medical image': return 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300';
      case 'doctor\'s note': return 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300';
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
              <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white dark:text-white"/>
            </button>
            <div className={`h-12 w-12 sm:h-16 sm:w-16 ${getInitialsColor(patient.name, patient.email)} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-base sm:text-xl font-bold">
                {getInitials(patient.name, patient.email)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white dark:text-white truncate">{patient.name}</h1>
              <p className="text-gray-300 dark:text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{patient.email}</p>
            </div>
          </div>
          <div className="bg-gray-800 dark:bg-gray-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl w-full sm:w-auto">
            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-600">Patient ID</p>
            <p className="text-white dark:text-white font-mono font-semibold text-xs sm:text-sm truncate">{patient.id.slice(0, 12)}...</p>
          </div>
        </div>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Patient Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Patient Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Condition</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{patient.condition}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Records</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{medicalRecords.length} documents</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Medications</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {patient.medications.length} manual + {prescriptionMedications.length} prescribed
                </p>
              </div>
            </div>
          </div>

          {/* Health Vitals Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Health Vitals</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 italic">Auto-updates from records</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <BloodPressureIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Blood Pressure</p>
                  </div>
                  {vitals?.bloodPressure?.trend && vitals.bloodPressure.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {vitals.bloodPressure.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-10">
                  {vitals?.bloodPressure?.value || 'N/A'} <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{vitals?.bloodPressure?.unit || 'mmHg'}</span>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg">
                      <FeatureVitalsIcon className="h-4 w-4 text-secondary-600 dark:text-secondary-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Heart Rate</p>
                  </div>
                  {vitals?.heartRate?.trend && vitals.heartRate.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-secondary-600 dark:text-secondary-400">
                      {vitals.heartRate.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-10">
                  {vitals?.heartRate?.value || 'N/A'} <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{vitals?.heartRate?.unit || 'bpm'}</span>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <TemperatureIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Temperature</p>
                  </div>
                  {vitals?.temperature?.trend && vitals.temperature.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                      {vitals.temperature.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-10">
                  {vitals?.temperature?.value || 'N/A'} <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{vitals?.temperature?.unit || '°F'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Current Medications Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Current Medications</h3>
              {latestPrescription && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-lg font-semibold">
                  Latest Rx: {new Date(latestPrescription.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {isLoadingPrescription ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-900 dark:border-rose-400"></div>
              </div>
            ) : (
              <>
                {/* Prescription Medications */}
                {prescriptionMedications.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center mb-3">
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 px-2">PRESCRIBED MEDICATIONS</span>
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {prescriptionMedications.map((med, index) => (
                        <div key={`rx-${index}`} className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-3 border border-purple-200 dark:border-purple-700">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{med.name}</p>
                            <span className="text-[10px] bg-purple-200 dark:bg-purple-700 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full font-semibold">Rx</span>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                            <span className="font-semibold">Dosage:</span> {med.dosage}
                          </p>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                            <span className="font-semibold">Frequency:</span> {med.frequency}
                          </p>
                          {med.duration && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              <span className="font-semibold">Duration:</span> {med.duration}
                            </p>
                          )}
                          {med.timing && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              <span className="font-semibold">Timing:</span> {med.timing}
                            </p>
                          )}
                          {med.instructions && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                              {med.instructions}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Medications */}
                {patient.medications.length > 0 && (
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
                {prescriptionMedications.length === 0 && patient.medications.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No medications recorded</p>
                )}
              </>
            )}
          </div>

          {/* Case Details Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Case Details</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 italic">Auto-updates from records</span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Primary Condition</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{patient.condition}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Latest Complaint / Chief Issue</p>
                {latestComplaint ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{latestComplaint}</p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">No recent complaint recorded</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Medical History</p>
                {caseHistory ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{caseHistory}</p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">No medical history extracted from records</p>
                )}
              </div>
              {medicalRecords.length > 0 && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">Latest Record</p>
                  <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-3 border border-secondary-200 dark:border-secondary-800">
                    <p className="text-xs font-semibold text-secondary-900 dark:text-secondary-300">{medicalRecords[0].type}</p>
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
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  selectedCategory === category
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
                              <TagIcon className="h-3.5 w-3.5 mr-1.5"/>
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
                              className="text-sm font-semibold text-rose-900 dark:text-rose-400 hover:text-rose-900 dark:hover:text-secondary-300 transition-colors flex items-center gap-1"
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


