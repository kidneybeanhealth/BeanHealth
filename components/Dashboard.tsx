import React, { useState, useRef, useEffect } from 'react';
import { Patient, Vitals, Medication } from '../types';
import MedicationCard from './MedicationCard';
import MedicationTimeline from './MedicationTimeline';
import { EditIcon } from './icons/EditIcon';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';
import BloodPressurePicker from './BloodPressurePicker';

interface DashboardProps {
  patient: Patient;
  onVitalsChange: (vitalKey: keyof Vitals, newValue: string) => Promise<void>;
  onMedicationChange: (medication: Medication) => void;
  onMedicationRemove: (medicationId: string) => void;
  onMedicationAdd: (medication: Omit<Medication, 'id'>) => void;
  vitalsLastUpdatedFromRecord?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    glucose?: string;
  };
  aiSummary?: string;
  onRefreshSummary?: () => Promise<void>;
  isSummaryLoading?: boolean;
  onSummaryChange?: (summary: string) => void;
  summaryNote?: string;
  onSummaryNoteChange?: (note: string) => void;
}

const VitalCard: React.FC<{
  icon: React.ReactNode;
  iconBgColor: string;
  label: string;
  value: string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  onSave: (newValue: string) => void;
  lastUpdatedFromRecord?: string;
  isBloodPressure?: boolean;
}> = ({ icon, iconBgColor, label, value, unit, trend, onSave, lastUpdatedFromRecord, isBloodPressure = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  // For blood pressure
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');

  const inputRef = useRef<HTMLInputElement>(null);
  const systolicRef = useRef<HTMLInputElement>(null);

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-secondary-700' : 'text-gray-600';

  useEffect(() => {
    if (isEditing) {
      if (isBloodPressure) {
        // Parse blood pressure value (e.g., "120/80" or "120")
        const parts = value.split('/');
        setSystolic(parts[0] || '120');
        setDiastolic(parts[1] || '80');
      } else {
        // For non-BP vitals, extract only numbers from value
        const numericValue = value.replace(/[^0-9.]/g, '');
        setCurrentValue(numericValue);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  }, [isEditing, value, isBloodPressure]);

  const handleSave = () => {
    if (isBloodPressure) {
      if (systolic.trim() && diastolic.trim()) {
        onSave(`${systolic}/${diastolic}`);
      } else if (systolic.trim()) {
        onSave(systolic);
      } else {
        const parts = value.split('/');
        setSystolic(parts[0] || '120');
        setDiastolic(parts[1] || '80');
      }
    } else {
      if (currentValue.trim() !== '') {
        onSave(currentValue);
      } else {
        setCurrentValue(value.replace(/[^0-9.]/g, ''));
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      if (isBloodPressure) {
        const parts = value.split('/');
        setSystolic(parts[0] || '120');
        setDiastolic(parts[1] || '80');
      } else {
        setCurrentValue(value.replace(/[^0-9.]/g, ''));
      }
      setIsEditing(false);
    }
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setValue: (val: string) => void) => {
    const value = e.target.value;
    // Strictly allow only numbers and one decimal point
    const numericValue = value.replace(/[^\d.]/g, '');

    // Prevent multiple decimal points
    const decimalCount = (numericValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      const parts = numericValue.split('.');
      setValue(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setValue(numericValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent non-numeric characters (except decimal point)
    const char = e.key;

    // Allow: numbers (0-9), decimal point (.), backspace, delete, arrow keys, tab, enter, escape
    const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'];

    if (!allowedKeys.includes(char)) {
      e.preventDefault();
      return;
    }

    // Prevent multiple decimal points
    const input = e.currentTarget;
    if (char === '.' && input.value.includes('.')) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Prevent pasting non-numeric content
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericValue = pastedText.replace(/[^\d.]/g, '');

    // Prevent multiple decimal points
    const decimalCount = (numericValue.match(/\./g) || []).length;
    if (decimalCount <= 1) {
      const input = e.currentTarget;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = input.value;
      const newValue = currentValue.substring(0, start) + numericValue + currentValue.substring(end);
      setCurrentValue(newValue);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-300/40 dark:border-gray-700/40 hover:border-secondary-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-300 animate-fade-in">
      <div className="relative flex flex-col">
        <div className="flex items-start justify-between mb-6">
          <div className={`p-4 rounded-2xl ${iconBgColor} transition-transform duration-300 group-hover:scale-110`}>
            {icon}
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-secondary-700"
            >
              <EditIcon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-500 tracking-wide">{label}</p>
          {isEditing ? (
            isBloodPressure ? (
              <BloodPressurePicker
                systolic={systolic}
                diastolic={diastolic}
                onSystolicChange={setSystolic}
                onDiastolicChange={setDiastolic}
                onSave={handleSave}
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={currentValue}
                onChange={(e) => handleNumberInput(e, setCurrentValue)}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder="Enter value"
                autoComplete="off"
                className="w-full bg-gray-50 dark:bg-gray-700 text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-secondary-700"
              />
            )
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-gray-100">{value || '—'}</p>
              <span className="text-base sm:text-lg font-medium text-gray-500 dark:text-gray-600">{unit}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            {trend && trend !== 'stable' && (
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                trendColor === 'text-red-500'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-400'
              }`}>
                <span className="text-sm">{trendArrow}</span>
                <span>{trend === 'up' ? 'Increasing' : 'Decreasing'}</span>
              </span>
            )}
            {lastUpdatedFromRecord && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-100 dark:bg-secondary-900/20 rounded-full text-xs font-medium text-secondary-700 dark:text-secondary-400">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Auto-synced
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({
    patient,
    onVitalsChange,
    onMedicationAdd,
    onMedicationChange,
    onMedicationRemove,
    vitalsLastUpdatedFromRecord
}) => {
  return (
    <div className="space-y-8 sm:space-y-12 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6">
      {/* Welcome Banner - Minimalist */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 sm:p-8 lg:p-12 border border-gray-300/50 dark:border-gray-700/50">
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">Health Dashboard</h2>
          <p className="text-gray-700 dark:text-gray-500 text-lg max-w-2xl leading-relaxed">Track your vitals, medications, and wellness journey</p>
        </div>
        {/* Subtle decorative element */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-gradient-to-br from-cyan-100/30 to-blue-100/30 dark:from-cyan-900/10 dark:to-blue-900/10 rounded-full blur-3xl"></div>
      </div>

      {/* Vitals Section - Ultra Clean Grid */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Your Vitals</h3>
          <span className="text-sm text-gray-600 dark:text-gray-500 font-medium">Updated today</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <VitalCard
            label="Blood Pressure"
            value={patient.vitals.bloodPressure.value}
            unit={patient.vitals.bloodPressure.unit}
            trend={patient.vitals.bloodPressure.trend}
            onSave={(newValue) => onVitalsChange('bloodPressure', newValue)}
            icon={<BloodPressureIcon className="h-7 w-7 text-red-600 dark:text-red-400" />}
            iconBgColor="bg-red-50 dark:bg-red-900/20"
            lastUpdatedFromRecord={vitalsLastUpdatedFromRecord?.bloodPressure}
            isBloodPressure={true}
          />
          <VitalCard
            label="Heart Rate"
            value={patient.vitals.heartRate.value}
            unit={patient.vitals.heartRate.unit}
            trend={patient.vitals.heartRate.trend}
            onSave={(newValue) => onVitalsChange('heartRate', newValue)}
            icon={<FeatureVitalsIcon className="h-7 w-7 text-secondary-700 dark:text-secondary-400" />}
            iconBgColor="bg-secondary-100 dark:bg-secondary-900/20"
            lastUpdatedFromRecord={vitalsLastUpdatedFromRecord?.heartRate}
          />
          <VitalCard
            label="Temperature"
            value={patient.vitals.temperature.value}
            unit={patient.vitals.temperature.unit}
            trend={patient.vitals.temperature.trend}
            onSave={(newValue) => onVitalsChange('temperature', newValue)}
            icon={<TemperatureIcon className="h-7 w-7 text-orange-600 dark:text-orange-400" />}
            iconBgColor="bg-orange-50 dark:bg-orange-900/20"
            lastUpdatedFromRecord={vitalsLastUpdatedFromRecord?.temperature}
          />
        </div>
      </div>

      {/* Medication Section - Clean Layout */}
      <div>
        <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6 sm:mb-8 tracking-tight">Medications</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MedicationCard
              medications={patient.medications}
              onAdd={onMedicationAdd}
              onChange={onMedicationChange}
              onRemove={onMedicationRemove}
          />
          <MedicationTimeline medications={patient.medications} />
        </div>
      </div>

    </div>
  );
};

export default Dashboard;



