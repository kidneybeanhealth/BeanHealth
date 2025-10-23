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
      <div className="bg-gradient-to-r from-rose-500 to-rose-900 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={onBack} 
              className="p-3 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all duration-200 hover:scale-110"
            >
              <ArrowLeftIcon className="h-6 w-6 text-white"/>
            </button>
            <div className={`h-16 w-16 ${getInitialsColor(patient.name, patient.email)} rounded-2xl flex items-center justify-center shadow-lg`}>
              <span className="text-white text-xl font-bold">
                {getInitials(patient.name, patient.email)}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{patient.name}</h1>
              <p className="text-sky-100 text-sm mt-1">{patient.email}</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
            <p className="text-xs text-sky-100">Patient ID</p>
            <p className="text-white font-mono font-semibold">{patient.id.slice(0, 12)}...</p>
          </div>
        </div>
      </div>

      {/* Patient Info and Health Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        {/* Current Medications Card */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
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

        {/* Health Vitals Card */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Health Vitals</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50 rounded-lg shadow-md">
                  <BloodPressureIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                {patient.vitals?.bloodPressure?.trend && patient.vitals.bloodPressure.trend !== 'stable' && (
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {patient.vitals.bloodPressure.trend === 'up' ? '↑' : '↓'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Blood Pressure</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                {patient.vitals?.bloodPressure?.value || 'N/A'}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{patient.vitals?.bloodPressure?.unit || 'mmHg'}</p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-sky-100 dark:from-rose-900/20 dark:to-sky-800/20 rounded-xl p-4 border border-sky-200 dark:border-sky-800">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gradient-to-br from-sky-100 to-sky-200 dark:from-rose-900/50 dark:to-sky-800/50 rounded-lg shadow-md">
                  <FeatureVitalsIcon className="h-5 w-5 text-rose-900 dark:text-rose-400" />
                </div>
                {patient.vitals?.heartRate?.trend && patient.vitals.heartRate.trend !== 'stable' && (
                  <span className="text-xs font-semibold text-rose-900 dark:text-rose-400">
                    {patient.vitals.heartRate.trend === 'up' ? '↑' : '↓'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Heart Rate</p>
              <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">
                {patient.vitals?.heartRate?.value || 'N/A'}
              </p>
              <p className="text-xs text-rose-900 dark:text-rose-400 mt-1">{patient.vitals?.heartRate?.unit || 'bpm'}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/50 dark:to-orange-800/50 rounded-lg shadow-md">
                  <TemperatureIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                {patient.vitals?.temperature?.trend && patient.vitals.temperature.trend !== 'stable' && (
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                    {patient.vitals.temperature.trend === 'up' ? '↑' : '↓'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Temperature</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {patient.vitals?.temperature?.value || 'N/A'}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{patient.vitals?.temperature?.unit || '°F'}</p>
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
