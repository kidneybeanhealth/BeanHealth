/**
 * Test Data Population Script
 * 
 * This script populates test data for patient harishsaravanan1310@gmail.com
 * with CKD-related lab results and medications for 3 visits.
 * 
 * Run with: node --loader ts-node/esm scripts/populateTestData.ts
 * Or copy the SQL below and run in Supabase SQL editor
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// For running directly - copy these environment variables from your .env file
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_KEY';

// This script is designed to show the SQL that can be run in Supabase
// Or run programmatically

const PATIENT_EMAIL = 'harishsaravanan1310@gmail.com';

// Visit dates (spaced 2 weeks apart)
const VISIT_DATES = [
    '2025-12-01', // Visit 1 - Oldest
    '2025-12-15', // Visit 2 - Middle
    '2025-12-29', // Visit 3 - Most recent
];

// CKD-related lab results for each visit (showing gradual improvement)
const LAB_RESULTS = [
    // Visit 1 - Baseline (more concerning values)
    {
        date: VISIT_DATES[0],
        labs: [
            { test_type: 'creatinine', value: 2.1, unit: 'mg/dL', status: 'abnormal', reference_range_min: 0.7, reference_range_max: 1.3 },
            { test_type: 'egfr', value: 35, unit: 'mL/min/1.73m²', status: 'abnormal', reference_range_min: 60, reference_range_max: 120 },
            { test_type: 'bun', value: 32, unit: 'mg/dL', status: 'abnormal', reference_range_min: 7, reference_range_max: 20 },
            { test_type: 'potassium', value: 5.4, unit: 'mmol/L', status: 'borderline', reference_range_min: 3.5, reference_range_max: 5.0 },
            { test_type: 'hemoglobin', value: 10.5, unit: 'g/dL', status: 'borderline', reference_range_min: 12.0, reference_range_max: 16.0 },
            { test_type: 'bicarbonate', value: 19, unit: 'mmol/L', status: 'abnormal', reference_range_min: 22, reference_range_max: 29 },
        ]
    },
    // Visit 2 - Some improvement
    {
        date: VISIT_DATES[1],
        labs: [
            { test_type: 'creatinine', value: 1.9, unit: 'mg/dL', status: 'abnormal', reference_range_min: 0.7, reference_range_max: 1.3 },
            { test_type: 'egfr', value: 40, unit: 'mL/min/1.73m²', status: 'abnormal', reference_range_min: 60, reference_range_max: 120 },
            { test_type: 'bun', value: 28, unit: 'mg/dL', status: 'borderline', reference_range_min: 7, reference_range_max: 20 },
            { test_type: 'potassium', value: 4.8, unit: 'mmol/L', status: 'borderline', reference_range_min: 3.5, reference_range_max: 5.0 },
            { test_type: 'hemoglobin', value: 11.2, unit: 'g/dL', status: 'borderline', reference_range_min: 12.0, reference_range_max: 16.0 },
            { test_type: 'bicarbonate', value: 21, unit: 'mmol/L', status: 'borderline', reference_range_min: 22, reference_range_max: 29 },
        ]
    },
    // Visit 3 - Continued improvement
    {
        date: VISIT_DATES[2],
        labs: [
            { test_type: 'creatinine', value: 1.7, unit: 'mg/dL', status: 'borderline', reference_range_min: 0.7, reference_range_max: 1.3 },
            { test_type: 'egfr', value: 45, unit: 'mL/min/1.73m²', status: 'borderline', reference_range_min: 60, reference_range_max: 120 },
            { test_type: 'bun', value: 24, unit: 'mg/dL', status: 'borderline', reference_range_min: 7, reference_range_max: 20 },
            { test_type: 'potassium', value: 4.5, unit: 'mmol/L', status: 'normal', reference_range_min: 3.5, reference_range_max: 5.0 },
            { test_type: 'hemoglobin', value: 11.8, unit: 'g/dL', status: 'borderline', reference_range_min: 12.0, reference_range_max: 16.0 },
            { test_type: 'bicarbonate', value: 23, unit: 'mmol/L', status: 'normal', reference_range_min: 22, reference_range_max: 29 },
        ]
    },
];

// Prescriptions for each visit with CKD-related medications
const PRESCRIPTIONS = [
    // Visit 1
    {
        date: VISIT_DATES[0],
        notes: 'Initial visit. CKD Stage 3b. Starting conservative management.\nDiet: Low sodium (<2g/day), low potassium, moderate protein restriction.\nFollow up in 2 weeks.',
        medications: [
            { name: 'Lisinopril', dosage: '10', unit: 'mg', frequency: 'once daily', instructions: 'Take in the morning' },
            { name: 'Calcium Carbonate', dosage: '500', unit: 'mg', frequency: 'three times daily', instructions: 'Take with meals' },
            { name: 'Sodium Bicarbonate', dosage: '650', unit: 'mg', frequency: 'twice daily', instructions: 'For metabolic acidosis' },
        ]
    },
    // Visit 2
    {
        date: VISIT_DATES[1],
        notes: 'Follow-up visit. Labs showing improvement. Increasing ACE inhibitor.\nDiet: Continue low sodium. Patient reports improved energy.\nFollow up in 2 weeks.',
        medications: [
            { name: 'Lisinopril', dosage: '20', unit: 'mg', frequency: 'once daily', instructions: 'Increased from 10mg' },
            { name: 'Calcium Carbonate', dosage: '500', unit: 'mg', frequency: 'three times daily', instructions: 'Take with meals' },
            { name: 'Sodium Bicarbonate', dosage: '650', unit: 'mg', frequency: 'twice daily', instructions: 'Continue for acidosis' },
            { name: 'Furosemide', dosage: '20', unit: 'mg', frequency: 'once daily', instructions: 'New - for fluid management' },
        ]
    },
    // Visit 3
    {
        date: VISIT_DATES[2],
        notes: 'Labs continuing to improve. Blood pressure well controlled.\nDiet: Continue dietary restrictions. Good compliance.\nAdding EPO for anemia management.',
        medications: [
            { name: 'Lisinopril', dosage: '20', unit: 'mg', frequency: 'once daily', instructions: 'Continue current dose' },
            { name: 'Calcium Carbonate', dosage: '500', unit: 'mg', frequency: 'three times daily', instructions: 'Take with meals' },
            { name: 'Furosemide', dosage: '20', unit: 'mg', frequency: 'once daily', instructions: 'Continue for fluid management' },
            { name: 'Epoetin Alfa', dosage: '4000', unit: 'units', frequency: 'weekly', instructions: 'New - for CKD anemia' },
            { name: 'Iron Sucrose', dosage: '200', unit: 'mg', frequency: 'weekly', instructions: 'New - iron supplementation' },
        ]
    },
];

// Case details
const CASE_DETAILS = {
    primary_condition: 'Chronic Kidney Disease Stage 3b',
    latest_complaint: 'Mild fatigue, improved from last visit. No edema. Good appetite.',
    medical_history: [
        'Hypertension (10 years)',
        'Type 2 Diabetes Mellitus (8 years)',
        'CKD Stage 3b (diagnosed 6 months ago)',
        'Anemia of CKD',
        'Metabolic acidosis',
    ],
};

async function main() {
    console.log('🚀 Starting test data population...\n');

    // Step 1: Find the patient
    console.log(`📋 Looking for patient: ${PATIENT_EMAIL}`);
    const { data: patient, error: patientError } = await supabase
        .from('users')
        .select('*')
        .eq('email', PATIENT_EMAIL)
        .single();

    if (patientError || !patient) {
        console.error('❌ Patient not found:', patientError?.message || 'No patient with this email');
        process.exit(1);
    }

    console.log(`✅ Found patient: ${patient.name} (ID: ${patient.id})\n`);
    const patientId = patient.id;

    // Step 2: Update patient CKD fields
    console.log('📝 Updating patient CKD profile...');
    const { error: updateError } = await supabase
        .from('users')
        .update({
            condition: 'Chronic Kidney Disease Stage 3b',
            ckd_stage: '3b',
            comorbidities: ['Hypertension', 'Type 2 Diabetes Mellitus', 'Anemia of CKD'],
            age: 58,
            baseline_weight: 72,
            daily_fluid_target: 1500,
        })
        .eq('id', patientId);

    if (updateError) {
        console.error('⚠️ Warning updating patient profile:', updateError.message);
    } else {
        console.log('✅ Patient profile updated\n');
    }

    // Step 3: Delete existing test data (to avoid duplicates)
    console.log('🧹 Cleaning up existing data...');
    await supabase.from('lab_results').delete().eq('patient_id', patientId);
    await supabase.from('prescriptions').delete().eq('patient_id', patientId);
    await supabase.from('patient_case_details').delete().eq('patient_id', patientId);
    console.log('✅ Cleanup complete\n');

    // Step 4: Insert lab results
    console.log('🧪 Inserting lab results...');
    for (const visitLabs of LAB_RESULTS) {
        for (const lab of visitLabs.labs) {
            const { error } = await supabase.from('lab_results').insert({
                patient_id: patientId,
                test_type: lab.test_type as any,
                value: lab.value,
                unit: lab.unit,
                status: lab.status as any,
                reference_range_min: lab.reference_range_min,
                reference_range_max: lab.reference_range_max,
                test_date: visitLabs.date,
                lab_name: 'City Medical Lab',
            });

            if (error) {
                console.error(`  ⚠️ Error inserting ${lab.test_type}:`, error.message);
            }
        }
        console.log(`  ✅ Lab results for ${visitLabs.date} inserted`);
    }
    console.log('');

    // Step 5: Find a doctor for prescriptions
    const { data: doctors } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'doctor')
        .limit(1);

    const doctorId = doctors?.[0]?.id || patientId; // Fallback to patient ID if no doctor
    const doctorName = doctors?.[0]?.name || 'Dr. Nephrologist';
    console.log(`👨‍⚕️ Using doctor: ${doctorName}\n`);

    // Step 6: Insert prescriptions
    console.log('💊 Inserting prescriptions...');
    for (const rx of PRESCRIPTIONS) {
        const { error } = await supabase.from('prescriptions').insert({
            patient_id: patientId,
            doctor_id: doctorId,
            medications: rx.medications,
            notes: rx.notes,
            status: 'active',
            created_at: new Date(rx.date + 'T10:00:00').toISOString(),
        });

        if (error) {
            console.error(`  ⚠️ Error inserting prescription for ${rx.date}:`, error.message);
        } else {
            console.log(`  ✅ Prescription for ${rx.date} inserted (${rx.medications.length} meds)`);
        }
    }
    console.log('');

    // Step 7: Insert case details
    console.log('📋 Inserting case details...');
    const { error: caseError } = await supabase.from('patient_case_details').upsert({
        patient_id: patientId,
        primary_condition: CASE_DETAILS.primary_condition,
        latest_complaint: CASE_DETAILS.latest_complaint,
        complaint_date: VISIT_DATES[2],
        medical_history: CASE_DETAILS.medical_history,
    }, { onConflict: 'patient_id' });

    if (caseError) {
        console.error('⚠️ Error inserting case details:', caseError.message);
    } else {
        console.log('✅ Case details inserted\n');
    }

    // Step 8: Insert vitals for latest visit
    console.log('❤️ Inserting vitals...');
    const { error: vitalsError } = await supabase.from('vitals').insert({
        patient_id: patientId,
        blood_pressure_value: '128/82',
        blood_pressure_unit: 'mmHg',
        blood_pressure_trend: 'down',
        heart_rate_value: '76',
        heart_rate_unit: 'bpm',
        heart_rate_trend: 'stable',
        temperature_value: '98.4',
        temperature_unit: '°F',
        temperature_trend: 'stable',
        weight_value: 71.5,
        weight_unit: 'kg',
        spo2_value: '97',
        spo2_unit: '%',
        recorded_at: new Date(VISIT_DATES[2] + 'T10:00:00').toISOString(),
    });

    if (vitalsError) {
        console.error('⚠️ Error inserting vitals:', vitalsError.message);
    } else {
        console.log('✅ Vitals inserted\n');
    }

    console.log('🎉 Test data population complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Patient: ${patient.name} (${PATIENT_EMAIL})`);
    console.log(`   - CKD Stage: 3b`);
    console.log(`   - Visits: ${VISIT_DATES.length} (${VISIT_DATES.join(', ')})`);
    console.log(`   - Lab results: ${LAB_RESULTS.reduce((sum, v) => sum + v.labs.length, 0)} total`);
    console.log(`   - Prescriptions: ${PRESCRIPTIONS.length}`);
    console.log('\n✨ You can now view this patient from the doctor portal!');
}

main().catch(console.error);
