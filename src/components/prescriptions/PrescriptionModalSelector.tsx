/**
 * PrescriptionModalSelector — The Traffic Cop
 * ─────────────────────────────────────────────
 * Checks tenant.config.prescription and renders the correct prescription modal.
 *
 * To add a new hospital template:
 *   1. Copy the existing KKCPrescriptionModal.tsx and customize it
 *   2. Add one `case 'your_key':` below
 *   3. Set config->>'prescription' = 'your_key' in DB for that hospital
 *
 * KKC always gets 'kkc' → renders KKCPrescriptionModal (unchanged).
 * New hospitals get 'standard' → renders StandardPrescriptionModal.
 */

import React from 'react';
import { useTenant } from '../../contexts/TenantContext';

// Import both modal implementations
// Note: KKCPrescriptionModal is just the original PrescriptionModal, unchanged
import KKCPrescriptionModal from './templates/KKCPrescriptionModal';
import StandardPrescriptionModal from './templates/StandardPrescriptionModal';

// Props are identical to the existing PrescriptionModalProps — this component is a drop-in replacement
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

    const template = tenant?.config?.prescription ?? 'kkc'; // default to 'kkc' for safety

    switch (template) {
        case 'kkc':
            return <KKCPrescriptionModal {...props} />;

        // ── ADD NEW HOSPITALS HERE ─────────────────────────────────────────────
        // case 'hospital_xyz':
        //     return <HospitalXYZPrescriptionModal {...props} tenant={tenant} />;
        // ──────────────────────────────────────────────────────────────────────

        case 'standard':
        default:
            return <StandardPrescriptionModal {...props} tenant={tenant} />;
    }
};

export default PrescriptionModalSelector;
