import React, { useState, useEffect } from 'react';
import { FluidIntake } from '../types';
import { FluidIntakeService } from '../services/fluidIntakeService';

interface FluidIntakeTrackerProps {
    patientId: string;
    dailyTarget?: number;
    ckdStage?: string;
}

const FluidIntakeTracker: React.FC<FluidIntakeTrackerProps> = ({
    patientId,
    dailyTarget: propDailyTarget,
    ckdStage
}) => {
    const [todayTotal, setTodayTotal] = useState(0);
    const [dailyTarget, setDailyTarget] = useState(propDailyTarget || 1500);
    const [todayEntries, setTodayEntries] = useState<FluidIntake[]>([]);
    const [customAmount, setCustomAmount] = useState('');
    const [selectedType, setSelectedType] = useState('water');
    const [isLoading, setIsLoading] = useState(false);
    const [isEditingTarget, setIsEditingTarget] = useState(false);
    const [editTargetValue, setEditTargetValue] = useState(dailyTarget.toString());

    // Load today's data
    useEffect(() => {
        loadTodayData();
        loadDailyTarget();
    }, [patientId]);

    const loadTodayData = async () => {
        try {
            const [total, entries] = await Promise.all([
                FluidIntakeService.getTodayIntake(patientId),
                FluidIntakeService.getTodayEntries(patientId)
            ]);
            setTodayTotal(total);
            setTodayEntries(entries);
        } catch (error) {
            console.error('Error loading fluid intake data:', error);
        }
    };

    const loadDailyTarget = async () => {
        try {
            const target = await FluidIntakeService.getDailyTarget(patientId);
            setDailyTarget(target);
            setEditTargetValue(target.toString());
        } catch (error) {
            console.error('Error loading daily target:', error);
        }
    };

    const handleQuickAdd = async (amount: number) => {
        setIsLoading(true);
        try {
            await FluidIntakeService.addFluidIntake(patientId, amount, selectedType);
            await loadTodayData();
        } catch (error) {
            console.error('Error adding fluid intake:', error);
            alert('Failed to add fluid intake. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCustomAdd = async () => {
        const amount = parseInt(customAmount);
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        setIsLoading(true);
        try {
            await FluidIntakeService.addFluidIntake(patientId, amount, selectedType);
            await loadTodayData();
            setCustomAmount('');
        } catch (error) {
            console.error('Error adding custom fluid intake:', error);
            alert('Failed to add fluid intake. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!confirm('Delete this fluid intake entry?')) return;

        try {
            await FluidIntakeService.deleteFluidIntake(entryId);
            await loadTodayData();
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert('Failed to delete entry. Please try again.');
        }
    };

    const handleSaveTarget = async () => {
        const newTarget = parseInt(editTargetValue);
        if (!newTarget || newTarget <= 0) {
            alert('Please enter a valid target');
            return;
        }

        try {
            await FluidIntakeService.updateDailyTarget(patientId, newTarget);
            setDailyTarget(newTarget);
            setIsEditingTarget(false);
        } catch (error) {
            console.error('Error updating daily target:', error);
            alert('Failed to update target. Please try again.');
        }
    };

    const progressPercent = Math.min((todayTotal / dailyTarget) * 100, 100);
    const isOverTarget = todayTotal > dailyTarget;

    const getProgressColor = () => {
        if (isOverTarget) return 'bg-red-500';
        return 'bg-[#8AC43C]';
    };

    return (
        <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] transition-all duration-300 border border-transparent dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-[#222222] dark:text-white">Fluid Intake</h3>
                <span className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">Today</span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                    <div>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{todayTotal}</span>
                        <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">ml</span>
                    </div>
                    <div className="text-right">
                        {isEditingTarget ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={editTargetValue}
                                    onChange={(e) => setEditTargetValue(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8AC43C]"
                                />
                                <button
                                    onClick={handleSaveTarget}
                                    className="px-2 py-1 text-xs bg-[#8AC43C] text-white rounded-lg hover:bg-[#7ab332]"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditTargetValue(dailyTarget.toString());
                                        setIsEditingTarget(false);
                                    }}
                                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditingTarget(true)}
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                Target: {dailyTarget} ml ✏️
                            </button>
                        )}
                    </div>
                </div>
                <div className="relative w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{progressPercent.toFixed(0)}% of daily target</span>
                    {isOverTarget && <span className="text-red-500 font-medium">Over target!</span>}
                </div>
            </div>

            {/* Fluid Type Selector */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-3 uppercase tracking-wider">Fluid Type</label>
                <div className="flex gap-2 flex-wrap">
                    {['water', 'juice', 'tea', 'coffee', 'milk', 'other'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors uppercase tracking-wide ${selectedType === type
                                ? 'bg-[#8AC43C] text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Add Buttons */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <button
                    onClick={() => handleQuickAdd(250)}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-[#8AC43C] hover:text-white dark:hover:bg-[#8AC43C] dark:hover:text-white transition-colors disabled:opacity-50"
                >
                    + 250 ml
                </button>
                <button
                    onClick={() => handleQuickAdd(500)}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-[#8AC43C] hover:text-white dark:hover:bg-[#8AC43C] dark:hover:text-white transition-colors disabled:opacity-50"
                >
                    + 500 ml
                </button>
                <button
                    onClick={() => handleQuickAdd(1000)}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-[#8AC43C] hover:text-white dark:hover:bg-[#8AC43C] dark:hover:text-white transition-colors disabled:opacity-50"
                >
                    + 1 L
                </button>
            </div>

            {/* Custom Amount Input */}
            <div className="flex gap-3 mb-8">
                <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomAdd()}
                    placeholder="Custom amount (ml)"
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8AC43C] text-gray-900 dark:text-gray-100"
                />
                <button
                    onClick={handleCustomAdd}
                    disabled={isLoading || !customAmount}
                    className="px-6 py-2 bg-[#8AC43C] hover:bg-[#7ab332] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                    Add
                </button>
            </div>

            {/* Today's Log */}
            <div>
                <h4 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-4 uppercase tracking-wider">Today's Log</h4>
                {todayEntries.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {todayEntries.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                        {entry.amountMl} ml
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {entry.fluidType}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {new Date(entry.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                        No fluid intake recorded today
                    </p>
                )}
            </div>
        </div>
    );
};

export default FluidIntakeTracker;
