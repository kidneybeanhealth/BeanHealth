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
 *   Uses KKCPrescriptionModal — which is the KKC layout but fetches
 *   hospital name, logo, phone, address etc. from the hospital_profiles row
 *   for whichever hospital is currently assigned to the prescription.
 */

import React from 'react';
import { useTenant } from '../../contexts/TenantContext';

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
        // ── ADD NEW HOSPITAL-SPECIFIC TEMPLATES HERE ──────────────────────────
        // case 'apollo':
        //     return <ApolloPrescriptionModal {...props} />;
        // ─────────────────────────────────────────────────────────────────────

        case 'legacy_standard':
            // Kept for backward-compatibility only.
            // New hospitals should use the default KKC template below.
            return <StandardPrescriptionModal {...props} tenant={tenant} />;

        case 'kkc':
        case 'standard':
        default:
            // Both KKC and all other hospitals without a custom template
            // use KKCPrescriptionModal, which dynamically fetches clinic
            // details (name, logo, phone, address) from the hospital profile.
            return <KKCPrescriptionModal {...props} />;
    }
};

export default PrescriptionModalSelector;
