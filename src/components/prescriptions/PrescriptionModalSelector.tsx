/**
 * PrescriptionModalSelector — The Traffic Cop
 * ─────────────────────────────────────────────
 * Checks tenant.config.prescription and renders the correct prescription modal.
 *
 * To add a new hospital template:
 *   1. Copy KKCPrescriptionModal.tsx and customise the design
 *   2. Add one `case 'your_key':` below
 *   3. Set config->>'prescription' = 'your_key' in DB for that hospital
 *
 * DEFAULT behaviour (any hospital without a custom design):
 *   Uses StandardPrescriptionModal
 */

import React, { Suspense, lazy } from 'react';
import { useTenant } from '../../contexts/TenantContext';

// We wrap the independent Hospital Modals in React.lazy()
// This forces Vite to split these into separate Javascript chunks,
// meaning the browser only downloads the specific modal it needs.
const PrescriptionModal = lazy(() => import('../modals/PrescriptionModal'));
const StandardPrescriptionModal = lazy(() => import('./templates/StandardPrescriptionModal'));

// ── ADD NEW HOSPITAL-SPECIFIC TEMPLATES HERE IN THE FUTURE ──
// const ApolloPrescriptionModal = lazy(() => import('./templates/ApolloPrescriptionModal'));
// ────────────────────────────────────────────────────────────

// Props are identical to the existing PrescriptionModalProps — this component is a drop-in
export interface PrescriptionModalSelectorProps {
    doctor: any;
    patient: any;
    onClose: () => void;
    onSendToPharmacy?: (
        medications: any[],
        notes: string,
        reviewContext?: {
            nextReviewDate: string | null;
            testsToReview: string;
            specialistsToReview: string;
        }
    ) => void;
    readOnly?: boolean;
    existingData?: any;
    clinicLogo?: string;
    actorAttribution?: {
        actorType: 'chief' | 'assistant';
        actorDisplayName: string;
    };
    onPrintOpen?: () => void;
}

const PrescriptionModalSelector: React.FC<PrescriptionModalSelectorProps> = (props) => {
    const { tenant } = useTenant();

    const template = tenant?.config?.prescription ?? 'standard'; // Default properly to standard

    let SelectedModal;

    switch (template) {
        case 'kkc':
            // The KKC Custom Layout (Loaded directly from core modals)
            SelectedModal = PrescriptionModal;
            break;
            
        // ── MAP NEW HOSPITALS HERE IN THE FUTURE ──
        // case 'apollo':
        //     SelectedModal = ApolloPrescriptionModal;
        //     break;
        // ──────────────────────────────────────────

        case 'legacy_standard':
        case 'standard':
        default:
            // Standard generic layout without specific hospital branding/Tamil text
            SelectedModal = StandardPrescriptionModal;
            break;
    }

    return (
        <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin"></div>
                    <span className="text-gray-600 font-medium">Loading Prescription System...</span>
                </div>
            </div>
        }>
            <SelectedModal {...props} tenant={tenant} />
        </Suspense>
    );
};

export default PrescriptionModalSelector;
