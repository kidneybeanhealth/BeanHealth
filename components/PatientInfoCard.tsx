import React, { useState, useEffect } from 'react';
import { CKDStage, HIGH_PRIORITY_COMORBIDITIES, MEDICATION_RELATED_COMORBIDITIES } from '../types';
import { getFluidTargetByStage } from '../utils/ckdUtils';
import { supabase } from '../lib/supabase';

interface PatientInfoCardProps {
    patientId: string; // User's UUID
    displayPatientId?: string; // Human-readable patient ID (P-YYYYMMDD-XXXX)
    fullName?: string;
    age?: number;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    ckdStage?: CKDStage;
    comorbidities?: string[];
    baselineWeight?: number;
    onUpdate?: (updates: {
        age?: number;
        ckdStage?: CKDStage;
        comorbidities?: string[];
        baselineWeight?: number;
        fullName?: string;
        gender?: string;
    }) => Promise<void>;
}

const PatientInfoCard: React.FC<PatientInfoCardProps> = ({
    patientId,
    displayPatientId,
    fullName: propFullName,
    age: propAge,
    gender: propGender,
    ckdStage: propCkdStage,
    comorbidities: propComorbidities = [],
    baselineWeight: propBaselineWeight,
    onUpdate
}) => {
    // Local state for display (will be loaded from database)
    const [fullName, setFullName] = useState(propFullName || '');
    const [age, setAge] = useState(propAge);
    const [gender, setGender] = useState(propGender || '');
    const [ckdStage, setCkdStage] = useState(propCkdStage);
    const [comorbidities, setComorbidities] = useState<string[]>(propComorbidities);
    const [baselineWeight, setBaselineWeight] = useState(propBaselineWeight);
    const [patientDisplayId, setPatientDisplayId] = useState(displayPatientId || '');

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAge, setEditAge] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editWeight, setEditWeight] = useState('');
    const [selectedComorbidities, setSelectedComorbidities] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Load patient data from database on mount
    useEffect(() => {
        const loadPatientData = async () => {
            try {
                const { data, error } = await (supabase
                    .from('users') as any)
                    .select('full_name, age, gender, ckd_stage, comorbidities, baseline_weight, patient_id')
                    .eq('id', patientId)
                    .single();

                if (error) throw error;

                if (data) {
                    setFullName(data.full_name || '');
                    setAge(data.age || undefined);
                    setGender(data.gender || '');
                    setCkdStage(data.ckd_stage as CKDStage || undefined);
                    setComorbidities(data.comorbidities || []);
                    setBaselineWeight(data.baseline_weight || undefined);
                    setPatientDisplayId(data.patient_id || '');
                }
            } catch (error) {
                console.error('Error loading patient data:', error);
            }
        };

        if (patientId) {
            loadPatientData();
        }
    }, [patientId]);

    const handleStartEdit = () => {
        setEditName(fullName);
        setEditAge(age?.toString() || '');
        setEditGender(gender);
        setEditWeight(baselineWeight?.toString() || '');
        setSelectedComorbidities([...comorbidities]);
        setIsEditing(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Update database directly
            const { error } = await (supabase
                .from('users') as any)
                .update({
                    full_name: editName || null,
                    age: editAge ? parseInt(editAge) : null,
                    gender: editGender || null,
                    baseline_weight: editWeight ? parseFloat(editWeight) : null,
                    comorbidities: selectedComorbidities.length > 0 ? selectedComorbidities : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', patientId);

            if (error) throw error;

            // Update local state
            setFullName(editName);
            setAge(editAge ? parseInt(editAge) : undefined);
            setGender(editGender);
            setBaselineWeight(editWeight ? parseFloat(editWeight) : undefined);
            setComorbidities(selectedComorbidities);

            // Call optional onUpdate callback
            if (onUpdate) {
                await onUpdate({
                    fullName: editName,
                    age: editAge ? parseInt(editAge) : undefined,
                    gender: editGender,
                    baselineWeight: editWeight ? parseFloat(editWeight) : undefined,
                    comorbidities: selectedComorbidities
                });
            }

            setIsEditing(false);
        } catch (error) {
            console.error('Error saving patient info:', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleComorbidity = (condition: string) => {
        setSelectedComorbidities(prev =>
            prev.includes(condition)
                ? prev.filter(c => c !== condition)
                : [...prev, condition]
        );
    };

    const getStageColor = (stage?: CKDStage): string => {
        if (!stage) return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
        switch (stage) {
            case '1':
            case '2':
                return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
            case '3a':
            case '3b':
                return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
            case '4':
                return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
            case '5':
                return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
            default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
        }
    };

    const getGenderDisplay = (g?: string) => {
        switch (g) {
            case 'male': return 'Male';
            case 'female': return 'Female';
            case 'other': return 'Other';
            case 'prefer_not_to_say': return 'Not specified';
            default: return '—';
        }
    };

    const recommendedFluidTarget = ckdStage ? getFluidTargetByStage(ckdStage) : 1500;

    return (
        <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] transition-all duration-300 border border-transparent dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-[#222222] dark:text-white">Patient Information</h3>
                {!isEditing && (
                    <button
                        onClick={handleStartEdit}
                        className="px-4 py-2 text-sm font-semibold text-white bg-[#8AC43C] rounded-full hover:bg-[#7ab332] transition-colors"
                    >
                        Edit Details
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-6">
                    {/* Name Input */}
                    <div>
                        <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                            placeholder="Enter full name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Age Input */}
                        <div>
                            <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                                Age
                            </label>
                            <input
                                type="number"
                                value={editAge}
                                onChange={(e) => setEditAge(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                                placeholder="Enter age"
                            />
                        </div>

                        {/* Gender Input */}
                        <div>
                            <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                                Gender
                            </label>
                            <select
                                value={editGender}
                                onChange={(e) => setEditGender(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                            >
                                <option value="">Select gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                                <option value="prefer_not_to_say">Prefer not to say</option>
                            </select>
                        </div>
                    </div>

                    {/* Baseline Weight Input */}
                    <div>
                        <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                            Baseline Weight (kg)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:ring-2 focus:ring-[#222222] transition-all"
                            placeholder="Enter baseline weight"
                        />
                    </div>

                    {/* Comorbidities Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Comorbidities
                        </label>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">High Priority</p>
                                <div className="flex flex-wrap gap-2">
                                    {HIGH_PRIORITY_COMORBIDITIES.map(condition => (
                                        <button
                                            key={condition}
                                            onClick={() => toggleComorbidity(condition)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedComorbidities.includes(condition)
                                                ? 'bg-secondary-700 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {condition}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Medication Related</p>
                                <div className="flex flex-wrap gap-2">
                                    {MEDICATION_RELATED_COMORBIDITIES.map(condition => (
                                        <button
                                            key={condition}
                                            onClick={() => toggleComorbidity(condition)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedComorbidities.includes(condition)
                                                ? 'bg-secondary-700 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {condition}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-secondary-700 hover:bg-secondary-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Patient ID and Name */}
                    <div className="grid grid-cols-2 gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                        <div>
                            <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Patient ID</p>
                            <p className="text-lg font-mono font-bold text-[#8AC43C] tracking-wide">
                                {patientDisplayId || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Full Name</p>
                            <p className="text-lg font-bold text-[#222222] dark:text-white">
                                {fullName || '—'}
                            </p>
                        </div>
                    </div>

                    {/* Age, Gender, CKD Stage Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                            <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Age</p>
                            <p className="text-lg font-extrabold text-[#222222] dark:text-white">
                                {age || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Gender</p>
                            <p className="text-xl font-bold text-[#222222] dark:text-white">
                                {getGenderDisplay(gender)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">CKD Stage</p>
                            <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${getStageColor(ckdStage)}`}>
                                {ckdStage ? `Stage ${ckdStage}` : '—'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Weight</p>
                            <p className="text-lg font-extrabold text-[#222222] dark:text-white">
                                {baselineWeight ? `${baselineWeight}` : '—'}
                                {baselineWeight && <span className="text-sm font-medium text-[#717171] ml-1">kg</span>}
                            </p>
                        </div>
                    </div>

                    {/* Fluid Target Info */}
                    {ckdStage && (
                        <div className="p-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-100 dark:border-cyan-800/30">
                            <p className="text-sm font-medium text-cyan-800 dark:text-cyan-200 flex items-center gap-2">
                                <span className="text-xl">💧</span>
                                Recommended daily fluid:
                                <strong className="text-cyan-900 dark:text-cyan-100 text-lg">{recommendedFluidTarget} ml</strong>
                            </p>
                        </div>
                    )}

                    {/* Comorbidities */}
                    <div>
                        <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-3">Recorded Conditions</p>
                        {comorbidities.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {comorbidities.map((condition) => (
                                    <span
                                        key={condition}
                                        className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-[#717171] dark:text-[#a0a0a0] rounded-lg"
                                    >
                                        {condition}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm font-medium text-[#717171] dark:text-[#a0a0a0] italic">No known comorbidities</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientInfoCard;
