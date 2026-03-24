import React, { useState, useRef, useEffect } from 'react';
import { Patient, Vitals, Medication } from '../types';
import MedicationCard from './MedicationCard';
import MedicationTimeline from './MedicationTimeline';
import BloodPressurePicker from './BloodPressurePicker';
import '@/styles/beanhealth-landing.css';

/* ── Icons ─────────────────────────────────────────────────────────── */
import { Activity, Droplets, Pencil, Scale, Check, X } from 'lucide-react';
import { BloodPressureIcon } from './icons/BloodPressureIcon';

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
    weight?: string;
    urineOutput?: string;
  };
  aiSummary?: string;
  onRefreshSummary?: () => Promise<void>;
  isSummaryLoading?: boolean;
  onSummaryChange?: (summary: string) => void;
  summaryNote?: string;
  onSummaryNoteChange?: (note: string) => void;
}

/* ── VitalCard ─────────────────────────────────────────────────────── */
interface VitalCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  onSave: (newValue: string) => void;
  isBloodPressure?: boolean;
  autoSync?: boolean;
  gradient: string;
  iconBg: string;
  accentColor: string;
}

const VitalCard: React.FC<VitalCardProps> = ({
  icon, label, value, unit, trend, onSave,
  isBloodPressure = false, autoSync,
  gradient, iconBg, accentColor,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value.replace(/[^0-9.]/g, ''));
  const bpParts = value.split('/');
  const [systolic, setSystolic] = useState(bpParts[0] || '120');
  const [diastolic, setDiastolic] = useState(bpParts[1] || '80');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isBloodPressure) {
      const p = value.split('/');
      setSystolic(p[0] || '120');
      setDiastolic(p[1] || '80');
    }
  }, [value, isBloodPressure]);

  useEffect(() => {
    if (isEditing && !isBloodPressure) {
      setInputVal(value.replace(/[^0-9.]/g, ''));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value, isBloodPressure]);

  const handleSave = () => {
    if (isBloodPressure) {
      if (systolic.trim() && diastolic.trim()) onSave(`${systolic}/${diastolic}`);
    } else {
      if (inputVal.trim()) onSave(inputVal);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputVal(value.replace(/[^0-9.]/g, ''));
    if (isBloodPressure) {
      const p = value.split('/');
      setSystolic(p[0] || '120');
      setDiastolic(p[1] || '80');
    }
  };

  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    const parts = raw.split('.');
    setter(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw);
  };

  const trendText = trend === 'up' ? '↑ Rising' : trend === 'down' ? '↓ Falling' : null;
  const trendColor = trend === 'up' ? 'text-rose-500' : trend === 'down' ? 'text-emerald-500' : '';

  return (
    <div className={`glass-panel skeuomorph-card relative overflow-hidden rounded-[2rem] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.09)]`}>
      {/* gradient wash */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} rounded-[2rem]`} />

      <div className="relative flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
              {icon}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
          </div>
          {autoSync && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-500">
              autosync
            </span>
          )}
        </div>

        {/* Value display / editing */}
        {isEditing ? (
          <div className="space-y-3">
            {isBloodPressure ? (
              <BloodPressurePicker
                systolic={systolic}
                diastolic={diastolic}
                onSystolicChange={setSystolic}
                onDiastolicChange={setDiastolic}
                onSave={handleSave}
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={inputVal}
                  onChange={(e) => handleNumericInput(e, setInputVal)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); else if (e.key === 'Escape') handleCancel(); }}
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-2xl font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-400/40"
                />
                <span className="text-sm text-slate-400 shrink-0">{unit}</span>
              </div>
            )}

            {/* Save / Cancel */}
            {!isBloodPressure && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <Check className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-950 tracking-tight">{value || '—'}</span>
              <span className={`text-sm font-medium ${accentColor}`}>{unit}</span>
            </div>

            {trendText && (
              <span className={`text-xs font-semibold ${trendColor}`}>{trendText}</span>
            )}

            {/* Per-card Update button */}
            <button
              onClick={() => setIsEditing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-white hover:border-slate-300 hover:text-slate-900 hover:shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Update
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Dashboard ─────────────────────────────────────────────────────── */
const Dashboard: React.FC<DashboardProps> = ({
  patient,
  onVitalsChange,
  onMedicationAdd,
  onMedicationChange,
  onMedicationRemove,
  vitalsLastUpdatedFromRecord,
}) => {
  const vitals = patient.vitals;

  return (
    <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4 pt-4 sm:pt-6">

      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-2">Patient Portal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight leading-tight">
            Hello, <span className="text-secondary-500">{patient.name}</span>
          </h1>
        </div>
        <div className="glass-panel px-4 py-2 rounded-full shrink-0">
          <span className="text-xs font-semibold text-slate-600">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Section label */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-4">Vital Signs</p>

        {/* 2-column vitals grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* Blood Pressure */}
          <VitalCard
            label="Blood Pressure"
            value={vitals.bloodPressure.value}
            unit={vitals.bloodPressure.unit}
            trend={vitals.bloodPressure.trend}
            onSave={(v) => onVitalsChange('bloodPressure', v)}
            icon={<BloodPressureIcon className="w-4 h-4 text-rose-500" />}
            iconBg="bg-rose-50"
            accentColor="text-rose-500"
            gradient="from-rose-500/10 via-pink-400/6 to-transparent"
            autoSync={!!vitalsLastUpdatedFromRecord?.bloodPressure}
            isBloodPressure
          />

          {/* Blood Glucose */}
          <VitalCard
            label="Blood Glucose"
            value={vitals.glucose?.value || '—'}
            unit={vitals.glucose?.unit || 'mg/dL'}
            trend={vitals.glucose?.trend}
            onSave={(v) => onVitalsChange('glucose', v)}
            icon={<Activity className="w-4 h-4 text-amber-500" />}
            iconBg="bg-amber-50"
            accentColor="text-amber-500"
            gradient="from-amber-500/10 via-yellow-400/6 to-transparent"
            autoSync={!!vitalsLastUpdatedFromRecord?.glucose}
          />

          {/* Urine Output */}
          <VitalCard
            label="Urine Output"
            value={vitals.urineOutput?.value || '—'}
            unit={vitals.urineOutput?.unit || 'mL/day'}
            trend={vitals.urineOutput?.trend}
            onSave={(v) => onVitalsChange('urineOutput', v)}
            icon={<Droplets className="w-4 h-4 text-blue-500" />}
            iconBg="bg-blue-50"
            accentColor="text-blue-500"
            gradient="from-blue-500/10 via-cyan-400/6 to-transparent"
            autoSync={!!vitalsLastUpdatedFromRecord?.urineOutput}
          />

          {/* Body Weight */}
          <VitalCard
            label="Body Weight"
            value={vitals.weight?.value || '—'}
            unit={vitals.weight?.unit || 'kg'}
            trend={vitals.weight?.trend}
            onSave={(v) => onVitalsChange('weight', v)}
            icon={<Scale className="w-4 h-4 text-emerald-500" />}
            iconBg="bg-emerald-50"
            accentColor="text-emerald-600"
            gradient="from-emerald-500/10 via-teal-400/6 to-transparent"
            autoSync={!!vitalsLastUpdatedFromRecord?.weight}
          />
        </div>
      </div>

      {/* Medications Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Active Medications</p>
          <button className="text-xs font-semibold text-slate-400 hover:text-secondary-600 transition-colors">
            View History
          </button>
        </div>
        <div className="space-y-4">
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
