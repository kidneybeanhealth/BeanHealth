import React, { useState, useEffect, useMemo } from 'react';
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
        <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] transition-all duration-300 border border-transparent dark:border-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-full shrink-0">
                        <PillIcon className="h-6 w-6 text-[#222222] dark:text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold text-[#222222] dark:text-white truncate">Medications</h3>
                        <p className="text-xs font-medium text-[#717171] dark:text-[#a0a0a0] mt-1 uppercase tracking-wider truncate">{medications.length} active</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#8AC43C] text-white text-xs font-bold rounded-full hover:opacity-90 transition-all shadow-sm transform active:scale-95 whitespace-nowrap shrink-0 ml-3"
                >
                    <PlusCircleIcon className="h-4 w-4" />
                    <span>Add</span>
                </button>
            </div>

            {/* Adherence Summary */}
            {todaysSchedule.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Today's Progress</span>
                        <span className={`text-lg font-bold ${adherencePercentage >= 80 ? 'text-green-600 dark:text-green-400' :
                            adherencePercentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                            }`}>
                            {adherencePercentage}%
                        </span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${adherencePercentage >= 80 ? 'bg-green-500' :
                                adherencePercentage >= 50 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                }`}
                            style={{ width: `${adherencePercentage}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
                <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'schedule'
                        ? 'bg-white dark:bg-[#1e1e1e] text-[#222222] dark:text-white shadow-sm'
                        : 'text-[#717171] dark:text-[#a0a0a0] hover:text-[#222222] dark:hover:text-white'
                        }`}
                >
                    Today's Schedule
                </button>
                <button
                    onClick={() => setActiveTab('medications')}
                    className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${activeTab === 'medications'
                        ? 'bg-white dark:bg-[#1e1e1e] text-[#222222] dark:text-white shadow-sm'
                        : 'text-[#717171] dark:text-[#a0a0a0] hover:text-[#222222] dark:hover:text-white'
                        }`}
                >
                    All Medications
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
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isTaken
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                        : status === 'current'
                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                            : status === 'past'
                                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    {/* Time */}
                                    <div className="w-16 text-center">
                                        <span className={`text-sm font-bold ${isTaken ? 'text-green-700 dark:text-green-400' :
                                            status === 'current' ? 'text-yellow-700 dark:text-yellow-400' :
                                                status === 'past' ? 'text-red-700 dark:text-red-400' :
                                                    'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {item.scheduledTime}
                                        </span>
                                    </div>

                                    {/* Checkbox */}
                                    <button
                                        onClick={() => handleToggleAdherence(item)}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isTaken
                                            ? 'bg-green-500 border-green-500'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-rose-500'
                                            }`}
                                    >
                                        {isTaken && <CheckIcon className="h-4 w-4 text-white" />}
                                    </button>

                                    {/* Medication Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-base font-bold truncate ${isTaken ? 'text-[#717171] line-through' : 'text-[#222222] dark:text-white'
                                            }`}>
                                            {item.medication.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.medication.dosage} {item.medication.dosageUnit}
                                        </p>
                                    </div>

                                    {/* Status Badge */}
                                    {!isTaken && status === 'current' && (
                                        <span className="px-2 py-1 text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full">
                                            Due now
                                        </span>
                                    )}
                                    {!isTaken && status === 'past' && (
                                        <span className="px-2 py-1 text-xs font-medium bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-full">
                                            Missed
                                        </span>
                                    )}
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
                                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                            >
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                    <PillIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{med.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {med.dosage} {med.dosageUnit} • {MEDICATION_FREQUENCIES.find(f => f.value === med.frequency)?.label}
                                    </p>
                                    {med.category && (
                                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
                                            {med.category}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteMedication(med.id)}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Add Medication Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Medication</h3>
                            <button
                                onClick={() => { setShowAddModal(false); resetForm(); }}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {/* Step 1: Select or Search Medication */}
                            {!selectedPreset && !isCustom && (
                                <>
                                    {/* Search */}
                                    <div className="mb-4">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search medications..."
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>

                                    {/* Category Filter */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <button
                                            onClick={() => setSelectedCategory('all')}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedCategory === 'all'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            All
                                        </button>
                                        {MEDICATION_CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedCategory === cat.id
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Preset List */}
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {filteredPresets.slice(0, 20).map((preset, index) => (
                                            <button
                                                key={`${preset.name}-${index}`}
                                                onClick={() => handleSelectPreset(preset)}
                                                className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-left transition-colors"
                                            >
                                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                                    <PillIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900 dark:text-gray-100">{preset.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {preset.category} • {preset.defaultDosage}{preset.defaultUnit}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Option */}
                                    <button
                                        onClick={handleCustomMedication}
                                        className="w-full mt-4 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-rose-500 hover:text-rose-600 transition-colors"
                                    >
                                        <PlusCircleIcon className="h-5 w-5" />
                                        {searchQuery ? `Add "${searchQuery}" as custom medication` : 'Add custom medication'}
                                    </button>
                                </>
                            )}

                            {/* Step 2: Configure Medication */}
                            {(selectedPreset || isCustom) && (
                                <div className="space-y-4">
                                    {/* Back Button */}
                                    <button
                                        onClick={() => { setSelectedPreset(null); setIsCustom(false); }}
                                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                                    >
                                        ← Back to medication list
                                    </button>

                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Medication Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>

                                    {/* Dosage */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Dosage
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.dosage}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                                                placeholder="e.g., 500"
                                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Unit
                                            </label>
                                            <select
                                                value={formData.dosageUnit}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dosageUnit: e.target.value }))}
                                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            >
                                                {DOSAGE_UNITS.map(unit => (
                                                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Frequency */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Frequency
                                        </label>
                                        <select
                                            value={formData.frequency}
                                            onChange={(e) => handleFrequencyChange(e.target.value as MedicationFrequency)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        >
                                            {MEDICATION_FREQUENCIES.map(freq => (
                                                <option key={freq.value} value={freq.value}>{freq.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Scheduled Times */}
                                    {formData.frequency !== 'as_needed' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Scheduled Times
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {formData.scheduledTimes.map((time, index) => (
                                                    <input
                                                        key={index}
                                                        type="time"
                                                        value={time}
                                                        onChange={(e) => handleTimeChange(index, e.target.value)}
                                                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Instructions */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Instructions (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.instructions}
                                            onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                                            placeholder="e.g., Take with food"
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>

                                    {/* Reminders */}
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="reminderEnabled"
                                            checked={formData.reminderEnabled}
                                            onChange={(e) => setFormData(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                                            className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                        />
                                        <label htmlFor="reminderEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                                            Enable reminders/notifications
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {(selectedPreset || isCustom) && (
                            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={() => { setShowAddModal(false); resetForm(); }}
                                    className="flex-1 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveMedication}
                                    disabled={!formData.name || !formData.dosage || isSaving}
                                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? 'Saving...' : 'Add Medication'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedMedicationCard;
