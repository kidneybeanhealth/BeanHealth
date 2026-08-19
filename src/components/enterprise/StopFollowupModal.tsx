/**
 * StopFollowupModal — ask WHY before ending a patient's follow-up
 * ───────────────────────────────────────────────────────────────
 * Reception always asked for a reason. The Doctor dashboard did not: it used a
 * window.confirm() and hardcoded `reason: 'external_hospital_transfer'`, so every
 * stop from that side was recorded as a transfer whether or not the patient had
 * transferred anywhere. That made the stored reason untrustworthy exactly when it
 * matters — reviewing who has fallen out of care and why.
 *
 * One modal, both dashboards, so the two can't drift again.
 *
 * Stopping is a real clinical decision, not a tidy-up: it cancels every active
 * review and removes the patient from all the due buckets. So the reason is
 * required, and a confirm step states plainly what is about to happen.
 */
import React, { useState } from 'react';

/** Common reasons, offered as one tap. "Other" falls through to free text. */
const PRESET_REASONS = [
    'Moved to another hospital',
    'Patient declined further follow-up',
    'Treatment completed',
    'Unable to travel',
    'Financial constraints',
    'Not contactable',
] as const;

interface Props {
    patientName: string;
    mrNumber?: string | null;
    submitting?: boolean;
    onCancel: () => void;
    onConfirm: (reason: string, notes: string) => void;
}

const StopFollowupModal: React.FC<Props> = ({
    patientName, mrNumber, submitting = false, onCancel, onConfirm,
}) => {
    const [preset, setPreset] = useState<string>('');
    const [freeText, setFreeText] = useState('');
    const [notes, setNotes] = useState('');
    const [confirming, setConfirming] = useState(false);

    // A preset is a shortcut, not a constraint — "Other" is always available and
    // the free text is what actually gets stored when it is chosen.
    const reason = preset === 'Other' ? freeText.trim() : preset;
    const canSubmit = Boolean(reason) && !submitting;

    return (
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden">

                <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-start justify-between gap-3 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold">Stop Follow-up</h3>
                        <p className="text-amber-100 text-sm mt-0.5 font-medium">
                            {patientName}{mrNumber ? ` · ${mrNumber}` : ''}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        className="p-1.5 rounded-lg text-amber-100 hover:text-white hover:bg-amber-700/50 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!confirming ? (
                    <>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <p className="text-sm text-gray-600">
                                This cancels every active review for this patient and removes them from
                                Due Today, Due Tomorrow and Missed Followup.
                            </p>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[...PRESET_REASONS, 'Other'].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setPreset(r)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                                preset === r
                                                    ? 'bg-amber-600 text-white border-amber-600'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                                            }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {preset === 'Other' && (
                                <textarea
                                    value={freeText}
                                    onChange={(e) => setFreeText(e.target.value)}
                                    rows={2}
                                    autoFocus
                                    placeholder="Type the reason"
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                                />
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Notes <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Anything the next person should know"
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
                            <button
                                type="button" onClick={onCancel} disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirming(true)}
                                disabled={!canSubmit}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-6 space-y-4">
                            <p className="text-sm font-bold text-gray-900">Please confirm</p>
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                                <p className="text-sm font-bold text-amber-900">{patientName}</p>
                                <p className="text-xs text-amber-800">
                                    <span className="font-semibold">Reason:</span> {reason}
                                </p>
                                {notes.trim() && (
                                    <p className="text-xs text-amber-800">
                                        <span className="font-semibold">Notes:</span> {notes.trim()}
                                    </p>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Active reviews will be cancelled. The patient stays in Past Records and
                                appears under <span className="font-semibold">Follow-up Stopped</span>,
                                so this can be reviewed later.
                            </p>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
                            <button
                                type="button" onClick={() => setConfirming(false)} disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60"
                            >
                                Go Back
                            </button>
                            <button
                                type="button"
                                onClick={() => onConfirm(reason, notes.trim())}
                                disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md transition-all disabled:opacity-60"
                            >
                                {submitting ? 'Saving…' : 'Yes, Stop Follow-up'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default StopFollowupModal;
