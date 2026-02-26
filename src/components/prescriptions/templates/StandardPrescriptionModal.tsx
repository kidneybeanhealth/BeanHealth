/**
 * Standard Prescription Modal
 * ────────────────────────────
 * Generic prescription template for non-KKC hospitals.
 * No Tamil bilingual labels, no religious headers, no KKC-specific branding.
 *
 * TODO (when onboarding a new hospital):
 *   - Build out this modal's JSX with clean English-only prescription layout
 *   - Pull hospital name, address, phone dynamically from the `tenant` prop
 *   - Remove hardcoded specialist list (load from DB doctors table instead)
 *
 * Current status: Uses KKC modal as a base but overrides the header section.
 * This is intentional — the routing infrastructure is working; UI can be
 * refined when the first non-KKC hospital is onboarded.
 */

import React from 'react';
import { HospitalProfile, getTenantDisplayName } from '../../../contexts/TenantContext';

// For now, reuse the existing modal — it will be replaced with a custom layout
// when the first non-KKC hospital needs a different prescription design.
import KKCModal from '../../modals/PrescriptionModal';

interface StandardPrescriptionModalProps {
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
    tenant: HospitalProfile | null;
}

const StandardPrescriptionModal: React.FC<StandardPrescriptionModalProps> = ({
    tenant,
    clinicLogo,
    ...rest
}) => {
    const resolvedLogo = clinicLogo || tenant?.avatar_url || undefined;
    const resolvedName = tenant ? getTenantDisplayName(tenant).toUpperCase() : undefined;

    return <KKCModal {...rest} clinicLogo={resolvedLogo} clinicName={resolvedName} />;
};

export default StandardPrescriptionModal;
