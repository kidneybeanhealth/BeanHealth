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
        <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] transition-all duration-300 border border-transparent dark:border-[#8AC43C]/20">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#222222] dark:text-white">Patient Information</h3>
                {!isEditing && (
                    <button
                        onClick={handleStartEdit}
                        className="min-w-[80px] sm:min-w-[100px] px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-full hover:bg-[#7ab332] transition-colors"
                    >
                        Edit Details
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-4 sm:space-y-6">
                    {/* Name Input */}
                    <div>
                        <label className="block text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-1.5 sm:mb-2 uppercase tracking-wider">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-lg sm:rounded-xl text-base sm:text-lg font-semibold text-[#222222] dark:text-white focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all placeholder:text-gray-300 dark:placeholder:text-white/20"
                            placeholder="Enter full name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {/* Age Input */}
                        <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-1.5 sm:mb-2 uppercase tracking-wider">
                                Age
                            </label>
                            <input
                                type="number"
                                value={editAge}
                                onChange={(e) => setEditAge(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-lg sm:rounded-xl text-base sm:text-lg font-semibold text-[#222222] dark:text-white focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all placeholder:text-gray-300 dark:placeholder:text-white/20"
                                placeholder="Age"
                            />
                        </div>

                        {/* Gender Input */}
                        <div>
                            <label className="block text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-1.5 sm:mb-2 uppercase tracking-wider">
                                Gender
                            </label>
                            <div className="relative">
                                <select
                                    value={editGender}
                                    onChange={(e) => setEditGender(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-lg sm:rounded-xl text-base sm:text-lg font-semibold text-[#222222] dark:text-white focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all appearance-none"
                                >
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-3 sm:px-4 pointer-events-none text-gray-500">
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
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
                            className="w-full px-4 py-3 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-xl text-lg font-semibold text-[#222222] dark:text-white focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all placeholder:text-gray-300 dark:placeholder:text-white/20"
                            placeholder="Enter baseline weight"
                        />
                    </div>

                    {/* Comorbidities Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Comorbidities
                        </label>
                        <div className="p-4 bg-gray-50 dark:bg-[#8AC43C]/5 rounded-xl border border-gray-100 dark:border-[#8AC43C]/10 space-y-4 max-h-64 overflow-y-auto custom-scrollbar">
                            <div>
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">High Priority</p>
                                <div className="flex flex-wrap gap-2">
                                    {HIGH_PRIORITY_COMORBIDITIES.map(condition => (
                                        <button
                                            key={condition}
                                            onClick={() => toggleComorbidity(condition)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all transform active:scale-95 ${selectedComorbidities.includes(condition)
                                                ? 'bg-[#8AC43C] text-white shadow-md shadow-[#8AC43C]/20'
                                                : 'bg-white dark:bg-[#8AC43C]/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#8AC43C]/10 hover:border-[#8AC43C] dark:hover:border-[#8AC43C]/50'
                                                }`}
                                        >
                                            {condition}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">Medication Related</p>
                                <div className="flex flex-wrap gap-2">
                                    {MEDICATION_RELATED_COMORBIDITIES.map(condition => (
                                        <button
                                            key={condition}
                                            onClick={() => toggleComorbidity(condition)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all transform active:scale-95 ${selectedComorbidities.includes(condition)
                                                ? 'bg-[#8AC43C] text-white shadow-md shadow-[#8AC43C]/20'
                                                : 'bg-white dark:bg-[#8AC43C]/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#8AC43C]/10 hover:border-[#8AC43C] dark:hover:border-[#8AC43C]/50'
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
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-[#8AC43C]/10">
                        <button
                            onClick={() => setIsEditing(false)}
                            disabled={isSaving}
                            className="min-w-[100px] px-4 py-2.5 text-xs font-bold text-[#222222] dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="min-w-[120px] px-4 py-2.5 text-xs font-bold text-white dark:text-[#222222] bg-[#8AC43C] hover:bg-[#7ab332] rounded-full transition-all disabled:opacity-50 ml-auto"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 sm:space-y-4">
                    {/* Patient ID and Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-gray-100 dark:border-gray-800">
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-0.5 sm:mb-1">Patient ID</p>
                            <p className="text-sm sm:text-base md:text-lg font-mono font-bold text-[#8AC43C] tracking-wide">
                                {patientDisplayId || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-0.5 sm:mb-1">Full Name</p>
                            <p className="text-sm sm:text-base md:text-lg font-bold text-[#222222] dark:text-white">
                                {fullName || '—'}
                            </p>
                        </div>
                    </div>

                    {/* Age, Gender, CKD Stage Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-0.5 sm:mb-1">Age</p>
                            <p className="text-base sm:text-lg font-extrabold text-[#222222] dark:text-white">
                                {age || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-0.5 sm:mb-1">Gender</p>
                            <p className="text-base sm:text-lg md:text-xl font-bold text-[#222222] dark:text-white">
                                {getGenderDisplay(gender)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-0.5 sm:mb-1">CKD Stage</p>
                            <span className={`inline-block px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full ${getStageColor(ckdStage)}`}>
                                {ckdStage ? `Stage ${ckdStage}` : '—'}
                            </span>
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-0.5 sm:mb-1">Weight</p>
                            <p className="text-base sm:text-lg font-extrabold text-[#222222] dark:text-white">
                                {baselineWeight ? `${baselineWeight}` : '—'}
                                {baselineWeight && <span className="text-xs sm:text-sm font-medium text-[#717171] ml-0.5 sm:ml-1">kg</span>}
                            </p>
                        </div>
                    </div>

                    {/* Fluid Target Info */}
                    {ckdStage && (
                        <div className="p-2 sm:p-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg sm:rounded-xl border border-cyan-100 dark:border-cyan-800/30">
                            <p className="text-xs sm:text-sm font-medium text-cyan-800 dark:text-cyan-200 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="text-base sm:text-xl">💧</span>
                                Recommended daily fluid:
                                <strong className="text-cyan-900 dark:text-cyan-100 text-base sm:text-lg">{recommendedFluidTarget} ml</strong>
                            </p>
                        </div>
                    )}

                    {/* Comorbidities */}
                    <div>
                        <p className="text-[10px] sm:text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-2 sm:mb-3">Recorded Conditions</p>
                        {comorbidities.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {comorbidities.map((condition) => (
                                    <span
                                        key={condition}
                                        className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold bg-gray-100 dark:bg-gray-800 text-[#717171] dark:text-[#a0a0a0] rounded-md sm:rounded-lg"
                                    >
                                        {condition}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs sm:text-sm font-medium text-[#717171] dark:text-[#a0a0a0] italic">No known comorbidities</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientInfoCard;
