import React, { useState } from 'react';
import { Medication } from '../types';
import { PillIcon } from './icons/PillIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';

interface MedicationCardProps {
    medications: Medication[];
    onChange: (medication: Medication) => void;
    onRemove: (medicationId: string) => void;
    onAdd: (medication: Omit<Medication, 'id'>) => void;
}

const MedicationCard: React.FC<MedicationCardProps> = ({ medications, onChange, onRemove, onAdd }) => {
    const [editingMedId, setEditingMedId] = useState<string | null>(null);
    const [editedMed, setEditedMed] = useState<Omit<Medication, 'id'>>({ name: '', dosage: '', frequency: '' });
    const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '' });
    const [deletingMedId, setDeletingMedId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);

    const handleStartEdit = (med: Medication) => {
        setEditingMedId(med.id);
        setEditedMed({ name: med.name, dosage: med.dosage, frequency: med.frequency });
    };

    const handleCancelEdit = () => {
        setEditingMedId(null);
    };

    const handleSaveEdit = () => {
        if (editingMedId) {
            onChange({ id: editingMedId, ...editedMed });
            setEditingMedId(null);
        }
    };

    const handleAddMedication = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMed.name && newMed.dosage && newMed.frequency) {
            onAdd(newMed);
            setNewMed({ name: '', dosage: '', frequency: '' });
            setIsAddingNew(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, medType: 'edit' | 'new') => {
        const { name, value } = e.target;
        if (medType === 'edit') {
            setEditedMed(prev => ({ ...prev, [name]: value }));
        } else {
            setNewMed(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleDeleteMed = async (medId: string) => {
        setDeletingMedId(medId);
        await new Promise(resolve => setTimeout(resolve, 500));
        onRemove(medId);
        setDeletingMedId(null);
    };

    // Get color based on medication index for variety
    const getMedColor = (index: number) => {
        const colors = [
            { bg: 'bg-gradient-to-br from-rose-500/10 to-pink-500/10 dark:from-rose-500/20 dark:to-pink-500/20', icon: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
            { bg: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20', icon: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
            { bg: 'bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20', icon: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
            { bg: 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20', icon: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
            { bg: 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20', icon: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_0_20px_rgba(138,196,60,0.1)] border border-gray-100/50 dark:border-[#8AC43C]/20 overflow-hidden transition-all">
            {/* Header */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-[#8AC43C] to-[#6ba32e] rounded-xl sm:rounded-2xl shadow-lg shadow-[#8AC43C]/20">
                            <PillIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-[#222222] dark:text-white">Medications & Treatment</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {medications.length} active medication{medications.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAddingNew(!isAddingNew)}
                        className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all duration-200 ${
                            isAddingNew 
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rotate-45' 
                                : 'bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 text-[#8AC43C] hover:bg-[#8AC43C]/20 dark:hover:bg-[#8AC43C]/30'
                        }`}
                    >
                        <PlusCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Add New Form - Collapsible */}
            {isAddingNew && (
                <form onSubmit={handleAddMedication} className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#8AC43C]/5 to-transparent dark:from-[#8AC43C]/10 border-b border-gray-100 dark:border-gray-800/50 animate-fade-in">
                    <div className="space-y-2 sm:space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                                name="name"
                                value={newMed.name}
                                onChange={(e) => handleInputChange(e, 'new')}
                                placeholder="Medication name"
                                required
                                className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 focus:border-[#8AC43C] transition-all"
                            />
                            <input
                                name="dosage"
                                value={newMed.dosage}
                                onChange={(e) => handleInputChange(e, 'new')}
                                placeholder="Dosage (e.g. 500mg)"
                                required
                                className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 focus:border-[#8AC43C] transition-all"
                            />
                            <input
                                name="frequency"
                                value={newMed.frequency}
                                onChange={(e) => handleInputChange(e, 'new')}
                                placeholder="Frequency (e.g. 2x daily)"
                                required
                                className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 focus:border-[#8AC43C] transition-all"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddingNew(false);
                                    setNewMed({ name: '', dosage: '', frequency: '' });
                                }}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 sm:px-5 py-1.5 sm:py-2 bg-gradient-to-r from-[#8AC43C] to-[#6ba32e] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-[#8AC43C]/25 hover:shadow-[#8AC43C]/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Add Medication
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Medications List */}
            <div className="p-3 sm:p-4">
                {medications.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                        <div className="inline-flex p-4 sm:p-5 bg-gray-100 dark:bg-gray-800 rounded-2xl sm:rounded-3xl mb-3 sm:mb-4">
                            <PillIcon className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400 dark:text-gray-500" />
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-1">No medications yet</p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Add your first medication to track your treatment</p>
                    </div>
                ) : (
                    <div className="space-y-2 sm:space-y-3">
                        {medications.map((med, index) => {
                            const colors = getMedColor(index);
                            return (
                                <div 
                                    key={med.id} 
                                    className={`group relative p-3 sm:p-4 rounded-xl sm:rounded-2xl ${colors.bg} border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50 transition-all duration-200 ${deletingMedId === med.id ? 'animate-trash-out' : ''}`}
                                >
                                    {editingMedId === med.id ? (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <input
                                                    name="name"
                                                    value={editedMed.name}
                                                    onChange={(e) => handleInputChange(e, 'edit')}
                                                    placeholder="Medication Name"
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50"
                                                />
                                                <input
                                                    name="dosage"
                                                    value={editedMed.dosage}
                                                    onChange={(e) => handleInputChange(e, 'edit')}
                                                    placeholder="Dosage"
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50"
                                                />
                                                <input
                                                    name="frequency"
                                                    value={editedMed.frequency}
                                                    onChange={(e) => handleInputChange(e, 'edit')}
                                                    placeholder="Frequency"
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50"
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={handleCancelEdit} 
                                                    className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                                                >
                                                    <XIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                                </button>
                                                <button 
                                                    onClick={handleSaveEdit} 
                                                    className="p-1.5 sm:p-2 text-[#8AC43C] hover:bg-[#8AC43C]/10 rounded-lg transition-colors"
                                                >
                                                    <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2.5 sm:gap-3">
                                            <div className={`${colors.icon} p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-md flex-shrink-0`}>
                                                <PillIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate`}>
                                                    {med.name}
                                                </p>
                                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                    <span className={`text-[10px] sm:text-xs font-semibold ${colors.text}`}>
                                                        {med.dosage}
                                                    </span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                        {med.frequency}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 sm:gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button 
                                                    onClick={() => handleStartEdit(med)} 
                                                    className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all"
                                                >
                                                    <EditIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteMed(med.id)} 
                                                    disabled={deletingMedId === med.id}
                                                    className={`p-1.5 sm:p-2 rounded-lg transition-all ${deletingMedId === med.id ? 'text-red-500' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                                >
                                                    <TrashIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${deletingMedId === med.id ? 'animate-wiggle' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MedicationCard;