/**
 * Supabase Client Singleton
 * 
 * FIXES APPLIED:
 * - Ensures single client instance across app (singleton pattern)
 * - Adds proper timeout configuration for DB queries
 * - Implements robust reconnection logic for realtime
 * - Validates environment variables on initialization
 * 
 * WHY: Prevents multiple client instances causing auth/state conflicts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { CapacitorStorage } from './CapacitorStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Validate URL format
try {
  new URL(supabaseUrl);
  // Log connection info (mask the actual URL for security in console)
  console.log('[Supabase] Connecting to:', supabaseUrl.replace(/https:\/\/([^.]+)\./, 'https://*****.'));
  console.log('[Supabase] Anon key starts with:', supabaseAnonKey.substring(0, 20) + '...');
} catch (e) {
  throw new Error('Invalid VITE_SUPABASE_URL format. Must be a valid URL.');
}

// Determine redirect URL based on platform
const getRedirectUrl = () => {
  if (Capacitor.isNativePlatform()) {
    // For mobile app, use deep link
    return 'com.beanhealth.app://oauth-callback'
  }
  // For web, use current origin
  return window.location.origin
}

// Track initialization to ensure singleton
let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create the Supabase client singleton
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    console.log('[Supabase] Initializing client singleton');

    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: Capacitor.isNativePlatform() ? CapacitorStorage : window.localStorage,
        storageKey: 'supabase.auth.token',
        flowType: 'pkce',
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries) => {
          const delay = Math.min(1000 * Math.pow(2, tries), 10000);
          console.log(`[Supabase] Realtime reconnecting in ${delay}ms (attempt ${tries})`);
          return delay;
        }
      },
      global: {
        headers: {
          'x-client-info': 'beanhealth-app'
        },
        // Add fetch wrapper to handle timeouts globally
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          return fetch(url, {
            ...options,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutId));
        }
      },
      db: {
        schema: 'public'
      }
    });

    console.log('[Supabase] Client initialized successfully');
  }

  return supabaseInstance;
}

// Export singleton instance for backward compatibility
export const supabase = getSupabaseClient();



// Database types (auto-generated from Supabase)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'patient' | 'doctor'
          avatar_url?: string
          specialty?: string
          date_of_birth?: string
          condition?: string
          subscription_tier?: 'FreeTrial' | 'Paid'
          urgent_credits?: number
          trial_ends_at?: string
          notes?: string
          referral_code?: string
          referred_by?: string
          patient_id?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'patient' | 'doctor'
          avatar_url?: string
          specialty?: string
          date_of_birth?: string
          condition?: string
          subscription_tier?: 'FreeTrial' | 'Paid'
          urgent_credits?: number
          trial_ends_at?: string
          notes?: string
          referral_code?: string
          referred_by?: string
          patient_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'patient' | 'doctor'
          avatar_url?: string
          specialty?: string
          date_of_birth?: string
          condition?: string
          subscription_tier?: 'FreeTrial' | 'Paid'
          urgent_credits?: number
          trial_ends_at?: string
          notes?: string
          referral_code?: string
          referred_by?: string
          patient_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      vitals: {
        Row: {
          id: string
          patient_id: string
          blood_pressure_value?: string
          blood_pressure_unit?: string
          blood_pressure_trend?: 'up' | 'down' | 'stable'
          heart_rate_value?: string
          heart_rate_unit?: string
          heart_rate_trend?: 'up' | 'down' | 'stable'
          temperature_value?: string
          temperature_unit?: string
          temperature_trend?: 'up' | 'down' | 'stable'
          glucose_value?: string
          glucose_unit?: string
          glucose_trend?: 'up' | 'down' | 'stable'
          recorded_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          blood_pressure_value?: string
          blood_pressure_unit?: string
          blood_pressure_trend?: 'up' | 'down' | 'stable'
          heart_rate_value?: string
          heart_rate_unit?: string
          heart_rate_trend?: 'up' | 'down' | 'stable'
          temperature_value?: string
          temperature_unit?: string
          temperature_trend?: 'up' | 'down' | 'stable'
          glucose_value?: string
          glucose_unit?: string
          glucose_trend?: 'up' | 'down' | 'stable'
          recorded_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          blood_pressure_value?: string
          blood_pressure_unit?: string
          blood_pressure_trend?: 'up' | 'down' | 'stable'
          heart_rate_value?: string
          heart_rate_unit?: string
          heart_rate_trend?: 'up' | 'down' | 'stable'
          temperature_value?: string
          temperature_unit?: string
          temperature_trend?: 'up' | 'down' | 'stable'
          glucose_value?: string
          glucose_unit?: string
          glucose_trend?: 'up' | 'down' | 'stable'
          recorded_at?: string
        }
      }
      medications: {
        Row: {
          id: string
          patient_id: string
          name: string
          dosage: string
          frequency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          name: string
          dosage: string
          frequency: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          name?: string
          dosage?: string
          frequency?: string
          created_at?: string
          updated_at?: string
        }
      }
      medical_records: {
        Row: {
          id: string
          patient_id: string
          date: string
          type: string
          summary: string
          doctor: string
          category: string
          file_url?: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          date: string
          type: string
          summary: string
          doctor: string
          category: string
          file_url?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          date?: string
          type?: string
          summary?: string
          doctor?: string
          category?: string
          file_url?: string
          created_at?: string
        }
      }
      patient_doctor_relationships: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          doctor_id: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          doctor_id?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          text?: string
          audio_url?: string
          is_read: boolean
          is_urgent: boolean
          timestamp: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          text?: string
          audio_url?: string
          is_read?: boolean
          is_urgent?: boolean
          timestamp?: string
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          text?: string
          audio_url?: string
          is_read?: boolean
          is_urgent?: boolean
          timestamp?: string
        }
      }
    }
  }
}