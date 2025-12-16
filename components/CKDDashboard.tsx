import React, { useState, useEffect } from 'react';
import { Patient, Vitals } from '../types';
import PatientInfoCard from './PatientInfoCard';
import FluidIntakeTracker from './FluidIntakeTracker';
import LabResultsCard from './LabResultsCard';
import UpcomingTestsCard from './UpcomingTestsCard';
import { UserService } from '../services/authService';
import { supabase } from '../lib/supabase';

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
            case 'normal': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
            case 'borderline': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
            case 'abnormal': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
            case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
        }
    };

    const getStatusBadge = (status: VitalStatus) => {
        switch (status) {
            case 'normal': return '✓ Normal';
            case 'borderline': return '⚠ Borderline';
            case 'abnormal': return '⚠ High';
            case 'critical': return '🚨 Critical';
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
    return (
        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
            {/* Quick Action Header */}
            <div className="flex justify-end">
                <button
                    onClick={onNavigateToDoctors}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Connect with Doctor
                </button>
            </div>

            {/* Vital Signs Section - Now at top, smaller */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200/40 dark:border-gray-700/40">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Vital Signs</h3>
                    {!isEditingVitals && (
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
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Update
                        </button>
                    )}
                </div>

                {isEditingVitals ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Systolic</label>
                                <input
                                    type="number"
                                    value={editVitals.systolic}
                                    onChange={(e) => setEditVitals({ ...editVitals, systolic: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                                    placeholder="120"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Diastolic</label>
                                <input
                                    type="number"
                                    value={editVitals.diastolic}
                                    onChange={(e) => setEditVitals({ ...editVitals, diastolic: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                                    placeholder="80"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Heart Rate</label>
                                <input
                                    type="number"
                                    value={editVitals.heartRate}
                                    onChange={(e) => setEditVitals({ ...editVitals, heartRate: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                                    placeholder="72"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SpO2</label>
                                <input
                                    type="number"
                                    value={editVitals.spo2}
                                    onChange={(e) => setEditVitals({ ...editVitals, spo2: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                                    placeholder="98"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveVitals}
                                className="flex-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setIsEditingVitals(false)}
                                className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Blood Pressure Card */}
                        <div className={`p-3 rounded-xl border ${vitals.bloodPressure ? getStatusColor(getBPStatus(vitals.bloodPressure.systolic, vitals.bloodPressure.diastolic)) : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                                <span className="text-xs font-medium opacity-80">BP</span>
                            </div>
                            <p className="text-xl font-bold">
                                {vitals.bloodPressure
                                    ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`
                                    : '—'}
                            </p>
                            <p className="text-xs opacity-60">mmHg</p>
                        </div>

                        {/* Heart Rate Card */}
                        <div className={`p-3 rounded-xl border ${vitals.heartRate ? getStatusColor(getHRStatus(vitals.heartRate)) : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="text-xs font-medium opacity-80">Heart Rate</span>
                            </div>
                            <p className="text-xl font-bold">
                                {vitals.heartRate ?? '—'}
                            </p>
                            <p className="text-xs opacity-60">bpm</p>
                        </div>

                        {/* SpO2 Card */}
                        <div className={`p-3 rounded-xl border ${vitals.spo2 ? getStatusColor(getSpO2Status(vitals.spo2)) : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                                <span className="text-xs font-medium opacity-80">SpO2</span>
                            </div>
                            <p className="text-xl font-bold">
                                {vitals.spo2 ?? '—'}
                            </p>
                            <p className="text-xs opacity-60">%</p>
                        </div>

                        {/* Temperature Card */}
                        <div className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-1.5 mb-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="text-xs font-medium opacity-80">Temp</span>
                            </div>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {vitals.temperature ?? '—'}
                            </p>
                            <p className="text-xs opacity-60">°F</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Patient Information */}
            <PatientInfoCard
                patientId={patient.id}
                age={(patient as any).age}
                ckdStage={(patient as any).ckdStage || (patient as any).ckd_stage}
                comorbidities={(patient as any).comorbidities || []}
                baselineWeight={(patient as any).baselineWeight || (patient as any).baseline_weight}
                onUpdate={handleUpdatePatientInfo}
            />

            {/* Fluid Intake Tracking */}
            <FluidIntakeTracker
                patientId={patient.id}
                dailyTarget={(patient as any).dailyFluidTarget || (patient as any).daily_fluid_target}
                ckdStage={(patient as any).ckdStage || (patient as any).ckd_stage}
            />

            {/* Lab Results */}
            <LabResultsCard patientId={patient.id} />

            {/* Upcoming Tests */}
            <UpcomingTestsCard patientId={patient.id} />
        </div>
    );
};

export default CKDDashboard;
