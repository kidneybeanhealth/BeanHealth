import React, { useState, useEffect } from 'react';
import { Patient, Vitals } from '../types';
import PatientInfoCard from './PatientInfoCard';
import CaseDetailsCard from './CaseDetailsCard';
import EnhancedMedicationCard from './EnhancedMedicationCard';
import FluidIntakeTracker from './FluidIntakeTracker';
import LabResultsCard from './LabResultsCard';
import UpcomingTestsCard from './UpcomingTestsCard';
import { UserService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { BloodPressureIcon } from './icons/BloodPressureIcon';
import { HeartIcon } from './icons/HeartIcon';
import { TemperatureIcon } from './icons/TemperatureIcon';
import { FeatureVitalsIcon } from './icons/FeatureVitalsIcon';

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
                .single();

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
                });

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
            await UserService.updateUser(patient.id, {
                age: updates.age,
                ckd_stage: updates.ckdStage,
                comorbidities: updates.comorbidities,
                baseline_weight: updates.baselineWeight
            });
            window.location.reload();
        } catch (error) {
            console.error('Error updating patient info:', error);
            alert('Failed to update patient information');
        }
    };

    const firstName = patient.name.split(' ')[0];

    return (
        <div className="space-y-6 pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#222222] dark:text-white tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-1">Managing your kidney health journey</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onNavigateToDoctors}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#222222] dark:bg-white text-white dark:text-[#222222] text-sm font-bold rounded-full transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Connect with Doctor
                    </button>
                </div>
            </div>

            {/* Vital Signs Section */}
            <div>


                {isEditingVitals ? (
                    <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-6 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-2">Systolic</label>
                                <input
                                    type="number"
                                    value={editVitals.systolic}
                                    onChange={(e) => setEditVitals({ ...editVitals, systolic: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                                    placeholder="120"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-2">Diastolic</label>
                                <input
                                    type="number"
                                    value={editVitals.diastolic}
                                    onChange={(e) => setEditVitals({ ...editVitals, diastolic: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                                    placeholder="80"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-2">Heart Rate</label>
                                <input
                                    type="number"
                                    value={editVitals.heartRate}
                                    onChange={(e) => setEditVitals({ ...editVitals, heartRate: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                                    placeholder="72"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-2">SpO2</label>
                                <input
                                    type="number"
                                    value={editVitals.spo2}
                                    onChange={(e) => setEditVitals({ ...editVitals, spo2: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                                    placeholder="98"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={handleSaveVitals}
                                className="px-6 py-2.5 bg-[#8AC43C] text-white dark:text-[#222222] font-semibold rounded-full hover:bg-[#7ab332] transition-colors"
                            >
                                Save Readings
                            </button>
                            <button
                                onClick={() => setIsEditingVitals(false)}
                                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-[#222222] dark:text-white font-semibold rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-[#222222] dark:text-white">Vital Signs</h3>
                            <button
                                onClick={() => setIsEditingVitals(true)}
                                className="px-4 py-2 text-xs font-bold bg-[#8AC43C] text-white dark:text-[#222222] rounded-full hover:bg-[#7ab332] transition-colors"
                            >
                                Update
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Blood Pressure Card */}
                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 transition-all hover:scale-[1.02]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                        <BloodPressureIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    </div>
                                    <span className="text-xs font-bold text-red-600 dark:text-red-300 uppercase tracking-wider">BP</span>
                                </div>
                                <div>
                                    <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.bloodPressure
                                            ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`
                                            : '—'}
                                    </span>
                                    <span className="text-xs font-semibold text-red-600/70 dark:text-red-400/70 ml-1">mmHg</span>
                                </div>
                            </div>

                            {/* Heart Rate Card */}
                            <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/20 transition-all hover:scale-[1.02]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                        <HeartIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <span className="text-xs font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider">Heart Rate</span>
                                </div>
                                <div>
                                    <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.heartRate ?? '—'}
                                    </span>
                                    <span className="text-xs font-semibold text-rose-600/70 dark:text-rose-400/70 ml-1">bpm</span>
                                </div>
                            </div>

                            {/* SpO2 Card */}
                            <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-2xl border border-sky-100 dark:border-sky-900/20 transition-all hover:scale-[1.02]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                                        <FeatureVitalsIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                    </div>
                                    <span className="text-xs font-bold text-sky-600 dark:text-sky-300 uppercase tracking-wider">SpO2</span>
                                </div>
                                <div>
                                    <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.spo2 ?? '—'}
                                    </span>
                                    <span className="text-xs font-semibold text-sky-600/70 dark:text-sky-400/70 ml-1">%</span>
                                </div>
                            </div>

                            {/* Temperature Card */}
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/20 transition-all hover:scale-[1.02]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                        <TemperatureIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <span className="text-xs font-bold text-orange-600 dark:text-orange-300 uppercase tracking-wider">Temp</span>
                                </div>
                                <div>
                                    <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        {vitals.temperature ?? '—'}
                                    </span>
                                    <span className="text-xs font-semibold text-orange-600/70 dark:text-orange-400/70 ml-1">°F</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Dashboard Grid - Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column (Primary Info) */}
                <div className="xl:col-span-2 space-y-6">
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
                </div>

                {/* Right Column (Management & Tracking) */}
                <div className="space-y-6">
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
