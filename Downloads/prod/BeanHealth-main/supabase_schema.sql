-- BeanHealth Supabase Database Schema
-- This file contains the complete database schema for BeanHealth
-- Run these commands in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (both patients and doctors)
CREATE TABLE public.users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('patient', 'doctor')) NOT NULL,
  avatar_url TEXT,
  
  -- Doctor specific fields
  specialty TEXT,
  
  -- Patient specific fields
  date_of_birth DATE,
  condition TEXT,
  subscription_tier TEXT DEFAULT 'FreeTrial' CHECK (subscription_tier IN ('FreeTrial', 'Paid')),
  urgent_credits INTEGER DEFAULT 5,
  trial_ends_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vitals table
CREATE TABLE public.vitals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Blood Pressure
  blood_pressure_value TEXT,
  blood_pressure_unit TEXT DEFAULT 'mmHg',
  blood_pressure_trend TEXT CHECK (blood_pressure_trend IN ('up', 'down', 'stable')),
  
  -- Heart Rate
  heart_rate_value TEXT,
  heart_rate_unit TEXT DEFAULT 'bpm',
  heart_rate_trend TEXT CHECK (heart_rate_trend IN ('up', 'down', 'stable')),
  
  -- Temperature
  temperature_value TEXT,
  temperature_unit TEXT DEFAULT '°F',
  temperature_trend TEXT CHECK (temperature_trend IN ('up', 'down', 'stable')),
  
  -- Glucose (optional)
  glucose_value TEXT,
  glucose_unit TEXT DEFAULT 'mg/dL',
  glucose_trend TEXT CHECK (glucose_trend IN ('up', 'down', 'stable')),
  
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medications table
CREATE TABLE public.medications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical records table
CREATE TABLE public.medical_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  doctor TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient-Doctor relationships
CREATE TABLE public.patient_doctor_relationships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT,
  audio_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_vitals_patient_id ON public.vitals(patient_id);
CREATE INDEX idx_vitals_recorded_at ON public.vitals(recorded_at);
CREATE INDEX idx_medications_patient_id ON public.medications(patient_id);
CREATE INDEX idx_medical_records_patient_id ON public.medical_records(patient_id);
CREATE INDEX idx_medical_records_date ON public.medical_records(date);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_recipient_id ON public.chat_messages(recipient_id);
CREATE INDEX idx_chat_messages_timestamp ON public.chat_messages(timestamp);
CREATE INDEX idx_patient_doctor_patient_id ON public.patient_doctor_relationships(patient_id);
CREATE INDEX idx_patient_doctor_doctor_id ON public.patient_doctor_relationships(doctor_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_doctor_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Patients can see their own vitals
CREATE POLICY "Patients can view own vitals" ON public.vitals
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = vitals.patient_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own vitals" ON public.vitals
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own vitals" ON public.vitals
  FOR UPDATE USING (patient_id = auth.uid());

-- Similar policies for medications
CREATE POLICY "Patients can view own medications" ON public.medications
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = medications.patient_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patients can manage own medications" ON public.medications
  FOR ALL USING (patient_id = auth.uid());

-- Medical records policies
CREATE POLICY "Patients can view own records" ON public.medical_records
  FOR SELECT USING (
    patient_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_relationships 
      WHERE patient_id = medical_records.patient_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patients can manage own records" ON public.medical_records
  FOR ALL USING (patient_id = auth.uid());

-- Chat messages policies
CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own messages" ON public.chat_messages
  FOR UPDATE USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Patient-Doctor relationship policies
CREATE POLICY "View own relationships" ON public.patient_doctor_relationships
  FOR SELECT USING (patient_id = auth.uid() OR doctor_id = auth.uid());

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - for testing)
-- Insert sample doctor
INSERT INTO public.users (id, email, name, role, specialty) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'dr.smith@clinic.com', 'Dr. Smith', 'doctor', 'Cardiologist'),
  ('550e8400-e29b-41d4-a716-446655440002', 'dr.jones@clinic.com', 'Dr. Jones', 'doctor', 'General Practitioner');

-- Insert sample patient
INSERT INTO public.users (id, email, name, role, date_of_birth, condition, subscription_tier, urgent_credits, notes) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'jane@example.com', 'Jane Doe', 'patient', '1985-05-23', 'Hypertension', 'Paid', 5, 'Feeling a bit tired this week. Remember to ask Dr. Smith about sleep patterns.');

-- Insert patient-doctor relationship
INSERT INTO public.patient_doctor_relationships (patient_id, doctor_id) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001'),
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002');

-- Insert sample vitals
INSERT INTO public.vitals (patient_id, blood_pressure_value, heart_rate_value, temperature_value, blood_pressure_trend, heart_rate_trend, temperature_trend) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', '130/85', '72', '98.6', 'stable', 'stable', 'stable');

-- Insert sample medications
INSERT INTO public.medications (patient_id, name, dosage, frequency) VALUES
  ('550e8400-e29b-41d4-a716-446655440003', 'Lisinopril', '10mg', 'Once a day'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Amlodipine', '5mg', 'Once a day');

-- Insert sample chat message
INSERT INTO public.chat_messages (sender_id, recipient_id, text, is_read) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'Hi Jane, just checking in.', true),
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Hi Dr. Smith! I''m doing well, thanks for asking.', false);