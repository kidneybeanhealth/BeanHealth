/**
 * FeedbackRegisterModal — the Patient Feedback register, one click from the
 * dashboard header
 *
 * Past Records ▸ Reports ▸ Patient Feedback is three steps deep, and a doctor
 * between patients will not go looking. So the header carries a button beside
 * Team & Audit that opens the SAME register — the same FeedbackRegisterPanel,
 * not a second view of the data — in a window over whatever the doctor was
 * doing. Nothing to keep in sync: both entry points render one component.
 *
 * Full screen on a phone, a large centred window on a desktop or tablet. The
 * register's own dialogs (QR poster, delete confirmation) sit above this one.
 */
import React, { Suspense, lazy, useEffect } from 'react';

const FeedbackRegisterPanel = lazy(() => import('./FeedbackRegisterPanel'));

export interface FeedbackRegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    hospitalId: string;
    doctorId?: string | null;
    doctorName?: string | null;
}

const FeedbackRegisterModal: React.FC<FeedbackRegisterModalProps> = ({ isOpen, onClose, hospitalId, doctorId, doctorName }) => {
    // Escape closes it, and the dashboard behind must not scroll under a window.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Patient feedback"
                className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[90vh] sm:max-w-5xl sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-gray-900">Patient Feedback</h2>
                        <p className="truncate text-xs text-gray-500">What patients said through the QR poster and the desk form</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                        ×
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <Suspense fallback={<div className="p-16 text-center text-sm text-gray-400">Loading feedback…</div>}>
                        <FeedbackRegisterPanel hospitalId={hospitalId} doctorId={doctorId} doctorName={doctorName} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
};

export default FeedbackRegisterModal;
