/**
 * KKC Prescription Modal  (Tenant-Aware Wrapper)
 * ────────────────────────────────────────────────
 * This is the default prescription template for ALL hospitals that do not
 * have a custom-designed prescription layout.
 *
 * It uses the KKC visual design (PrescriptionModal) but dynamically fetches
 * the hospital name, logo, address, phone and doctor details from the
 * hospital_profiles row that belongs to the currently-logged-in tenant.
 *
 * How it works:
 *   1. useTenant() loads the hospital profile from Supabase (already cached).
 *   2. We derive clinic fields (name, logo, phone, address, etc.) from it.
 *   3. We build footerDoctorText from the doctor prop (name + qualification).
 *   4. Everything is forwarded to PrescriptionModal as props.
 *
 * To add a brand-new prescription design for a specific hospital:
 *   - Create a new file in this folder (e.g. ApolloPrescritionModal.tsx)
 *   - Add a case in PrescriptionModalSelector.tsx
 *   - Set config->>'prescription' = 'apollo' for that hospital in the DB
 */

import React, { useState, useEffect } from 'react';
import {
  useTenant,
  getTenantDisplayName,
  getTenantPhone,
} from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import PrescriptionModal from '../../modals/PrescriptionModal';

// Props mirror PrescriptionModalSelectorProps — this component is a drop-in.
export interface KKCPrescriptionModalProps {
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
  clinicLogo?: string;       // Optional override — overrides tenant logo if supplied by caller
  actorAttribution?: {
    actorType: 'chief' | 'assistant';
    actorDisplayName: string;
  };
  onPrintOpen?: () => void;
}

const KKCPrescriptionModal: React.FC<KKCPrescriptionModalProps> = (props) => {
  const { tenant } = useTenant();
  const [specialistOptions, setSpecialistOptions] = useState<string[] | null>(null); // null = still loading

  /* ── Fetch all doctors onboarded for this hospital ── */
  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('hospital_doctors' as any)
          .select('name')
          .eq('hospital_id', tenant.id)
          .order('name', { ascending: true });
        if (!error && data) {
          // Set to fetched list (may be empty [] — that's fine, means no doctors configured yet)
          setSpecialistOptions((data as any[]).map((d) => d.name as string));
        } else {
          // Fetch failed — fall back to KKC defaults
          setSpecialistOptions([]);
        }
      } catch (e) {
        console.error('[KKCPrescriptionModal] Failed to fetch hospital doctors:', e);
        setSpecialistOptions([]); // unblock on error
      }
    })();
  }, [tenant?.id]);

  /* ── Derive clinic details from the hospital profile ── */
  const clinicName = tenant
    ? getTenantDisplayName(tenant).toUpperCase()
    : undefined; // falls back to KKC hardcoded name inside PrescriptionModal

  const clinicLogo = props.clinicLogo || tenant?.avatar_url || undefined;

  const clinicAddress = tenant?.address
    ? tenant.address.toUpperCase()
    : undefined;

  const clinicPhone = tenant ? getTenantPhone(tenant) : undefined;

  const emergencyPhone = tenant?.emergency_phone || clinicPhone || undefined;

  const workingHours = tenant?.working_hours || undefined;

  /* ── Build footer doctor text from the doctor prop ── */
  const footerDoctorText = (() => {
    if (!props.doctor) return undefined;
    const d = props.doctor;
    const name = (d.full_name || d.name || '').toUpperCase();
    if (!name) return undefined;

    const qualification = (d.qualification || '').toUpperCase();
    const specialization = (d.specialization || '').toUpperCase();

    const parts: string[] = [name];
    if (qualification) parts.push(qualification);
    if (specialization) parts.push(specialization);
    return parts.join(' | ');
  })();

  return (
    <PrescriptionModal
      {...props}
      clinicLogo={clinicLogo}
      clinicName={clinicName}
      clinicAddress={clinicAddress}
      clinicPhone={clinicPhone}
      emergencyPhone={emergencyPhone}
      workingHours={workingHours}
      footerDoctorText={footerDoctorText}
      specialistOptions={specialistOptions}
    />
  );
};

export default KKCPrescriptionModal;
