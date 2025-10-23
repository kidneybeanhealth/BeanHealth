import React, { useState } from 'react';
import { Patient, MedicalRecord } from '../types';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { TagIcon } from './icons/TagIcon';
import { EyeIcon } from './icons/EyeIcon';
import RichSummaryDisplay from './RichSummaryDisplay';

interface DoctorPatientViewProps {
  patient: Patient;
  onBack: () => void;
}

const DoctorPatientView: React.FC<DoctorPatientViewProps> = ({ patient, onBack }) => {
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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
  const recordsByCategory = patient.records.reduce((acc, record) => {
    const category = record.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(record);
    return acc;
  }, {} as Record<string, MedicalRecord[]>);

  const categories = ['all', ...Object.keys(recordsByCategory).sort()];

  const filteredRecords = selectedCategory === 'all' 
    ? patient.records 
    : recordsByCategory[selectedCategory] || [];

  const getCategoryColor = (category: string) => {
    switch(category.toLowerCase()) {
      case 'lab report': return 'bg-blue-500';
      case 'prescription': return 'bg-purple-500';
      case 'medical image': return 'bg-amber-500';
      case 'doctor\'s note': return 'bg-emerald-500';
      default: return 'bg-slate-500';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch(category.toLowerCase()) {
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
      <div className="bg-gradient-to-r from-rose-500 to-rose-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
            <button 
              onClick={onBack} 
              className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all duration-200 hover:scale-110 flex-shrink-0"
            >
              <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white"/>
            </button>
            <div className={`h-12 w-12 sm:h-16 sm:w-16 ${getInitialsColor(patient.name, patient.email)} rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0`}>
              <span className="text-white text-base sm:text-xl font-bold">
                {getInitials(patient.name, patient.email)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">{patient.name}</h1>
              <p className="text-sky-100 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{patient.email}</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl w-full sm:w-auto">
            <p className="text-[10px] sm:text-xs text-sky-100">Patient ID</p>
            <p className="text-white font-mono font-semibold text-xs sm:text-sm truncate">{patient.id.slice(0, 12)}...</p>
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
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{patient.records.length} documents</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Medications</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{patient.medications.length} active</p>
              </div>
            </div>
          </div>

          {/* Health Vitals Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Health Vitals</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <BloodPressureIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Blood Pressure</p>
                  </div>
                  {patient.vitals?.bloodPressure?.trend && patient.vitals.bloodPressure.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {patient.vitals.bloodPressure.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-10">
                  {patient.vitals?.bloodPressure?.value || 'N/A'} <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{patient.vitals?.bloodPressure?.unit || 'mmHg'}</span>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                      <FeatureVitalsIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Heart Rate</p>
                  </div>
                  {patient.vitals?.heartRate?.trend && patient.vitals.heartRate.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      {patient.vitals.heartRate.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-10">
                  {patient.vitals?.heartRate?.value || 'N/A'} <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{patient.vitals?.heartRate?.unit || 'bpm'}</span>
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
                  {patient.vitals?.temperature?.trend && patient.vitals.temperature.trend !== 'stable' && (
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                      {patient.vitals.temperature.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-10">
                  {patient.vitals?.temperature?.value || 'N/A'} <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{patient.vitals?.temperature?.unit || '°F'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Current Medications Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Current Medications</h3>
            {patient.medications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {patient.medications.slice(0, 4).map((med) => (
                  <div key={med.id} className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{med.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{med.dosage}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{med.frequency}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No medications recorded</p>
            )}
          </div>

          {/* Case Details Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Case Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Case</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{patient.condition}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Complaint</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">No complaint recorded</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">History</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">No history recorded</p>
              </div>
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
                    ? 'bg-gradient-to-r from-rose-500 to-rose-900 text-white shadow-lg scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category === 'all' ? 'All Records' : category}
                {category !== 'all' && (
                  <span className="ml-2 px-2 py-0.5 bg-white/30 rounded-full text-xs">
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
                  className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-700 dark:to-slate-800 rounded-2xl border-2 border-gray-200 dark:border-gray-600 overflow-hidden hover:shadow-xl transition-all duration-300 animate-slideUp"
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
                                className="p-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-900 text-white hover:shadow-lg hover:scale-110 transition-all duration-200"
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
