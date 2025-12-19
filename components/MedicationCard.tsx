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

    return (
        <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] transition-shadow duration-300 border border-transparent dark:border-gray-800">
            <h3 className="text-xl font-bold text-[#222222] dark:text-white mb-6">Current Medications</h3>
            <ul className="space-y-4">
                {medications.map(med => (
                    <li key={med.id} className="p-4 rounded-xl transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80">
                        {editingMedId === med.id ? (
                            <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:space-x-2">
                                <div className="flex-1 space-y-2 sm:space-y-0 sm:flex sm:space-x-2">
                                    <input
                                        name="name"
                                        value={editedMed.name}
                                        onChange={(e) => handleInputChange(e, 'edit')}
                                        placeholder="Medication Name"
                                        className="w-full sm:w-1/3 px-3 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                    <input
                                        name="dosage"
                                        value={editedMed.dosage}
                                        onChange={(e) => handleInputChange(e, 'edit')}
                                        placeholder="Dosage (e.g. 500mg)"
                                        className="w-full sm:flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                    <input
                                        name="frequency"
                                        value={editedMed.frequency}
                                        onChange={(e) => handleInputChange(e, 'edit')}
                                        placeholder="Frequency (e.g. 2x daily)"
                                        className="w-full sm:flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <button onClick={handleSaveEdit} className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                                        <CheckIcon className="h-5 w-5" />
                                    </button>
                                    <button onClick={handleCancelEdit} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                        <XIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start sm:items-center group">
                                <div className="bg-rose-100 dark:bg-rose-900/50 p-2 sm:p-2.5 rounded-lg mr-3 flex-shrink-0">
                                    <PillIcon className="h-5 w-5 text-rose-900 dark:text-rose-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{med.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{med.dosage} • {med.frequency}</p>
                                </div>
                                <div className="flex-shrink-0 flex space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
                                    <button onClick={() => handleStartEdit(med)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors">
                                        <EditIcon className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => onRemove(med.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {/* Add New Medication Form */}
            <form onSubmit={handleAddMedication} className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm sm:text-base">Add New Medication</h4>
                <div className="space-y-3">
                    <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
                        <input
                            name="name"
                            value={newMed.name}
                            onChange={(e) => handleInputChange(e, 'new')}
                            placeholder="Medication Name"
                            required
                            className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                        <input
                            name="dosage"
                            value={newMed.dosage}
                            onChange={(e) => handleInputChange(e, 'new')}
                            placeholder="Dosage (e.g. 500mg)"
                            required
                            className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            name="frequency"
                            value={newMed.frequency}
                            onChange={(e) => handleInputChange(e, 'new')}
                            placeholder="Frequency (e.g. 2x daily)"
                            required
                            className="flex-1 px-3 py-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                        <button
                            type="submit"
                            className="flex-shrink-0 p-2.5 sm:p-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-sm hover:shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                            aria-label="Add medication"
                        >
                            <PlusCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default MedicationCard;