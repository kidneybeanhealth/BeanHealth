import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import PatientInfoCard from './PatientInfoCard';
import CaseDetailsCard from './CaseDetailsCard';
import EnhancedMedicationCard from './EnhancedMedicationCard';
import FluidIntakeTracker from './FluidIntakeTracker';
import LabResultsCard from './LabResultsCard';
import UpcomingTestsCard from './UpcomingTestsCard';
import PatientVisitHistoryView from './PatientVisitHistoryView';
import VerticalScrollPicker from './VerticalScrollPicker';
import { UserService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { HeartIcon } from './icons/HeartIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';
import { DoctorIcon } from './icons/DoctorIcon';

interface CKDDashboardProps {
    patient: Patient;
    onNavigateToDoctors?: () => void;
}

// Vital status type
type VitalStatus = 'normal' | 'borderline' | 'abnormal' | 'critical';

const CKDDashboard: React.FC<CKDDashboardProps> = ({ patient, onNavigateToDoctors }) => {
    const [vitals, setVitals] = useState<{
        bloodPressure: { systolic: number; diastolic: number } | null;
        heartRate: number | null;
        spo2: number | null;
        temperature: number | null;
    }>({
        bloodPressure: null,
        heartRate: null,
        spo2: null,
        temperature: null
    });
    const [isEditingVitals, setIsEditingVitals] = useState(false);
    const [editVitals, setEditVitals] = useState({
        systolic: '',
        diastolic: '',
        heartRate: '',
        spo2: '',
        temperature: ''
    });

    // Load vitals from database
    useEffect(() => {
        loadVitals();
    }, [patient.id]);

    const loadVitals = async () => {
        try {
            const { data, error } = await supabase
                .from('vitals')
                .select('*')
                .eq('patient_id', patient.id)
                .order('recorded_at', { ascending: false })
                .limit(1)
                .single() as { data: any; error: any };

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading vitals:', error);
                return;
            }

            if (data) {
                // Parse blood pressure
                let bp = null;
                if (data.blood_pressure_value) {
                    const bpMatch = data.blood_pressure_value.match(/(\d+)\/(\d+)/);
                    if (bpMatch) {
                        bp = { systolic: parseInt(bpMatch[1]), diastolic: parseInt(bpMatch[2]) };
                    }
                }

                setVitals({
                    bloodPressure: bp,
                    heartRate: data.heart_rate_value ? parseInt(data.heart_rate_value) : null,
                    spo2: data.spo2_value ? parseInt(data.spo2_value) : null,
                    temperature: data.temperature_value ? parseFloat(data.temperature_value) : null
                });
            }
        } catch (error) {
            console.error('Error loading vitals:', error);
        }
    };

    const handleSaveVitals = async () => {
        try {
            const bpValue = editVitals.systolic && editVitals.diastolic
                ? `${editVitals.systolic}/${editVitals.diastolic}`
                : null;

            const { error } = await supabase
                .from('vitals')
                .insert({
                    patient_id: patient.id,
                    blood_pressure_value: bpValue,
                    blood_pressure_unit: 'mmHg',
                    heart_rate_value: editVitals.heartRate || null,
                    heart_rate_unit: 'bpm',
                    spo2_value: editVitals.spo2 || null,
                    spo2_unit: '%',
                    temperature_value: editVitals.temperature || null,
                    temperature_unit: '°F',
                    recorded_at: new Date().toISOString()
                } as any);

            if (error) throw error;

            await loadVitals();
            setIsEditingVitals(false);
            setEditVitals({ systolic: '', diastolic: '', heartRate: '', spo2: '', temperature: '' });
        } catch (error) {
            console.error('Error saving vitals:', error);
            alert('Failed to save vitals');
        }
    };

    const getBPStatus = (systolic: number, diastolic: number): VitalStatus => {
        if (systolic >= 180 || diastolic >= 120) return 'critical';
        if (systolic >= 140 || diastolic >= 90) return 'abnormal';
        if (systolic >= 130 || diastolic >= 80) return 'borderline';
        return 'normal';
    };

    const getHRStatus = (hr: number): VitalStatus => {
        if (hr < 40 || hr > 150) return 'critical';
        if (hr < 50 || hr > 100) return 'abnormal';
        if (hr < 60 || hr > 90) return 'borderline';
        return 'normal';
    };

    const getSpO2Status = (spo2: number): VitalStatus => {
        if (spo2 < 90) return 'critical';
        if (spo2 < 94) return 'abnormal';
        if (spo2 < 96) return 'borderline';
        return 'normal';
    };

    const getStatusColor = (status: VitalStatus) => {
        switch (status) {
            case 'normal': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
            case 'borderline': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
            case 'abnormal': return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
            case 'critical': return 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
        }
    };

    const handleUpdatePatientInfo = async (updates: {
        age?: number;
        ckdStage?: string;
        comorbidities?: string[];
        baselineWeight?: number;
    }) => {
        try {
            const { error } = await supabase
                .from('users')
                // @ts-ignore - CKD fields exist in users table but types not fully resolved
                .update({
                    age: updates.age,
                    ckd_stage: updates.ckdStage,
                    comorbidities: updates.comorbidities,
                    baseline_weight: updates.baselineWeight
                })
                .eq('id', patient.id);
            if (error) throw error;
            window.location.reload();
        } catch (error) {
            console.error('Error updating patient info:', error);
            alert('Failed to update patient information');
        }
    };

    const firstName = patient.name.split(' ')[0];

    return (
        <div className="space-y-4 sm:space-y-5 md:space-y-6 pb-6 sm:pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#222222] dark:text-white tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-xs sm:text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-0.5 sm:mt-1">Managing your kidney health journey</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={onNavigateToDoctors}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-[#222222] dark:bg-white text-white dark:text-[#222222] text-xs sm:text-sm font-bold rounded-full transition-all duration-300 active:scale-95 hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-white/20 hover:-translate-y-0.5"
                    >
                        <DoctorIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden xs:inline">Connect with</span> Doctor
                    </button>
                </div>
            </div>

            {/* Vital Signs Section */}
            <div>


                {isEditingVitals ? (
                    <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-4 sm:p-6 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20 animate-fade-in">
                        {/* Unified Vitals Grid - Auto-adjusts layout */}
                        <div className="flex flex-col lg:flex-row items-center justify-between xl:justify-around gap-8 py-6 px-4 md:px-12 w-full max-w-5xl mx-auto">

                            {/* Group 1: Blood Pressure */}
                            <div className="flex items-start gap-4 sm:gap-6 relative group">
                                <div className="absolute -inset-4 bg-gray-50 dark:bg-white/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                                <VerticalScrollPicker
                                    value={parseInt(editVitals.systolic) || 120}
                                    min={70}
                                    max={220}
                                    onChange={(val) => setEditVitals({ ...editVitals, systolic: val.toString() })}
                                    label="Systolic"
                                    unit="mmHg"
                                />

                                {/* Visual Separator */}
                                <div className="flex items-center pt-8 sm:pt-10">
                                    <div className="text-3xl font-bold text-gray-300 dark:text-gray-600">/</div>
                                </div>

                                <VerticalScrollPicker
                                    value={parseInt(editVitals.diastolic) || 80}
                                    min={40}
                                    max={140}
                                    onChange={(val) => setEditVitals({ ...editVitals, diastolic: val.toString() })}
                                    label="Diastolic"
                                    unit="mmHg"
                                />
                            </div>

                            {/* Divider for Desktop */}
                            <div className="hidden lg:block w-px h-32 bg-gray-200 dark:bg-white/10" />

                            {/* Group 2: Heart Rate & SpO2 */}
                            <div className="flex items-start gap-8 sm:gap-12 md:gap-16 relative group">
                                <div className="absolute -inset-4 bg-gray-50 dark:bg-white/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                                <VerticalScrollPicker
                                    value={parseInt(editVitals.heartRate) || 72}
                                    min={40}
                                    max={200}
                                    onChange={(val) => setEditVitals({ ...editVitals, heartRate: val.toString() })}
                                    label="Heart Rate"
                                    unit="bpm"
                                />

                                <VerticalScrollPicker
                                    value={parseInt(editVitals.spo2) || 98}
                                    min={70}
                                    max={100}
                                    onChange={(val) => setEditVitals({ ...editVitals, spo2: val.toString() })}
                                    label="SpO2"
                                    unit="%"
                                />

                                <VerticalScrollPicker
                                    value={parseInt(editVitals.temperature) || 98}
                                    min={94}
                                    max={105}
                                    onChange={(val) => setEditVitals({ ...editVitals, temperature: val.toString() })}
                                    label="Temp"
                                    unit="°F"
                                />
                            </div>
                        </div>

                        {/* Current Reading Display */}
                        <div className="text-center py-4 mb-4 border-t border-b border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Current Readings</p>
                            <div className="flex items-center justify-center gap-6 flex-wrap">
                                <div>
                                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                                        {editVitals.systolic || '—'}/{editVitals.diastolic || '—'}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-1">mmHg</span>
                                </div>
                                <div>
                                    <span className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                        {editVitals.heartRate || '—'}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-1">bpm</span>
                                </div>
                                <div>
                                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                        {editVitals.spo2 || '—'}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-1">%</span>
                                </div>
                                <div>
                                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                        {editVitals.temperature || '—'}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-1">°F</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={handleSaveVitals}
                                className="min-w-[100px] px-4 py-2.5 bg-[#8AC43C] text-white dark:text-[#222222] text-xs font-bold rounded-full hover:bg-[#7ab332] transition-colors"
                            >
                                Save Readings
                            </button>
                            <button
                                onClick={() => setIsEditingVitals(false)}
                                className="min-w-[100px] px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-[#222222] dark:text-white text-xs font-bold rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="text-base sm:text-lg font-bold text-[#222222] dark:text-white">Vital Signs</h3>
                            <button
                                onClick={() => {
                                    setEditVitals({
                                        systolic: vitals.bloodPressure?.systolic?.toString() || '',
                                        diastolic: vitals.bloodPressure?.diastolic?.toString() || '',
                                        heartRate: vitals.heartRate?.toString() || '',
                                        spo2: vitals.spo2?.toString() || '',
                                        temperature: vitals.temperature?.toString() || ''
                                    });
                                    setIsEditingVitals(true);
                                }}
                                className="min-w-[70px] sm:min-w-[80px] px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold bg-[#8AC43C] text-white dark:text-[#222222] rounded-full hover:bg-[#7ab332] transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-[#8AC43C]/30 active:scale-95 active:shadow-none"
                            >
                                Update
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                            {/* Blood Pressure Card - Crimson/Deep Red */}
                            <div className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-500/20 dark:to-rose-600/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-red-200/50 dark:border-red-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/10">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                    <div className="p-1 sm:p-1.5 bg-red-500/20 dark:bg-red-500/30 rounded-md sm:rounded-lg">
                                        <BloodPressureIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 dark:text-red-400" />
                                    </div>
                                    <span className="text-[10px] sm:text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">BP</span>
                                </div>
                                <div>
                                    <span className="text-base sm:text-lg md:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.bloodPressure
                                            ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`
                                            : '—'}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-semibold text-red-500 dark:text-red-400 ml-0.5 sm:ml-1">mmHg</span>
                                </div>
                            </div>

                            {/* Heart Rate Card - Vibrant Pink/Magenta */}
                            <div className="bg-gradient-to-br from-pink-50 to-fuchsia-100 dark:from-pink-500/20 dark:to-fuchsia-600/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-pink-200/50 dark:border-pink-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-pink-500/10">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                    <div className="p-1 sm:p-1.5 bg-pink-500/20 dark:bg-pink-500/30 rounded-md sm:rounded-lg">
                                        <HeartIcon className="w-3 h-3 sm:w-4 sm:h-4 text-pink-600 dark:text-pink-400" />
                                    </div>
                                    <span className="text-[10px] sm:text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider">HR</span>
                                </div>
                                <div>
                                    <span className="text-base sm:text-lg md:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.heartRate ?? '—'}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-semibold text-pink-500 dark:text-pink-400 ml-0.5 sm:ml-1">bpm</span>
                                </div>
                            </div>

                            {/* SpO2 Card - Cyan/Teal for Oxygen */}
                            <div className="bg-gradient-to-br from-cyan-50 to-teal-100 dark:from-cyan-500/20 dark:to-teal-600/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-cyan-200/50 dark:border-cyan-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/10">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                    <div className="p-1 sm:p-1.5 bg-cyan-500/20 dark:bg-cyan-500/30 rounded-md sm:rounded-lg">
                                        <FeatureVitalsIcon className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <span className="text-[10px] sm:text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">SpO2</span>
                                </div>
                                <div>
                                    <span className="text-base sm:text-lg md:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.spo2 ?? '—'}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-semibold text-cyan-500 dark:text-cyan-400 ml-0.5 sm:ml-1">%</span>
                                </div>
                            </div>

                            {/* Temperature Card - Warm Amber/Orange */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-500/20 dark:to-orange-600/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200/50 dark:border-amber-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/10">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                    <div className="p-1 sm:p-1.5 bg-amber-500/20 dark:bg-amber-500/30 rounded-md sm:rounded-lg">
                                        <TemperatureIcon className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <span className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Temp</span>
                                </div>
                                <div>
                                    <span className="text-base sm:text-lg md:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.temperature ?? '—'}
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-semibold text-amber-500 dark:text-amber-400 ml-0.5 sm:ml-1">°F</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Dashboard Grid - Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {/* Left Column (Primary Info) */}
                <div className="xl:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
                    {/* Patient Information */}
                    <PatientInfoCard
                        patientId={patient.id}
                        age={(patient as any).age}
                        ckdStage={(patient as any).ckdStage || (patient as any).ckd_stage}
                        comorbidities={(patient as any).comorbidities || []}
                        baselineWeight={(patient as any).baselineWeight || (patient as any).baseline_weight}
                        onUpdate={handleUpdatePatientInfo}
                    />

                    {/* Case Details */}
                    <CaseDetailsCard patientId={patient.id} />

                    {/* Lab Results */}
                    <LabResultsCard patientId={patient.id} />

                    {/* Visit History - Same cards as doctor view */}
                    <PatientVisitHistoryView patientId={patient.id} readOnly={true} />
                </div>

                {/* Right Column (Management & Tracking) */}
                <div className="space-y-4 sm:space-y-5 md:space-y-6">
                    {/* Enhanced Medications with Adherence Tracking */}
                    <EnhancedMedicationCard patientId={patient.id} />

                    {/* Fluid Intake Tracking */}
                    <FluidIntakeTracker
                        patientId={patient.id}
                        dailyTarget={(patient as any).dailyFluidTarget || (patient as any).daily_fluid_target}
                        ckdStage={(patient as any).ckdStage || (patient as any).ckd_stage}
                    />

                    {/* Upcoming Tests */}
                    <UpcomingTestsCard patientId={patient.id} />
                </div>
            </div>
        </div>
    );
};

export default CKDDashboard;
