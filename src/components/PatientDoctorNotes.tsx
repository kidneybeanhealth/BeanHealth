import React, { useState, useEffect } from 'react';
import { DoctorNotesService, DoctorNote } from '../services/doctorNotesService';

interface PatientDoctorNotesProps {
    patientId: string;
}

/**
 * Patient-facing component to display doctor's notes (read-only)
 * Only shows notes where is_visible_to_patient = true
 */
const PatientDoctorNotes: React.FC<PatientDoctorNotesProps> = ({ patientId }) => {
    const [notes, setNotes] = useState<DoctorNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchNotes = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const visibleNotes = await DoctorNotesService.getPatientVisibleNotes(patientId);
                setNotes(visibleNotes);
            } catch (err) {
                console.error('Error fetching patient notes:', err);
                setError('Unable to load doctor notes');
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotes();
    }, [patientId]);

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Format time for display
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-md p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                    <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                        Loading notes from your doctor...
                    </span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-md p-6">
                <div className="text-center py-8">
                    <span className="text-3xl mb-2 block">⚠️</span>
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-md p-6">
                <div className="text-center py-8">
                    <span className="text-3xl mb-2 block">📝</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No notes from your doctor yet.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Your doctor's observations will appear here when shared with you.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-900/30">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    📋 Notes from Your Doctor
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your doctor has shared {notes.length} note{notes.length !== 1 ? 's' : ''} with you
                </p>
            </div>

            {/* Notes List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {notes.map((note) => (
                    <div key={note.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <span className="text-lg">👨‍⚕️</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {note.doctorName || 'Your Doctor'}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {formatDate(note.createdAt)} at {formatTime(note.createdAt)}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {note.content}
                                </p>

                                {/* Note type badge */}
                                {note.noteType && note.noteType !== 'quick_note' && (
                                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                        {note.noteType === 'clinical_observation' ? 'Clinical Observation' : 'Follow-up'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                    💡 These notes are shared by your healthcare provider to keep you informed about your care.
                </p>
            </div>
        </div>
    );
};

export default PatientDoctorNotes;
