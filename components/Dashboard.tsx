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
  label: string;
  value: string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  onSave: (newValue: string) => void;
  lastUpdatedFromRecord?: string;
  isBloodPressure?: boolean;
  colorClass?: string;
}> = ({ icon, label, value, unit, trend, onSave, lastUpdatedFromRecord, isBloodPressure = false, colorClass = "text-gray-900" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  
  // Initialize blood pressure values from the value prop
  const bpParts = value.split('/');
  const [systolic, setSystolic] = useState(bpParts[0] || '120');
  const [diastolic, setDiastolic] = useState(bpParts[1] || '80');

  const inputRef = useRef<HTMLInputElement>(null);

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-rose-500' : trend === 'down' ? 'text-emerald-500' : 'text-gray-400';

  // Sync blood pressure values when value prop changes
  useEffect(() => {
    if (isBloodPressure) {
      const parts = value.split('/');
      setSystolic(parts[0] || '120');
      setDiastolic(parts[1] || '80');
    }
  }, [value, isBloodPressure]);

  useEffect(() => {
    if (isEditing && !isBloodPressure) {
      const numericValue = value.replace(/[^0-9.]/g, '');
      setCurrentValue(numericValue);
      setTimeout(() => inputRef.current?.focus(), 0);
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
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') setIsEditing(false);
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setValue: (val: string) => void) => {
    const value = e.target.value;
    const numericValue = value.replace(/[^\d.]/g, '');
    const decimalCount = (numericValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      const parts = numericValue.split('.');
      setValue(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setValue(numericValue);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 border border-transparent dark:border-gray-800">
      <div className="flex flex-col h-full justify-between gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider">{label}</h3>
          <div className={`p-2 rounded-full bg-gray-50 dark:bg-gray-800 ${colorClass}`}>
            {icon}
          </div>
        </div>

        <div>
          {isBloodPressure ? (
            /* Blood Pressure always shows the scroll picker */
            <BloodPressurePicker
              systolic={systolic}
              diastolic={diastolic}
              onSystolicChange={setSystolic}
              onDiastolicChange={setDiastolic}
              onSave={handleSave}
            />
          ) : isEditing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={currentValue}
              onChange={(e) => handleNumberInput(e, setCurrentValue)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full bg-gray-50 dark:bg-gray-800 text-3xl font-bold text-[#222222] dark:text-[#f7f7f7] px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#222222] transition-all"
            />
          ) : (
            <div className="flex items-baseline gap-1 group/value cursor-pointer" onClick={() => setIsEditing(true)}>
              <span className="text-4xl font-extrabold text-[#222222] dark:text-[#f7f7f7] tracking-tight">{value || '—'}</span>
              <span className="text-sm font-medium text-[#717171] dark:text-[#888888]">{unit}</span>
              <EditIcon className="h-4 w-4 text-gray-300 opacity-0 group-hover/value:opacity-100 transition-opacity ml-2" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between min-h-[24px]">
          {trend && trend !== 'stable' && (
            <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
              <span>{trendArrow}</span>
              <span>{trend === 'up' ? 'Increase' : 'Decrease'}</span>
            </div>
          )}
          {lastUpdatedFromRecord && (
            <span className="text-[10px] font-bold text-[#717171] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
              AUTOSYNC
            </span>
          )}
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
    <div className="space-y-10 pb-12 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#222222] dark:text-white tracking-tight leading-tight">
            Hello, <br />
            <span className="text-[#3A2524] dark:text-[#e6b8a3]">{patient.name}</span>
          </h1>
        </div>
        <div className="flex items-center">
          <div className="bg-white dark:bg-[#1e1e1e] px-5 py-2.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-none border border-gray-100 dark:border-gray-800">
            <span className="text-sm font-semibold text-[#222222] dark:text-[#e0e0e0]">
              Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Vitals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <VitalCard
          label="Blood Pressure"
          value={patient.vitals.bloodPressure.value}
          unit={patient.vitals.bloodPressure.unit}
          trend={patient.vitals.bloodPressure.trend}
          onSave={(newValue) => onVitalsChange('bloodPressure', newValue)}
          icon={<BloodPressureIcon className="w-5 h-5" />}
          colorClass="text-rose-500"
          lastUpdatedFromRecord={vitalsLastUpdatedFromRecord?.bloodPressure}
          isBloodPressure={true}
        />
        <VitalCard
          label="Heart Rate"
          value={patient.vitals.heartRate.value}
          unit={patient.vitals.heartRate.unit}
          trend={patient.vitals.heartRate.trend}
          onSave={(newValue) => onVitalsChange('heartRate', newValue)}
          icon={<FeatureVitalsIcon className="w-5 h-5" />}
          colorClass="text-cyan-500"
          lastUpdatedFromRecord={vitalsLastUpdatedFromRecord?.heartRate}
        />
        <VitalCard
          label="Temperature"
          value={patient.vitals.temperature.value}
          unit={patient.vitals.temperature.unit}
          trend={patient.vitals.temperature.trend}
          onSave={(newValue) => onVitalsChange('temperature', newValue)}
          icon={<TemperatureIcon className="w-5 h-5" />}
          colorClass="text-orange-500"
          lastUpdatedFromRecord={vitalsLastUpdatedFromRecord?.temperature}
        />
      </div>

      {/* Medications Section */}
      <div>
        <div className="flex items-center justify-between mb-6 px-1">
          <h2 className="text-2xl font-bold text-[#222222] dark:text-white">Active Medications</h2>
          <button className="text-sm font-semibold text-[#222222] dark:text-white underline decoration-2 underline-offset-4 hover:text-[#3A2524] transition-colors">
            View History
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
