import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
    FollowUpCallService,
    type FollowUpOutcome,
    OUTCOME_META,
} from '../../services/followUpCallService';

const STAFF_NAME_KEY = 'bh_staff_name';

interface LogCallModalProps {
    reviewId: string;
    patientName: string;
    patientPhone?: string | null;
    hospitalId: string;
    patientId: string;
    onClose: () => void;
    onLogged: () => void;
}

const OUTCOMES: { value: FollowUpOutcome; label: string; desc: string; icon: string; color: string; selectedBg: string; selectedBorder: string; selectedText: string }[] = [
    {
        value: 'confirmed',
        label: 'Confirmed',
        desc: 'Patient confirmed the visit',
        icon: '✓',
        color: 'text-emerald-600',
        selectedBg: 'bg-emerald-50',
        selectedBorder: 'border-emerald-500',
        selectedText: 'text-emerald-700',
    },
    {
        value: 'reschedule_requested',
        label: 'Reschedule',
        desc: 'Wants a different date',
        icon: '↗',
        color: 'text-amber-500',
        selectedBg: 'bg-amber-50',
        selectedBorder: 'border-amber-500',
        selectedText: 'text-amber-700',
    },
    {
        value: 'no_answer',
        label: 'No Answer',
        desc: 'Did not pick up the call',
        icon: '📵',
        color: 'text-gray-500',
        selectedBg: 'bg-gray-100',
        selectedBorder: 'border-gray-400',
        selectedText: 'text-gray-700',
    },
    {
        value: 'refused',
        label: 'Refused',
        desc: 'Declined to come',
        icon: '✕',
        color: 'text-red-500',
        selectedBg: 'bg-red-50',
        selectedBorder: 'border-red-500',
        selectedText: 'text-red-700',
    },
    {
        value: 'hospitalised',
        label: 'Hospitalised',
        desc: 'Patient is admitted elsewhere',
        icon: '⚕',
        color: 'text-purple-500',
        selectedBg: 'bg-purple-50',
        selectedBorder: 'border-purple-500',
        selectedText: 'text-purple-700',
    },
];

const LogCallModal: React.FC<LogCallModalProps> = ({
    reviewId,
    patientName,
    patientPhone,
    hospitalId,
    patientId,
    onClose,
    onLogged,
}) => {
    const [selectedOutcome, setSelectedOutcome] = useState<FollowUpOutcome | null>(null);
    const [notes, setNotes] = useState('');
    const [staffName, setStaffName] = useState(() => localStorage.getItem(STAFF_NAME_KEY) || '');
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus notes when outcome selected
    useEffect(() => {
        if (selectedOutcome && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [selectedOutcome]);

    const handleSave = async () => {
        if (!selectedOutcome) {
            toast.error('Please select a call outcome');
            return;
        }
        if (!staffName.trim()) {
            toast.error('Please enter your name');
            return;
        }

        setIsSaving(true);
        try {
            localStorage.setItem(STAFF_NAME_KEY, staffName.trim());
            await FollowUpCallService.logCall({
                reviewId,
                hospitalId,
                patientId,
                calledByName: staffName.trim(),
                outcome: selectedOutcome,
                notes: notes.trim(),
            });

            const meta = OUTCOME_META[selectedOutcome];
            toast.success(`Call logged — ${meta.label}`, { icon: '📞' });
            onLogged();
            onClose();
        } catch (err: any) {
            console.error('LogCallModal: failed to save', err);
            toast.error(err.message || 'Failed to log call');
        } finally {
            setIsSaving(false);
        }
    };

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-sm font-bold">📞</span>
                            <h2 className="text-lg font-bold text-gray-900">Log Follow-up Call</h2>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-semibold text-gray-800">{patientName}</span>
                            {patientPhone && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-md">{patientPhone}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-5 overflow-auto space-y-5">
                    {/* Staff name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            Called by (your name)
                        </label>
                        <input
                            type="text"
                            value={staffName}
                            onChange={(e) => setStaffName(e.target.value)}
                            placeholder="e.g. Priya"
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Outcome selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            What was the outcome?
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {OUTCOMES.map((opt) => {
                                const isSelected = selectedOutcome === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSelectedOutcome(opt.value)}
                                        className={`
                                            flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-center transition-all duration-150
                                            ${isSelected
                                                ? `${opt.selectedBg} ${opt.selectedBorder} ${opt.selectedText} shadow-sm`
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        <span className={`text-xl leading-none ${isSelected ? '' : opt.color}`}>{opt.icon}</span>
                                        <span className={`text-[10px] font-bold leading-tight ${isSelected ? opt.selectedText : 'text-gray-600'}`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedOutcome && (
                            <p className="mt-2 text-xs text-gray-500 text-center">
                                {OUTCOMES.find(o => o.value === selectedOutcome)?.desc}
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder='e.g. "Patient said will come after 15th, prefers morning slot"'
                            rows={3}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-6 pt-3 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !selectedOutcome || !staffName.trim()}
                        className={`
                            flex-1 py-3 rounded-xl font-semibold text-sm transition-all
                            ${(!selectedOutcome || !staffName.trim() || isSaving)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-900 text-white hover:bg-black shadow-sm'
                            }
                        `}
                    >
                        {isSaving ? 'Saving…' : 'Save Call'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogCallModal;
