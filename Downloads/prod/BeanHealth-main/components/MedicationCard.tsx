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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Current Medications</h3>
            <ul className="space-y-3">
                {medications.map(med => (
                    <li key={med.id} className="p-2 rounded-lg transition-colors bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                        {editingMedId === med.id ? (
                            <div className="flex items-center space-x-2">
                                <input name="name" value={editedMed.name} onChange={(e) => handleInputChange(e, 'edit')} placeholder="Name" className="w-1/3 p-1 rounded bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500" />
                                <input name="dosage" value={editedMed.dosage} onChange={(e) => handleInputChange(e, 'edit')} placeholder="Dosage" className="w-1/4 p-1 rounded bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500" />
                                <input name="frequency" value={editedMed.frequency} onChange={(e) => handleInputChange(e, 'edit')} placeholder="Frequency" className="flex-1 p-1 rounded bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500" />
                                <button onClick={handleSaveEdit} className="p-2 text-green-600 hover:text-green-800"><CheckIcon className="h-5 w-5"/></button>
                                <button onClick={handleCancelEdit} className="p-2 text-red-500 hover:text-red-700"><XIcon className="h-5 w-5"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center group">
                                <div className="bg-rose-100 dark:bg-rose-900/50 p-2 rounded-lg mr-3">
                                    <PillIcon className="h-5 w-5 text-rose-900 dark:text-rose-400"/>
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-gray-800 dark:text-gray-100">{med.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{med.dosage} - {med.frequency}</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleStartEdit(med)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><EditIcon className="h-4 w-4"/></button>
                                    <button onClick={() => onRemove(med.id)} className="p-2 text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            <form onSubmit={handleAddMedication} className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <h4 className="font-semibold text-gray-700 dark:text-gray-200">Add New Medication</h4>
                <div className="flex items-center space-x-2">
                    <input name="name" value={newMed.name} onChange={(e) => handleInputChange(e, 'new')} placeholder="Name" required className="w-1/3 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm" />
                    <input name="dosage" value={newMed.dosage} onChange={(e) => handleInputChange(e, 'new')} placeholder="Dosage" required className="w-1/4 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm" />
                    <input name="frequency" value={newMed.frequency} onChange={(e) => handleInputChange(e, 'new')} placeholder="Frequency" required className="flex-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm" />
                    <button type="submit" className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors">
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MedicationCard;