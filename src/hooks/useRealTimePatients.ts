/**
 * useRealTimePatients Hook
 * 
 * Industry-standard real-time subscription hook for doctor's patient list.
 * Ensures immediate visibility of newly assigned patients using:
 * - Supabase Postgres Changes (real-time subscriptions)
 * - Visibility change detection (tab focus handling)
 * - Periodic health checks (fallback polling)
 * - Connection status monitoring
 * - Optimistic updates with notifications
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PatientAdditionService } from '../services/patientInvitationService';
import { User } from '../types';
import { toast } from 'react-hot-toast';

export interface UseRealTimePatientsOptions {
  doctorId: string | undefined;
  onPatientAdded?: (patient: User) => void;
  onPatientRemoved?: (patientId: string) => void;
  enableToasts?: boolean;
  healthCheckInterval?: number; // in milliseconds, default 60000 (1 minute)
}

export interface UseRealTimePatientsResult {
  patients: User[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export function useRealTimePatients({
  doctorId,
  onPatientAdded,
  onPatientRemoved,
  enableToasts = true,
  healthCheckInterval = 60000
}: UseRealTimePatientsOptions): UseRealTimePatientsResult {
  const [patients, setPatients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs to track state without causing re-renders
  const channelRef = useRef<any>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const doctorIdRef = useRef(doctorId);
  const initialFetchDoneRef = useRef(false);

  // Keep doctorId ref updated
  useEffect(() => {
    doctorIdRef.current = doctorId;
  }, [doctorId]);

  /**
   * Fetch patients from database with timeout
   */
  const fetchPatients = useCallback(async (isBackground = false): Promise<void> => {
    const currentDoctorId = doctorIdRef.current;
    if (!currentDoctorId || isFetchingRef.current) {
      if (!currentDoctorId) setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    if (!isBackground) setLoading(true);

    try {
      console.log('[useRealTimePatients] Fetching patients for doctor:', currentDoctorId);
      
      // Add timeout to prevent hanging
      const fetchPromise = PatientAdditionService.getDoctorPatients(currentDoctorId);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Fetch timeout after 10s')), 10000);
      });
      
      const patientsData = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (mountedRef.current) {
        setPatients(patientsData);
        setError(null);
        setLastUpdated(new Date());
        console.log('[useRealTimePatients] Loaded', patientsData.length, 'patients');
      }
    } catch (err: any) {
      console.error('[useRealTimePatients] Error fetching patients:', err);
      if (mountedRef.current) {
        // Only set error on initial load, not background refreshes
        if (!isBackground) {
          setError('Failed to load patients');
        }
        // Don't show toast for timeouts on background refreshes
        if (enableToasts && !isBackground && err.message !== 'Fetch timeout after 10s') {
          toast.error('Failed to load patients. Please try again.');
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [enableToasts]);

  /**
   * Main effect: Initial fetch + real-time subscription
   * Combined to prevent race conditions and multiple fetches
   */
  useEffect(() => {
    if (!doctorId) {
      setLoading(false);
      setPatients([]);
      return;
    }

    mountedRef.current = true;
    initialFetchDoneRef.current = false;

    // Initial fetch
    const doInitialFetch = async () => {
      if (!initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true;
        await fetchPatients(false);
      }
    };
    doInitialFetch();

    // Setup real-time subscription
    console.log('[useRealTimePatients] Setting up real-time subscription for doctor:', doctorId);

    const channel = supabase
      .channel(`doctor-patients-${doctorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_doctor_relationships',
          filter: `doctor_id=eq.${doctorId}`
        },
        async (payload: any) => {
          console.log('[useRealTimePatients] Patient relationship added:', payload);
          
          // Fetch the new patient's data
          try {
            const { data: patientData, error: fetchError } = await (supabase
              .from('users') as any)
              .select('*')
              .eq('id', payload.new.patient_id)
              .single() as { data: any; error: any };

            if (fetchError) throw fetchError;

            if (patientData && mountedRef.current) {
              const newPatient: User = {
                id: patientData.id,
                email: patientData.email,
                name: patientData.name,
                role: patientData.role,
                patientId: patientData.patient_id,
                patient_id: patientData.patient_id,
                avatarUrl: null,
                avatar_url: null,
                specialty: patientData.specialty,
                dateOfBirth: patientData.date_of_birth,
                date_of_birth: patientData.date_of_birth,
                condition: patientData.condition,
                subscriptionTier: patientData.subscription_tier,
                subscription_tier: patientData.subscription_tier,
                urgentCredits: patientData.urgent_credits,
                urgent_credits: patientData.urgent_credits,
                trialEndsAt: patientData.trial_ends_at,
                trial_ends_at: patientData.trial_ends_at,
                notes: patientData.notes,
                created_at: patientData.created_at,
                updated_at: patientData.updated_at
              };

              setPatients(prev => {
                if (prev.some(p => p.id === newPatient.id)) return prev;
                return [...prev, newPatient];
              });

              setLastUpdated(new Date());

              if (enableToasts) {
                toast.success(`New patient assigned: ${newPatient.name || 'Unknown'}`, {
                  duration: 4000,
                  icon: '👤'
                });
              }

              onPatientAdded?.(newPatient);
            }
          } catch (err) {
            console.error('[useRealTimePatients] Error fetching new patient:', err);
            // Fallback: refetch all
            fetchPatients(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'patient_doctor_relationships',
          filter: `doctor_id=eq.${doctorId}`
        },
        (payload: any) => {
          console.log('[useRealTimePatients] Patient relationship removed:', payload);
          const removedPatientId = payload.old.patient_id;
          
          if (mountedRef.current) {
            setPatients(prev => {
              const removedPatient = prev.find(p => p.id === removedPatientId);
              if (enableToasts && removedPatient) {
                toast(`Patient removed: ${removedPatient.name || 'Unknown'}`, {
                  duration: 3000,
                  icon: 'ℹ️'
                });
              }
              return prev.filter(p => p.id !== removedPatientId);
            });
            setLastUpdated(new Date());
            onPatientRemoved?.(removedPatientId);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[useRealTimePatients] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          console.error('[useRealTimePatients] Connection error:', err);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[useRealTimePatients] Cleaning up subscription');
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [doctorId]); // Only re-run when doctorId changes

  /**
   * Periodic health check (separate effect, stable reference)
   */
  useEffect(() => {
    if (!doctorId || healthCheckInterval <= 0) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && mountedRef.current && !isFetchingRef.current) {
        console.log('[useRealTimePatients] Health check refresh...');
        fetchPatients(true);
      }
    }, healthCheckInterval);

    return () => clearInterval(interval);
  }, [doctorId, healthCheckInterval, fetchPatients]);

  /**
   * Visibility change handler
   */
  useEffect(() => {
    if (!doctorId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mountedRef.current && !isFetchingRef.current) {
        fetchPatients(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [doctorId, fetchPatients]);

  /**
   * Network recovery handler
   */
  useEffect(() => {
    const handleOnline = () => {
      if (mountedRef.current && !isFetchingRef.current) {
        console.log('[useRealTimePatients] Network restored, refreshing...');
        fetchPatients(true);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchPatients]);

  return {
    patients,
    loading,
    error,
    isConnected,
    lastUpdated,
    refetch: () => fetchPatients(false)
  };
}
