/**
 * Supabase Database Types
 * 
 * Auto-generated type definitions for type-safe database operations
 */

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'patient' | 'doctor' | 'admin' | 'enterprise'
          beanhealth_id?: string
          avatar_url?: string
          specialty?: string
          date_of_birth?: string
          condition?: string
          subscription_tier?: 'FreeTrial' | 'Paid'
          urgent_credits?: number
          trial_ends_at?: string
          notes?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'patient' | 'doctor' | 'admin' | 'enterprise'
          beanhealth_id?: string
          avatar_url?: string
          specialty?: string
          date_of_birth?: string
          condition?: string
          subscription_tier?: 'FreeTrial' | 'Paid'
          urgent_credits?: number
          trial_ends_at?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'patient' | 'doctor' | 'admin' | 'enterprise'
          beanhealth_id?: string
          avatar_url?: string
          specialty?: string
          date_of_birth?: string
          condition?: string
          subscription_tier?: 'FreeTrial' | 'Paid'
          urgent_credits?: number
          trial_ends_at?: string
          notes?: string
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
          file_url?: string
          file_name?: string
          file_type?: string
          file_size?: number
          mime_type?: string
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
          file_url?: string
          file_name?: string
          file_type?: string
          file_size?: number
          mime_type?: string
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
          file_url?: string
          file_name?: string
          file_type?: string
          file_size?: number
          mime_type?: string
          is_read?: boolean
          is_urgent?: boolean
          timestamp?: string
        }
      }
    }
  }
}
