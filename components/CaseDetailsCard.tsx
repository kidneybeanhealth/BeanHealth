import React, { useState, useEffect } from 'react';
import { CaseDetails } from '../types';
import { CaseDetailsService } from '../services/caseDetailsService';
import { EditIcon } from './icons/EditIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { TrashIcon } from './icons/TrashIcon';

interface CaseDetailsCardProps {
    patientId: string;
    readOnly?: boolean; // For doctor view
}

const CaseDetailsCard: React.FC<CaseDetailsCardProps> = ({ patientId, readOnly = false }) => {
    const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingHistoryIndex, setDeletingHistoryIndex] = useState<number | null>(null);

    // Edit form state
    const [editData, setEditData] = useState({
        primaryCondition: '',
        latestComplaint: '',
        medicalHistory: [] as string[],
    });
    const [newHistoryItem, setNewHistoryItem] = useState('');

    // Load case details
    useEffect(() => {
        loadCaseDetails();
    }, [patientId]);

    const loadCaseDetails = async () => {
        setIsLoading(true);
        try {
            const details = await CaseDetailsService.getCaseDetails(patientId);
            setCaseDetails(details);
            if (details) {
                setEditData({
                    primaryCondition: details.primaryCondition || '',
                    latestComplaint: details.latestComplaint || '',
                    medicalHistory: details.medicalHistory || [],
                });
            }
        } catch (error) {
            console.error('Error loading case details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartEdit = () => {
        setEditData({
            primaryCondition: caseDetails?.primaryCondition || '',
            latestComplaint: caseDetails?.latestComplaint || '',
            medicalHistory: caseDetails?.medicalHistory || [],
        });
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setNewHistoryItem('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await CaseDetailsService.upsertCaseDetails(patientId, {
                primaryCondition: editData.primaryCondition,
                latestComplaint: editData.latestComplaint,
                medicalHistory: editData.medicalHistory,
            });
            await loadCaseDetails();
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving case details:', error);
            alert('Failed to save case details');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddHistoryItem = () => {
        if (newHistoryItem.trim()) {
            setEditData(prev => ({
                ...prev,
                medicalHistory: [...prev.medicalHistory, newHistoryItem.trim()],
            }));
            setNewHistoryItem('');
        }
    };

    const handleRemoveHistoryItem = async (index: number) => {
        setDeletingHistoryIndex(index);
        await new Promise(resolve => setTimeout(resolve, 400));
        setEditData(prev => ({
            ...prev,
            medicalHistory: prev.medicalHistory.filter((_, i) => i !== index),
        }));
        setDeletingHistoryIndex(null);
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200/40 dark:border-gray-700/40">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] transition-all duration-300 border border-transparent dark:border-[#8AC43C]/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-100 dark:bg-[#2a2a2a] rounded-full">
                        <svg className="h-5 w-5 text-[#222222] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-[#222222] dark:text-white">Case Details</h3>
                        {caseDetails?.updatedAt && (
                            <p className="text-[10px] font-medium text-[#717171] dark:text-[#a0a0a0] mt-0.5">
                                Updated {new Date(caseDetails.updatedAt).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
                {!readOnly && !isEditing && (
                    <button
                        onClick={handleStartEdit}
                        className="flex items-center gap-1.5 min-w-[80px] px-4 py-2 text-xs font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-full hover:bg-[#7ab332] transition-colors"
                    >
                        <EditIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Add</span>
                    </button>
                )}
            </div>

            {isEditing ? (
                /* Edit Mode */
                <div className="space-y-4">
                    {/* Primary Condition */}
                    <div>
                        <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                            Primary Condition
                        </label>
                        <input
                            type="text"
                            value={editData.primaryCondition}
                            onChange={(e) => setEditData(prev => ({ ...prev, primaryCondition: e.target.value }))}
                            placeholder="e.g., Chronic Kidney Disease Stage 3b"
                            className="w-full px-4 py-3 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-xl text-sm font-semibold text-[#222222] dark:text-white focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all placeholder:text-gray-300 dark:placeholder:text-white/20"
                        />
                    </div>

                    {/* Latest Complaint */}
                    <div>
                        <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                            Latest Complaint / Chief Issue
                        </label>
                        <textarea
                            value={editData.latestComplaint}
                            onChange={(e) => setEditData(prev => ({ ...prev, latestComplaint: e.target.value }))}
                            placeholder="Describe your current symptoms or concerns..."
                            rows={3}
                            className="w-full px-4 py-3 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-xl text-sm font-medium text-[#222222] dark:text-white focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all resize-none placeholder:text-gray-300 dark:placeholder:text-white/20"
                        />
                    </div>

                    {/* Medical History */}
                    <div>
                        <label className="block text-xs font-bold text-[#717171] dark:text-[#a0a0a0] mb-2 uppercase tracking-wider">
                            Medical History
                        </label>

                        {/* History Items */}
                        <div className="space-y-2 mb-3">
                            {editData.medicalHistory.map((item, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center gap-2 p-3 bg-gray-50 dark:bg-[#8AC43C]/5 rounded-xl border border-gray-100 dark:border-[#8AC43C]/10 transition-all ${deletingHistoryIndex === index ? 'animate-trash-out' : ''}`}
                                >
                                    <span className="flex-1 text-sm font-medium text-[#222222] dark:text-white">{item}</span>
                                    <button
                                        onClick={() => handleRemoveHistoryItem(index)}
                                        disabled={deletingHistoryIndex === index}
                                        className={`p-1.5 rounded-lg transition-all ${deletingHistoryIndex === index ? 'text-red-500' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                    >
                                        <TrashIcon className={`h-4 w-4 ${deletingHistoryIndex === index ? 'animate-wiggle' : ''}`} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add New History Item */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newHistoryItem}
                                onChange={(e) => setNewHistoryItem(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddHistoryItem()}
                                placeholder="Add medical history item..."
                                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#8AC43C]/5 border border-gray-200 dark:border-[#8AC43C]/20 rounded-xl text-sm font-medium focus:outline-none focus:border-[#8AC43C] focus:ring-1 focus:ring-[#8AC43C] transition-all placeholder:text-gray-300 dark:placeholder:text-white/20"
                            />
                            <button
                                onClick={handleAddHistoryItem}
                                disabled={!newHistoryItem.trim()}
                                className="px-4 py-2.5 bg-[#8AC43C] text-white rounded-xl hover:bg-[#7ab332] shadow-sm transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                            >
                                <PlusCircleIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Quick Add Suggestions */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {['Hypertension', 'Type 2 Diabetes', 'Heart Disease', 'Previous AKI', 'Anemia'].map(suggestion => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        if (!editData.medicalHistory.includes(suggestion)) {
                                            setEditData(prev => ({
                                                ...prev,
                                                medicalHistory: [...prev.medicalHistory, suggestion],
                                            }));
                                        }
                                    }}
                                    disabled={editData.medicalHistory.includes(suggestion)}
                                    className="px-3 py-1.5 text-xs font-bold bg-gray-50 dark:bg-[#8AC43C]/5 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#8AC43C]/10 rounded-lg hover:border-[#8AC43C] hover:text-[#8AC43C] dark:hover:text-white dark:hover:border-[#8AC43C]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    + {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-[#8AC43C]/10">
                        <button
                            onClick={handleCancelEdit}
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
                /* View Mode */
                <div className="space-y-4">
                    {/* Primary Condition */}
                    <div>
                        <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">
                            Primary Condition
                        </p>
                        {caseDetails?.primaryCondition ? (
                            <p className="text-base font-bold text-[#222222] dark:text-white">
                                {caseDetails.primaryCondition}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                {readOnly ? 'Not specified' : 'Click Edit to add your primary condition'}
                            </p>
                        )}
                    </div>

                    {/* Latest Complaint */}
                    <div>
                        <p className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-2">
                            Latest Complaint / Chief Issue
                            {caseDetails?.complaintDate && (
                                <span className="ml-2 text-gray-400 normal-case">
                                    ({new Date(caseDetails.complaintDate).toLocaleDateString()})
                                </span>
                            )}
                        </p>
                        {caseDetails?.latestComplaint ? (
                            <p className="text-base font-medium text-[#222222] dark:text-gray-200 leading-relaxed">
                                {caseDetails.latestComplaint}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                {readOnly ? 'No recent complaint recorded' : 'Click Edit to add your current symptoms'}
                            </p>
                        )}
                    </div>

                    {/* Medical History */}
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-2">
                            Medical History
                        </p>
                        {caseDetails?.medicalHistory && caseDetails.medicalHistory.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {caseDetails.medicalHistory.map((item, index) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[#222222] dark:text-white text-xs font-bold rounded-lg"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                {readOnly ? 'No medical history recorded' : 'Click Edit to add your medical history'}
                            </p>
                        )}
                    </div>

                    {/* Empty State for New Patients */}

                </div>
            )}
        </div>
    );
};

export default CaseDetailsCard;
