import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { EnhancedMedication, MedicationFrequency, MedicationAdherenceEntry } from '../types';
import { MedicationService } from '../services/medicationService';
import {
    ALL_PRESET_MEDICATIONS,
    MEDICATION_CATEGORIES,
    MEDICATION_FREQUENCIES,
    DOSAGE_UNITS,
    getDefaultTimesForFrequency,
    searchMedications,
    PresetMedication
} from '../utils/presetMedications';
import { PillIcon } from './icons/PillIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';

interface EnhancedMedicationCardProps {
    patientId: string;
}

interface ScheduleItem {
    medication: EnhancedMedication;
    scheduledTime: string;
    adherence: MedicationAdherenceEntry | null;
}

const EnhancedMedicationCard: React.FC<EnhancedMedicationCardProps> = ({ patientId }) => {
    // State
    const [medications, setMedications] = useState<EnhancedMedication[]>([]);
    const [todaysSchedule, setTodaysSchedule] = useState<ScheduleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'schedule' | 'medications'>('schedule');
    const [adherencePercentage, setAdherencePercentage] = useState(0);

    // Add medication form state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedPreset, setSelectedPreset] = useState<PresetMedication | null>(null);
    const [isCustom, setIsCustom] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        dosage: '',
        dosageUnit: 'mg',
        frequency: 'once_daily' as MedicationFrequency,
        scheduledTimes: ['08:00'],
        instructions: '',
        category: '',
        reminderEnabled: true,
    });
    const [isSaving, setIsSaving] = useState(false);

    // Load medications and schedule
    useEffect(() => {
        loadData();
    }, [patientId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [meds, schedule] = await Promise.all([
                MedicationService.getMedications(patientId),
                MedicationService.getTodaysSchedule(patientId),
            ]);
            setMedications(meds);
            setTodaysSchedule(schedule);

            // Calculate adherence percentage
            const taken = schedule.filter(s => s.adherence?.taken).length;
            const total = schedule.length;
            setAdherencePercentage(total > 0 ? Math.round((taken / total) * 100) : 0);

            // Schedule reminders
            await MedicationService.scheduleAllRemindersForToday(patientId);
        } catch (error) {
            console.error('Error loading medications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filtered presets based on search and category
    const filteredPresets = useMemo(() => {
        let presets = selectedCategory === 'all'
            ? ALL_PRESET_MEDICATIONS
            : MEDICATION_CATEGORIES.find(c => c.id === selectedCategory)?.medications || [];

        if (searchQuery) {
            presets = searchMedications(searchQuery);
        }

        return presets;
    }, [searchQuery, selectedCategory]);

    // Handle preset selection
    const handleSelectPreset = (preset: PresetMedication) => {
        setSelectedPreset(preset);
        setIsCustom(false);
        setFormData({
            name: preset.name,
            dosage: preset.defaultDosage,
            dosageUnit: preset.defaultUnit,
            frequency: preset.defaultFrequency,
            scheduledTimes: preset.defaultTimes || getDefaultTimesForFrequency(preset.defaultFrequency),
            instructions: preset.instructions || '',
            category: preset.category,
            reminderEnabled: true,
        });
    };

    // Handle custom medication
    const handleCustomMedication = () => {
        setIsCustom(true);
        setSelectedPreset(null);
        setFormData({
            name: searchQuery,
            dosage: '',
            dosageUnit: 'mg',
            frequency: 'once_daily',
            scheduledTimes: ['08:00'],
            instructions: '',
            category: 'Custom',
            reminderEnabled: true,
        });
    };

    // Handle frequency change
    const handleFrequencyChange = (frequency: MedicationFrequency) => {
        setFormData(prev => ({
            ...prev,
            frequency,
            scheduledTimes: getDefaultTimesForFrequency(frequency),
        }));
    };

    // Handle time change
    const handleTimeChange = (index: number, time: string) => {
        setFormData(prev => {
            const newTimes = [...prev.scheduledTimes];
            newTimes[index] = time;
            return { ...prev, scheduledTimes: newTimes };
        });
    };

    // Save medication
    const handleSaveMedication = async () => {
        if (!formData.name || !formData.dosage) return;

        setIsSaving(true);
        try {
            await MedicationService.addMedication(patientId, {
                name: formData.name,
                dosage: formData.dosage,
                dosageUnit: formData.dosageUnit,
                frequency: formData.frequency,
                scheduledTimes: formData.scheduledTimes,
                instructions: formData.instructions,
                category: formData.category,
                startDate: new Date().toISOString().split('T')[0],
                isActive: true,
                isCustom: isCustom,
                reminderEnabled: formData.reminderEnabled,
            });

            // Reset and reload
            setShowAddModal(false);
            resetForm();
            await loadData();
        } catch (error) {
            console.error('Error saving medication:', error);
            alert('Failed to save medication');
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setSearchQuery('');
        setSelectedPreset(null);
        setIsCustom(false);
        setFormData({
            name: '',
            dosage: '',
            dosageUnit: 'mg',
            frequency: 'once_daily',
            scheduledTimes: ['08:00'],
            instructions: '',
            category: '',
            reminderEnabled: true,
        });
    };

    // Handle adherence toggle
    const handleToggleAdherence = async (item: ScheduleItem) => {
        const today = new Date().toISOString().split('T')[0];
        const taken = !item.adherence?.taken;

        try {
            await MedicationService.logAdherence(
                item.medication.id,
                patientId,
                today,
                item.scheduledTime,
                taken
            );
            await loadData();
        } catch (error) {
            console.error('Error logging adherence:', error);
        }
    };

    // Delete medication
    const handleDeleteMedication = async (medicationId: string) => {
        if (!confirm('Are you sure you want to remove this medication?')) return;

        try {
            await MedicationService.deleteMedication(medicationId);
            await loadData();
        } catch (error) {
            console.error('Error deleting medication:', error);
        }
    };

    // Get time status (past, current, upcoming)
    const getTimeStatus = (time: string): 'past' | 'current' | 'upcoming' => {
        const now = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(hours, minutes, 0, 0);

        const diffMinutes = (scheduleTime.getTime() - now.getTime()) / 60000;

        if (diffMinutes < -30) return 'past';
        if (diffMinutes <= 30) return 'current';
        return 'upcoming';
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200/40 dark:border-gray-700/40">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] transition-all duration-300 border border-transparent dark:border-[#8AC43C]/20">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-3 bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 rounded-2xl shrink-0">
                            <PillIcon className="h-6 w-6 text-[#8AC43C]" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-[#222222] dark:text-white truncate">Medications</h3>
                            <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] mt-0.5 uppercase tracking-wider truncate">{medications.length} active</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#8AC43C] text-white dark:text-[#222222] text-xs font-bold rounded-full hover:opacity-90 transition-all shadow-sm transform active:scale-95 whitespace-nowrap shrink-0 ml-3"
                    >
                        <PlusCircleIcon className="h-4 w-4" />
                        <span>Add</span>
                    </button>
                </div>

                {/* Adherence Summary */}
                {todaysSchedule.length > 0 && (
                    <div className="mb-4 p-4 bg-gray-50/50 dark:bg-[#8AC43C]/5 border border-gray-100 dark:border-[#8AC43C]/10 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[#222222] dark:text-white">Daily Progress</span>
                            <span className={`text-lg font-bold ${adherencePercentage >= 80 ? 'text-[#8AC43C]' :
                                adherencePercentage >= 50 ? 'text-amber-500' :
                                    'text-rose-500'
                                }`}>
                                {adherencePercentage}%
                            </span>
                        </div>
                        <div className="mt-2.5 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${adherencePercentage >= 80 ? 'bg-[#8AC43C]' :
                                    adherencePercentage >= 50 ? 'bg-amber-500' :
                                        'bg-rose-500'
                                    }`}
                                style={{ width: `${adherencePercentage}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex p-1.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl mb-6">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'schedule'
                            ? 'bg-white dark:bg-[#1a1a1a] text-[#222222] dark:text-white shadow-sm'
                            : 'text-[#717171] dark:text-[#a0a0a0] hover:text-[#222222] dark:hover:text-white'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setActiveTab('medications')}
                        className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'medications'
                            ? 'bg-white dark:bg-[#1a1a1a] text-[#222222] dark:text-white shadow-sm'
                            : 'text-[#717171] dark:text-[#a0a0a0] hover:text-[#222222] dark:hover:text-white'
                            }`}
                    >
                        Active
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'schedule' ? (
                    <div className="space-y-2">
                        {todaysSchedule.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <PillIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                <p>No medications scheduled for today</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="mt-2 text-[#8AC43C] text-sm font-bold hover:underline"
                                >
                                    Add your first medication
                                </button>
                            </div>
                        ) : (
                            todaysSchedule.map((item, index) => {
                                const status = getTimeStatus(item.scheduledTime);
                                const isTaken = item.adherence?.taken;

                                return (
                                    <div
                                        key={`${item.medication.id}-${item.scheduledTime}-${index}`}
                                        className={`flex items-center gap-4 p-4 rounded-[20px] border transition-all duration-200 ${isTaken
                                            ? 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-70'
                                            : status === 'current'
                                                ? 'bg-[#8AC43C]/5 dark:bg-[#8AC43C]/10 border-[#8AC43C]/30 dark:border-[#8AC43C]/40 ring-1 ring-[#8AC43C]/20 shadow-sm shadow-[#8AC43C]/10'
                                                : status === 'past'
                                                    ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/40 opacity-90'
                                                    : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-[#8AC43C]/10 opacity-100 shadow-sm'
                                            }`}
                                    >
                                        {/* Time */}
                                        <div className="flex flex-col items-center justify-center w-14 py-1 border-r border-gray-100 dark:border-[#8AC43C]/10 pr-4">
                                            <span className={`text-[11px] font-bold tracking-tight ${isTaken ? 'text-gray-400' :
                                                status === 'current' ? 'text-[#8AC43C]' :
                                                    status === 'past' ? 'text-rose-500' :
                                                        'text-[#717171] dark:text-gray-400'
                                                }`}>
                                                {item.scheduledTime}
                                            </span>
                                        </div>

                                        {/* Checkbox */}
                                        <button
                                            onClick={() => handleToggleAdherence(item)}
                                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isTaken
                                                ? 'bg-[#8AC43C] border-[#8AC43C] scale-95 shadow-lg shadow-[#8AC43C]/20'
                                                : status === 'current'
                                                    ? 'border-[#8AC43C] bg-white dark:bg-[#1a1a1a] hover:scale-110 active:scale-95'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-[#8AC43C] active:scale-95'
                                                }`}
                                        >
                                            {isTaken ? (
                                                <CheckIcon className="h-4 w-4 text-white stroke-[3px]" />
                                            ) : status === 'current' && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#8AC43C] animate-pulse"></div>
                                            )}
                                        </button>

                                        {/* Medication Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[15px] font-bold truncate tracking-tight transition-all ${isTaken ? 'text-[#999] dark:text-[#666] line-through' : 'text-[#222222] dark:text-white'
                                                }`}>
                                                {item.medication.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[11px] font-bold text-[#717171] dark:text-[#888]">{item.medication.dosage}{item.medication.dosageUnit}</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                                <span className={`text-[11px] font-bold uppercase tracking-wider ${isTaken ? 'text-gray-400' : status === 'current' ? 'text-[#8AC43C]' : 'text-amber-500'}`}>{status}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {medications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <PillIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                <p>No medications added yet</p>
                            </div>
                        ) : (
                            medications.map(med => (
                                <div
                                    key={med.id}
                                    className="flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#8AC43C]/5 rounded-2xl border border-gray-100 dark:border-[#8AC43C]/10 transition-all shadow-sm hover:shadow-md group"
                                >
                                    <div className="p-3 bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 rounded-xl group-hover:bg-[#8AC43C]/20 transition-colors">
                                        <PillIcon className="h-5 w-5 text-[#8AC43C]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[15px] font-bold text-[#222222] dark:text-white truncate tracking-tight">{med.name}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[11px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider">{med.dosage}{med.dosageUnit}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                            <span className="text-[11px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider">{MEDICATION_FREQUENCIES.find(f => f.value === med.frequency)?.label}</span>
                                        </div>
                                        {med.category && med.category !== 'Custom' && (
                                            <div className="mt-2 text-[10px] font-bold text-[#8AC43C] bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 px-2 py-0.5 rounded-full inline-block uppercase tracking-widest">
                                                {med.category}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteMedication(med.id)}
                                        className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Add Medication Modal - Rendered via Portal */}
            {showAddModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-gray-100 dark:border-[#8AC43C]/20 animate-scale-in">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#8AC43C]/10">
                            <div>
                                <h3 className="text-xl font-bold text-[#222222] dark:text-white">Add Medication</h3>
                                <p className="text-xs text-[#717171] dark:text-[#888] font-medium mt-0.5">Choose from list or add custom</p>
                            </div>
                            <button
                                onClick={() => { setShowAddModal(false); resetForm(); }}
                                className="p-2 text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            {/* Step 1: Select or Search Medication */}
                            {!selectedPreset && !isCustom && (
                                <>
                                    {/* Search */}
                                    <div className="mb-6">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search medications (e.g. Amlodipine)"
                                                className="w-full px-5 py-3.5 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 focus:border-[#8AC43C] transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Category Filter */}
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        <button
                                            onClick={() => setSelectedCategory('all')}
                                            className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${selectedCategory === 'all'
                                                ? 'bg-[#222222] dark:bg-white text-white dark:text-[#222222]'
                                                : 'bg-gray-100 dark:bg-gray-800 text-[#717171] hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            All
                                        </button>
                                        {MEDICATION_CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${selectedCategory === cat.id
                                                    ? 'bg-[#222222] dark:bg-white text-white dark:text-[#222222]'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-[#717171] hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Preset List */}
                                    <div className="space-y-2 mb-4">
                                        {filteredPresets.slice(0, 20).map((preset, index) => (
                                            <button
                                                key={`${preset.name}-${index}`}
                                                onClick={() => handleSelectPreset(preset)}
                                                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#252525] hover:bg-gray-50 dark:hover:bg-[#8AC43C]/5 border border-gray-100 dark:border-[#8AC43C]/10 rounded-2xl text-left transition-all group"
                                            >
                                                <div className="p-3 bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 rounded-xl group-hover:bg-[#8AC43C]/20 transition-colors">
                                                    <PillIcon className="h-5 w-5 text-[#8AC43C]" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-[#222222] dark:text-white">{preset.name}</p>
                                                    <p className="text-[11px] text-[#717171] dark:text-[#888] font-medium mt-0.5">
                                                        {preset.category} • {preset.defaultDosage}{preset.defaultUnit}
                                                    </p>
                                                </div>
                                                <PlusCircleIcon className="h-5 w-5 text-gray-300 group-hover:text-[#8AC43C] transition-colors" />
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Option */}
                                    <button
                                        onClick={handleCustomMedication}
                                        className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm font-bold text-[#717171] hover:border-[#8AC43C] hover:text-[#8AC43C] hover:bg-[#8AC43C]/5 transition-all"
                                    >
                                        <PlusCircleIcon className="h-5 w-5" />
                                        {searchQuery ? `Add "${searchQuery}" manually` : 'Add medication manually'}
                                    </button>
                                </>
                            )}

                            {/* Step 2: Configure Medication */}
                            {(selectedPreset || isCustom) && (
                                <div className="space-y-5 animate-fade-in">
                                    {/* Back Button */}
                                    <button
                                        onClick={() => { setSelectedPreset(null); setIsCustom(false); }}
                                        className="text-xs font-bold text-[#8AC43C] hover:underline flex items-center gap-1.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to Search
                                    </button>

                                    <div className="space-y-4">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                                                Medication Name
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                                            />
                                        </div>

                                        {/* Dosage */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                                                    Dosage
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.dosage}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                                                    placeholder="e.g. 500"
                                                    className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                                                    Unit
                                                </label>
                                                <select
                                                    value={formData.dosageUnit}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, dosageUnit: e.target.value }))}
                                                    className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium appearance-none"
                                                >
                                                    {DOSAGE_UNITS.map(unit => (
                                                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Frequency */}
                                        <div>
                                            <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                                                Frequency
                                            </label>
                                            <select
                                                value={formData.frequency}
                                                onChange={(e) => handleFrequencyChange(e.target.value as MedicationFrequency)}
                                                className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium appearance-none"
                                            >
                                                {MEDICATION_FREQUENCIES.map(freq => (
                                                    <option key={freq.value} value={freq.value}>{freq.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Scheduled Times */}
                                        {formData.frequency !== 'as_needed' && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                                                    Scheduled Times
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {formData.scheduledTimes.map((time, index) => (
                                                        <input
                                                            key={index}
                                                            type="time"
                                                            value={time}
                                                            onChange={(e) => handleTimeChange(index, e.target.value)}
                                                            className="px-4 py-2.5 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Instructions */}
                                        <div>
                                            <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                                                Instructions
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.instructions}
                                                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                                                placeholder="e.g. Take after meal"
                                                className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                                            />
                                        </div>

                                        {/* Reminders Toggle */}
                                        <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-[#8AC43C]/5 rounded-2xl border border-gray-100 dark:border-[#8AC43C]/10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-[#8AC43C]/10 rounded-lg">
                                                    <svg className="w-4 h-4 text-[#8AC43C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-[#222222] dark:text-white">Reminders</p>
                                                    <p className="text-[10px] text-[#717171] font-medium">Get notified when it's time</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.reminderEnabled}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#8AC43C]"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-100 dark:border-[#8AC43C]/10 flex items-center gap-3">
                            <button
                                onClick={() => { setShowAddModal(false); resetForm(); }}
                                className="flex-1 px-6 py-3.5 text-sm font-bold text-[#222222] dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all"
                            >
                                Cancel
                            </button>
                            {(selectedPreset || isCustom) ? (
                                <button
                                    onClick={handleSaveMedication}
                                    disabled={!formData.name || !formData.dosage || isSaving}
                                    className="flex-2 px-6 py-3.5 bg-[#8AC43C] text-white dark:text-[#222222] rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#8AC43C]/20"
                                >
                                    {isSaving ? 'Saving...' : 'Add Medication'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default EnhancedMedicationCard;
