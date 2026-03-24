import React, { useState, useEffect, useRef } from 'react';
import { Patient } from '../types';
import EnhancedMedicationCard from './EnhancedMedicationCard';
import FluidIntakeTracker from './FluidIntakeTracker';
import UpcomingTestsCard from './UpcomingTestsCard';
import VerticalScrollPicker from './VerticalScrollPicker';
import DailyVitalHistory from './DailyVitalHistory';
import { supabase } from '../lib/supabase';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { DoctorIcon } from './icons/DoctorIcon';
import { Activity, Droplets, Scale, Check, X, Pencil } from 'lucide-react';
import '@/styles/beanhealth-landing.css';
import { useLanguage } from '../contexts/LanguageContext';

/* ─── Helpers ────────────────────────────────────────────────────────── */
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
};

const TAMIL_DAYS   = ['ஞாயிறு','திங்கள்','செவ்வாய்','புதன்','வியாழன்','வெள்ளி','சனி'];
const TAMIL_MONTHS = ['ஜனவரி','பிப்ரவரி','மார்ச்','ஏப்ரல்','மே','ஜூன்','ஜூலை','ஆகஸ்ட்','செப்டம்பர்','அக்டோபர்','நவம்பர்','டிசம்பர்'];

const getGreeting = (isTamil: boolean): string => {
  const h = new Date().getHours();
  if (isTamil) {
    if (h >= 5  && h < 12) return 'காலை வணக்கம்';
    if (h >= 12 && h < 17) return 'மதிய வணக்கம்';
    if (h >= 17 && h < 21) return 'மாலை வணக்கம்';
    return 'இரவு வணக்கம்';
  }
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
};

const formatTodayDate = (isTamil: boolean): string => {
  const d = new Date();
  if (isTamil) {
    return `${TAMIL_DAYS[d.getDay()]}, ${d.getDate()} ${TAMIL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

interface CKDDashboardProps {
    patient: Patient;
    onNavigateToDoctors?: () => void;
    onNavigateToHealthProfile?: () => void;
}

/* ─── per-card inline vital editor ──────────────────────────────────── */
interface VitalCardProps {
    label: string;
    value: string | null;
    unit: string;
    icon: React.ReactNode;
    iconBg: string;
    accentColor: string;
    gradient: string;
    isBloodPressure?: boolean;
    onSave: (value: string) => Promise<void>;
    saveLabel?: string;
    savingLabel?: string;
    updateLabel?: string;
    systolicLabel?: string;
    diastolicLabel?: string;
}

const VitalCard: React.FC<VitalCardProps> = ({
    label, value, unit, icon, iconBg, accentColor, gradient,
    isBloodPressure = false, onSave,
    saveLabel, savingLabel, updateLabel,
    systolicLabel, diastolicLabel,
}) => {
    const [editing, setEditing] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const bpParts = (value ?? '').split('/');
    const [systolic, setSystolic] = useState(bpParts[0] || '120');
    const [diastolic, setDiastolic] = useState(bpParts[1] || '80');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            if (isBloodPressure) {
                const p = (value ?? '').split('/');
                setSystolic(p[0] || '120');
                setDiastolic(p[1] || '80');
            } else {
                setInputVal(value ?? '');
                setTimeout(() => inputRef.current?.focus(), 0);
            }
        }
    }, [editing]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const v = isBloodPressure ? `${systolic}/${diastolic}` : inputVal;
            if (v.trim()) await onSave(v);
        } finally {
            setSaving(false);
            setEditing(false);
        }
    };

    const displayValue = value ?? '—';

    return (
        <div className="glass-panel skeuomorph-card relative overflow-hidden rounded-[1.8rem] p-4 transition-all duration-300 hover:-translate-y-0.5">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} rounded-[1.8rem]`} />
            <div className="relative flex flex-col gap-3">
                {/* header */}
                <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}>
                        {icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                </div>

                {/* value / editor */}
                {editing ? (
                    <div className="space-y-3">
                        {isBloodPressure ? (
                            <div className="flex items-center gap-2 justify-center">
                                <VerticalScrollPicker
                                    value={parseInt(systolic) || 120}
                                    min={70} max={220}
                                    onChange={(v) => setSystolic(v.toString())}
                                    label={systolicLabel ?? 'Systolic'} unit="mmHg"
                                />
                                <span className="text-2xl font-bold text-slate-300">/</span>
                                <VerticalScrollPicker
                                    value={parseInt(diastolic) || 80}
                                    min={40} max={140}
                                    onChange={(v) => setDiastolic(v.toString())}
                                    label={diastolicLabel ?? 'Diastolic'} unit="mmHg"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="decimal"
                                    value={inputVal}
                                    onChange={(e) => setInputVal(e.target.value.replace(/[^\d.]/g, ''))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xl font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-400/40"
                                />
                                <span className="text-xs text-slate-400 shrink-0">{unit}</span>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
                            >
                                <Check className="h-3.5 w-3.5" />
                                {saving ? (savingLabel ?? 'Saving…') : (saveLabel ?? 'Save')}
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 hover:bg-slate-50"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-slate-950 tracking-tight">{displayValue}</span>
                            <span className={`text-xs font-medium ${accentColor}`}>{unit}</span>
                        </div>
                        <button
                            onClick={() => setEditing(true)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/50 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-white hover:border-slate-300 hover:text-slate-900 hover:shadow-sm"
                        >
                            <Pencil className="h-3 w-3" />
                            {updateLabel ?? 'Update'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────────────── */
type VitalStatus = 'normal' | 'borderline' | 'abnormal' | 'critical';

const CKDDashboard: React.FC<CKDDashboardProps> = ({ patient, onNavigateToDoctors, onNavigateToHealthProfile }) => {
    const [vitals, setVitals] = useState<{
        bloodPressure: string | null;
        glucose: string | null;
        urineOutput: string | null;
        weight: string | null;
    }>({ bloodPressure: null, glucose: null, urineOutput: null, weight: null });

    const { t, isTamil } = useLanguage();

    useEffect(() => { loadVitals(); }, [patient.id]);

    const loadVitals = async () => {
        try {
            const { start, end } = getTodayRange();
            const { data, error } = await supabase
                .from('vitals')
                .select('*')
                .eq('patient_id', patient.id)
                .gte('recorded_at', start)
                .lt('recorded_at', end)
                .order('recorded_at', { ascending: false })
                .limit(1)
                .single() as { data: any; error: any };

            if (error && error.code !== 'PGRST116') return;
            if (!data) return;

            setVitals({
                bloodPressure: data.blood_pressure_value ?? null,
                glucose: data.glucose_value ?? data.heart_rate_value ?? null,
                urineOutput: data.urine_output_value ?? data.spo2_value ?? null,
                weight: data.weight_value ?? data.temperature_value ?? null,
            });
        } catch (e) {
            console.error('Error loading vitals:', e);
        }
    };

    const saveVital = async (field: 'bloodPressure' | 'glucose' | 'urineOutput' | 'weight', value: string) => {
        const colMap: Record<string, string> = {
            bloodPressure: 'blood_pressure_value',
            glucose: 'glucose_value',
            urineOutput: 'urine_output_value',
            weight: 'weight_value',
        };
        const unitMap: Record<string, string> = {
            bloodPressure: 'mmHg',
            glucose: 'mg/dL',
            urineOutput: 'mL/day',
            weight: 'kg',
        };
        try {
            const { error } = await supabase
                .from('vitals')
                .insert({
                    patient_id: patient.id,
                    [colMap[field]]: value,
                    [`${colMap[field].replace('_value', '_unit')}`]: unitMap[field],
                    recorded_at: new Date().toISOString(),
                } as any);
            if (error) throw error;
            setVitals(prev => ({ ...prev, [field]: value }));
        } catch (e) {
            console.error('Error saving vital:', e);
        }
    };

    return (
        <div className="space-y-5 pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 mb-1">
                        {getGreeting(isTamil)}
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                        {patient.name}
                    </h1>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                        {formatTodayDate(isTamil)}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={onNavigateToDoctors}
                        className="glass-panel flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-950 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                    >
                        <DoctorIcon className="w-4 h-4" />
                        {t.dashboard.connectDoctor}
                    </button>
                    <button
                        onClick={onNavigateToHealthProfile}
                        className="glass-panel flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-950 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                    >
                        <span>📋</span>
                        {t.dashboard.healthProfile}
                    </button>
                </div>
            </div>

            {/* ── Vital Signs ─────────────────────────────────────── */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">{t.dashboard.vitalSigns}</p>
                <div className="grid grid-cols-2 gap-3">
                    <VitalCard
                        label={t.vitals.bloodPressure}
                        value={vitals.bloodPressure}
                        unit="mmHg"
                        icon={<BloodPressureIcon className="w-4 h-4 text-rose-500" />}
                        iconBg="bg-rose-50"
                        accentColor="text-rose-500"
                        gradient="from-rose-500/10 via-pink-400/6 to-transparent"
                        isBloodPressure
                        onSave={(v) => saveVital('bloodPressure', v)}
                        saveLabel={t.vitals.save}
                        savingLabel={t.vitals.saving}
                        updateLabel={t.vitals.update}
                        systolicLabel={t.vitals.systolic}
                        diastolicLabel={t.vitals.diastolic}
                    />
                    <VitalCard
                        label={t.vitals.bloodGlucose}
                        value={vitals.glucose}
                        unit="mg/dL"
                        icon={<Activity className="w-4 h-4 text-amber-500" />}
                        iconBg="bg-amber-50"
                        accentColor="text-amber-500"
                        gradient="from-amber-500/10 via-yellow-400/6 to-transparent"
                        onSave={(v) => saveVital('glucose', v)}
                        saveLabel={t.vitals.save}
                        savingLabel={t.vitals.saving}
                        updateLabel={t.vitals.update}
                    />
                    <VitalCard
                        label={t.vitals.urineOutput}
                        value={vitals.urineOutput}
                        unit="mL/day"
                        icon={<Droplets className="w-4 h-4 text-blue-500" />}
                        iconBg="bg-blue-50"
                        accentColor="text-blue-500"
                        gradient="from-blue-500/10 via-cyan-400/6 to-transparent"
                        onSave={(v) => saveVital('urineOutput', v)}
                        saveLabel={t.vitals.save}
                        savingLabel={t.vitals.saving}
                        updateLabel={t.vitals.update}
                    />
                    <VitalCard
                        label={t.vitals.bodyWeight}
                        value={vitals.weight}
                        unit="kg"
                        icon={<Scale className="w-4 h-4 text-emerald-500" />}
                        iconBg="bg-emerald-50"
                        accentColor="text-emerald-600"
                        gradient="from-emerald-500/10 via-teal-400/6 to-transparent"
                        onSave={(v) => saveVital('weight', v)}
                        saveLabel={t.vitals.save}
                        savingLabel={t.vitals.saving}
                        updateLabel={t.vitals.update}
                    />
                </div>
            </div>

            {/* ── Medications & Tracking ───────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-start">
                <EnhancedMedicationCard patientId={patient.id} />
                <div className="space-y-4 sm:space-y-5">
                    <FluidIntakeTracker
                        patientId={patient.id}
                        dailyTarget={(patient as any).dailyFluidTarget || (patient as any).daily_fluid_target}
                        ckdStage={(patient as any).ckdStage || (patient as any).ckd_stage}
                    />
                    <UpcomingTestsCard patientId={patient.id} />
                </div>
            </div>

            {/* ── Past Records ─────────────────────────────────────── */}
            <DailyVitalHistory patientId={patient.id} />
        </div>
    );
};

export default CKDDashboard;
