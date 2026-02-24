/**
 * Referral Service
 * Handles doctor referral codes and patient referral validation
 */

import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

export interface ReferralValidationResult {
  valid: boolean;
  doctorId?: string;
  doctor_id?: string;
  doctorName?: string;
  doctor_name?: string;
  errorMessage?: string;
}

export interface PatientRegistrationData {
  userId: string;
  email: string;
  name: string;
  age: number;
  gender: string;
  contact: string;
  referralCode: string;
  consentAccepted: boolean;
  diagnosisYear?: number;
  ckdStage?: string;
  comorbidities?: string[];
}

export class ReferralService {
  /**
   * Validate a doctor's referral code
   */
  static async validateReferralCode(code: string): Promise<ReferralValidationResult> {
    if (!code || code.trim().length === 0) {
      return {
        valid: false,
        errorMessage: 'Referral code is required'
      };
    }

    try {
      console.log('[ReferralService] Validating referral code:', code);

      // Call the database function to validate
      const { data, error } = await withTimeout(
        supabase.rpc('validate_referral_code', { code: code.trim().toUpperCase() }),
        10000,
        'Referral code validation timeout'
      );

      if (error) {
        console.error('[ReferralService] Validation error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          valid: false,
          errorMessage: 'Invalid referral code. Please check with your doctor.'
        };
      }

      const result = data[0];
      
      if (!result.valid) {
        return {
          valid: false,
          errorMessage: 'Invalid referral code. Please check with your doctor.'
        };
      }

      console.log('[ReferralService] Referral code validated successfully');
      return {
        valid: true,
        doctorId: result.doctor_id,
        doctor_id: result.doctor_id,
        doctorName: result.doctor_name,
        doctor_name: result.doctor_name
      };
    } catch (error) {
      console.error('[ReferralService] Failed to validate referral code:', error);
      return {
        valid: false,
        errorMessage: 'Unable to validate referral code. Please try again.'
      };
    }
  }

  /**
   * Register a patient with referral code
   * This uses the database function to ensure atomic operations
   */
  static async registerPatientWithReferral(data: PatientRegistrationData): Promise<{
    success: boolean;
    patientUid?: string;
    patient_uid?: string;
    errorMessage?: string;
  }> {
    try {
      console.log('[ReferralService] Registering patient with referral');

      // Prepare comorbidities as JSONB
      const comorbiditiesJson = data.comorbidities || [];

      const { data: result, error } = await withTimeout(
        supabase.rpc('register_patient_with_referral', {
          p_user_id: data.userId,
          p_email: data.email,
          p_name: data.name,
          p_age: data.age,
          p_gender: data.gender,
          p_contact: data.contact,
          p_referral_code: data.referralCode.trim().toUpperCase(),
          p_consent_accepted: data.consentAccepted,
          p_diagnosis_year: data.diagnosisYear || null,
          p_ckd_stage: data.ckdStage || null,
          p_comorbidities: comorbiditiesJson
        }),
        15000,
        'Patient registration timeout'
      );

      if (error) {
        console.error('[ReferralService] Registration error:', error);
        throw error;
      }

      if (!result || result.length === 0) {
        return {
          success: false,
          errorMessage: 'Registration failed. Please try again.'
        };
      }

      const regResult = result[0];

      if (!regResult.success) {
        return {
          success: false,
          errorMessage: regResult.error_message || 'Registration failed'
        };
      }

      console.log('[ReferralService] Patient registered successfully:', regResult.patient_uid);
      return {
        success: true,
        patientUid: regResult.patient_uid,
        patient_uid: regResult.patient_uid
      };
    } catch (error: any) {
      console.error('[ReferralService] Failed to register patient:', error);
      return {
        success: false,
        errorMessage: error.message || 'Registration failed. Please try again.'
      };
    }
  }

  /**
   * Get doctor's referral code
   */
  static async getDoctorReferralCode(doctorId: string): Promise<string | null> {
    try {
      console.log('[ReferralService] Fetching doctor referral code');

      const { data, error } = await withTimeout(
        supabase
          .from('users')
          .select('referral_code')
          .eq('id', doctorId)
          .eq('role', 'doctor')
          .single(),
        10000,
        'Fetch referral code timeout'
      );

      if (error) {
        console.error('[ReferralService] Error fetching referral code:', error);
        throw error;
      }

      return data?.referral_code || null;
    } catch (error) {
      console.error('[ReferralService] Failed to get doctor referral code:', error);
      return null;
    }
  }

  /**
   * Get patients referred by a doctor
   */
  static async getReferredPatients(doctorId: string) {
    try {
      console.log('[ReferralService] Fetching referred patients');

      const { data, error } = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('referring_doctor_id', doctorId)
          .eq('role', 'patient')
          .order('created_at', { ascending: false }),
        10000,
        'Fetch patients timeout'
      );

      if (error) {
        console.error('[ReferralService] Error fetching patients:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[ReferralService] Failed to get referred patients:', error);
      return [];
    }
  }

  /**
   * Copy referral code to clipboard
   */
  static copyToClipboard(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            console.log('[ReferralService] Copied to clipboard:', text);
            resolve(true);
          })
          .catch((err) => {
            console.error('[ReferralService] Failed to copy:', err);
            resolve(false);
          });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          console.log('[ReferralService] Copied to clipboard (fallback):', text);
          resolve(true);
        } catch (err) {
          console.error('[ReferralService] Failed to copy (fallback):', err);
          resolve(false);
        }
        
        document.body.removeChild(textArea);
      }
    });
  }
}
