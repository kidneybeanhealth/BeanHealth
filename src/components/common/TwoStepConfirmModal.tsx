import React, { useEffect, useMemo, useState } from 'react';

interface TwoStepConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  continueLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  singleStep?: boolean;
}

const TwoStepConfirmModal: React.FC<TwoStepConfirmModalProps> = ({
  isOpen,
  title,
  description,
  onCancel,
  onConfirm,
  continueLabel = 'Yes, Continue',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  singleStep = false
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [canFinalConfirm, setCanFinalConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setCanFinalConfirm(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || (step !== 2 && !singleStep)) return;
    setCanFinalConfirm(false);
    const delay = singleStep ? 500 : 1000;
    const timer = window.setTimeout(() => setCanFinalConfirm(true), delay);
    return () => window.clearTimeout(timer);
  }, [isOpen, step, singleStep]);

  const stepTitle = useMemo(() => {
    return step === 1 ? title : 'Please confirm once more';
  }, [step, title]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{stepTitle}</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
          {step === 2 && (
            <p className="text-xs text-gray-500 mt-3">
              This action was rechecked for safety.
            </p>
          )}
        </div>
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
          >
            {cancelLabel}
          </button>
          {step === 1 && !singleStep ? (
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {continueLabel}
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={!canFinalConfirm}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canFinalConfirm ? (singleStep ? (confirmLabel === 'Confirm' ? 'Yes, Send' : confirmLabel) : confirmLabel) : 'Confirming...'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoStepConfirmModal;
