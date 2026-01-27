// Preset medications for common conditions
// Users can select from these or add custom medications

export interface PresetMedication {
    name: string;
    category: string;
    defaultDosage: string;
    defaultUnit: string;
    defaultFrequency: 'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'weekly' | 'as_needed';
    defaultTimes?: string[];
    instructions?: string;
}

// ============================================
// KIDNEY DISEASE (CKD) MEDICATIONS
// ============================================
export const CKD_MEDICATIONS: PresetMedication[] = [
    // Phosphate Binders
    { name: 'Calcium Carbonate', category: 'Phosphate Binder', defaultDosage: '500', defaultUnit: 'mg', defaultFrequency: 'three_times_daily', instructions: 'Take with meals' },
    { name: 'Sevelamer (Renvela)', category: 'Phosphate Binder', defaultDosage: '800', defaultUnit: 'mg', defaultFrequency: 'three_times_daily', instructions: 'Take with meals' },
    { name: 'Lanthanum (Fosrenol)', category: 'Phosphate Binder', defaultDosage: '500', defaultUnit: 'mg', defaultFrequency: 'three_times_daily', instructions: 'Chew completely with meals' },

    // Anemia Treatment
    { name: 'Erythropoietin (Epogen)', category: 'Anemia', defaultDosage: '10000', defaultUnit: 'units', defaultFrequency: 'weekly', instructions: 'Subcutaneous injection' },
    { name: 'Darbepoetin (Aranesp)', category: 'Anemia', defaultDosage: '60', defaultUnit: 'mcg', defaultFrequency: 'weekly', instructions: 'Subcutaneous injection' },
    { name: 'Ferrous Sulfate', category: 'Anemia', defaultDosage: '325', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take on empty stomach if tolerated' },
    { name: 'Iron Sucrose (Venofer)', category: 'Anemia', defaultDosage: '200', defaultUnit: 'mg', defaultFrequency: 'weekly', instructions: 'IV infusion' },

    // Metabolic Acidosis
    { name: 'Sodium Bicarbonate', category: 'Alkalizing Agent', defaultDosage: '650', defaultUnit: 'mg', defaultFrequency: 'three_times_daily', defaultTimes: ['08:00', '14:00', '20:00'] },

    // Vitamin D
    { name: 'Calcitriol (Rocaltrol)', category: 'Vitamin D', defaultDosage: '0.25', defaultUnit: 'mcg', defaultFrequency: 'once_daily' },
    { name: 'Cholecalciferol (Vitamin D3)', category: 'Vitamin D', defaultDosage: '1000', defaultUnit: 'units', defaultFrequency: 'once_daily' },

    // Potassium Management
    { name: 'Sodium Polystyrene (Kayexalate)', category: 'Potassium Binder', defaultDosage: '15', defaultUnit: 'g', defaultFrequency: 'once_daily', instructions: 'Mix with water or juice' },
    { name: 'Patiromer (Veltassa)', category: 'Potassium Binder', defaultDosage: '8.4', defaultUnit: 'g', defaultFrequency: 'once_daily', instructions: 'Take with food' },
];

// ============================================
// HYPERTENSION MEDICATIONS
// ============================================
export const HYPERTENSION_MEDICATIONS: PresetMedication[] = [
    // ACE Inhibitors
    { name: 'Lisinopril', category: 'ACE Inhibitor', defaultDosage: '10', defaultUnit: 'mg', defaultFrequency: 'once_daily', defaultTimes: ['08:00'] },
    { name: 'Enalapril', category: 'ACE Inhibitor', defaultDosage: '10', defaultUnit: 'mg', defaultFrequency: 'twice_daily', defaultTimes: ['08:00', '20:00'] },
    { name: 'Ramipril', category: 'ACE Inhibitor', defaultDosage: '5', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // ARBs (Angiotensin Receptor Blockers)
    { name: 'Losartan', category: 'ARB', defaultDosage: '50', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Valsartan', category: 'ARB', defaultDosage: '160', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Telmisartan', category: 'ARB', defaultDosage: '40', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Irbesartan', category: 'ARB', defaultDosage: '150', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // Calcium Channel Blockers
    { name: 'Amlodipine', category: 'Calcium Blocker', defaultDosage: '5', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Nifedipine ER', category: 'Calcium Blocker', defaultDosage: '30', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Diltiazem ER', category: 'Calcium Blocker', defaultDosage: '180', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // Beta Blockers
    { name: 'Metoprolol Succinate', category: 'Beta Blocker', defaultDosage: '50', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Carvedilol', category: 'Beta Blocker', defaultDosage: '12.5', defaultUnit: 'mg', defaultFrequency: 'twice_daily' },
    { name: 'Atenolol', category: 'Beta Blocker', defaultDosage: '50', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // Diuretics
    { name: 'Furosemide (Lasix)', category: 'Loop Diuretic', defaultDosage: '40', defaultUnit: 'mg', defaultFrequency: 'once_daily', defaultTimes: ['08:00'], instructions: 'Take in the morning' },
    { name: 'Hydrochlorothiazide', category: 'Thiazide Diuretic', defaultDosage: '25', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take in the morning' },
    { name: 'Spironolactone', category: 'MRA', defaultDosage: '25', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Eplerenone', category: 'MRA', defaultDosage: '50', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Torsemide', category: 'Loop Diuretic', defaultDosage: '20', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
];

// ============================================
// DIABETES MEDICATIONS
// ============================================
export const DIABETES_MEDICATIONS: PresetMedication[] = [
    // Biguanides
    { name: 'Metformin', category: 'Biguanide', defaultDosage: '500', defaultUnit: 'mg', defaultFrequency: 'twice_daily', defaultTimes: ['08:00', '20:00'], instructions: 'Take with meals' },
    { name: 'Metformin ER', category: 'Biguanide', defaultDosage: '1000', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take with dinner' },

    // SGLT2 Inhibitors (Kidney & Heart Protective)
    { name: 'Empagliflozin (Jardiance)', category: 'SGLT2 Inhibitor', defaultDosage: '10', defaultUnit: 'mg', defaultFrequency: 'once_daily', defaultTimes: ['08:00'] },
    { name: 'Dapagliflozin (Farxiga)', category: 'SGLT2 Inhibitor', defaultDosage: '10', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Canagliflozin (Invokana)', category: 'SGLT2 Inhibitor', defaultDosage: '100', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take before first meal' },

    // GLP-1 Receptor Agonists
    { name: 'Semaglutide (Ozempic)', category: 'GLP-1 Agonist', defaultDosage: '0.5', defaultUnit: 'mg', defaultFrequency: 'weekly', instructions: 'Subcutaneous injection' },
    { name: 'Liraglutide (Victoza)', category: 'GLP-1 Agonist', defaultDosage: '1.2', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Subcutaneous injection' },
    { name: 'Dulaglutide (Trulicity)', category: 'GLP-1 Agonist', defaultDosage: '0.75', defaultUnit: 'mg', defaultFrequency: 'weekly', instructions: 'Subcutaneous injection' },

    // DPP-4 Inhibitors
    { name: 'Sitagliptin (Januvia)', category: 'DPP-4 Inhibitor', defaultDosage: '100', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Linagliptin (Tradjenta)', category: 'DPP-4 Inhibitor', defaultDosage: '5', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // Sulfonylureas
    { name: 'Glipizide', category: 'Sulfonylurea', defaultDosage: '5', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take 30 min before breakfast' },
    { name: 'Glimepiride', category: 'Sulfonylurea', defaultDosage: '2', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take with breakfast' },

    // Insulin
    { name: 'Insulin Glargine (Lantus)', category: 'Long-Acting Insulin', defaultDosage: '10', defaultUnit: 'units', defaultFrequency: 'once_daily', defaultTimes: ['22:00'], instructions: 'Subcutaneous injection at bedtime' },
    { name: 'Insulin Lispro (Humalog)', category: 'Rapid-Acting Insulin', defaultDosage: '5', defaultUnit: 'units', defaultFrequency: 'three_times_daily', instructions: 'Take before meals' },
    { name: 'Insulin Aspart (Novolog)', category: 'Rapid-Acting Insulin', defaultDosage: '5', defaultUnit: 'units', defaultFrequency: 'three_times_daily', instructions: 'Take before meals' },
];

// ============================================
// CARDIOVASCULAR MEDICATIONS
// ============================================
export const CARDIOVASCULAR_MEDICATIONS: PresetMedication[] = [
    // Statins
    { name: 'Atorvastatin (Lipitor)', category: 'Statin', defaultDosage: '20', defaultUnit: 'mg', defaultFrequency: 'once_daily', defaultTimes: ['22:00'], instructions: 'Take at bedtime' },
    { name: 'Rosuvastatin (Crestor)', category: 'Statin', defaultDosage: '10', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Simvastatin', category: 'Statin', defaultDosage: '20', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take at bedtime' },
    { name: 'Pravastatin', category: 'Statin', defaultDosage: '40', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // Antiplatelet
    { name: 'Aspirin (Low-Dose)', category: 'Antiplatelet', defaultDosage: '81', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Clopidogrel (Plavix)', category: 'Antiplatelet', defaultDosage: '75', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // Anticoagulants
    { name: 'Warfarin (Coumadin)', category: 'Anticoagulant', defaultDosage: '5', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Monitor INR regularly' },
    { name: 'Apixaban (Eliquis)', category: 'Anticoagulant', defaultDosage: '5', defaultUnit: 'mg', defaultFrequency: 'twice_daily' },
    { name: 'Rivaroxaban (Xarelto)', category: 'Anticoagulant', defaultDosage: '20', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take with food' },

    // Heart Failure
    { name: 'Sacubitril/Valsartan (Entresto)', category: 'Heart Failure', defaultDosage: '49/51', defaultUnit: 'mg', defaultFrequency: 'twice_daily' },
    { name: 'Digoxin', category: 'Cardiac Glycoside', defaultDosage: '0.125', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
];

// ============================================
// COMMON SUPPLEMENTS & OTHER
// ============================================
export const OTHER_MEDICATIONS: PresetMedication[] = [
    // Supplements
    { name: 'Folic Acid', category: 'Supplement', defaultDosage: '1', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Vitamin B12', category: 'Supplement', defaultDosage: '1000', defaultUnit: 'mcg', defaultFrequency: 'once_daily' },
    { name: 'Omega-3 Fish Oil', category: 'Supplement', defaultDosage: '1000', defaultUnit: 'mg', defaultFrequency: 'once_daily' },

    // GI Protection
    { name: 'Omeprazole (Prilosec)', category: 'PPI', defaultDosage: '20', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take before breakfast' },
    { name: 'Pantoprazole (Protonix)', category: 'PPI', defaultDosage: '40', defaultUnit: 'mg', defaultFrequency: 'once_daily', instructions: 'Take before breakfast' },

    // Pain (Kidney-Safe)
    { name: 'Acetaminophen (Tylenol)', category: 'Pain Relief', defaultDosage: '500', defaultUnit: 'mg', defaultFrequency: 'as_needed', instructions: 'Do not exceed 3000mg/day' },

    // Gout (common in CKD)
    { name: 'Allopurinol', category: 'Gout', defaultDosage: '100', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
    { name: 'Febuxostat (Uloric)', category: 'Gout', defaultDosage: '40', defaultUnit: 'mg', defaultFrequency: 'once_daily' },
];

// ============================================
// ALL PRESET MEDICATIONS (Combined)
// ============================================
export const ALL_PRESET_MEDICATIONS: PresetMedication[] = [
    ...CKD_MEDICATIONS,
    ...HYPERTENSION_MEDICATIONS,
    ...DIABETES_MEDICATIONS,
    ...CARDIOVASCULAR_MEDICATIONS,
    ...OTHER_MEDICATIONS,
];

// Group medications by category for easy browsing
export const MEDICATION_CATEGORIES = [
    { id: 'ckd', label: 'Kidney Disease (CKD)', medications: CKD_MEDICATIONS },
    { id: 'hypertension', label: 'Blood Pressure', medications: HYPERTENSION_MEDICATIONS },
    { id: 'diabetes', label: 'Diabetes', medications: DIABETES_MEDICATIONS },
    { id: 'cardiovascular', label: 'Heart & Cholesterol', medications: CARDIOVASCULAR_MEDICATIONS },
    { id: 'other', label: 'Other & Supplements', medications: OTHER_MEDICATIONS },
];

// ============================================
// FREQUENCY & UNIT OPTIONS
// ============================================
export const MEDICATION_FREQUENCIES = [
    { value: 'once_daily', label: 'Once daily', timesPerDay: 1, defaultTimes: ['08:00'] },
    { value: 'twice_daily', label: 'Twice daily', timesPerDay: 2, defaultTimes: ['08:00', '20:00'] },
    { value: 'three_times_daily', label: 'Three times daily', timesPerDay: 3, defaultTimes: ['08:00', '14:00', '20:00'] },
    { value: 'four_times_daily', label: 'Four times daily', timesPerDay: 4, defaultTimes: ['08:00', '12:00', '18:00', '22:00'] },
    { value: 'every_other_day', label: 'Every other day', timesPerDay: 0.5, defaultTimes: ['08:00'] },
    { value: 'weekly', label: 'Weekly', timesPerDay: 0.14, defaultTimes: ['08:00'] },
    { value: 'as_needed', label: 'As needed (PRN)', timesPerDay: 0, defaultTimes: [] },
] as const;

export const DOSAGE_UNITS = [
    { value: 'mg', label: 'mg (milligrams)' },
    { value: 'mcg', label: 'mcg (micrograms)' },
    { value: 'g', label: 'g (grams)' },
    { value: 'ml', label: 'ml (milliliters)' },
    { value: 'units', label: 'units' },
    { value: 'tablets', label: 'tablet(s)' },
    { value: 'capsules', label: 'capsule(s)' },
    { value: 'puffs', label: 'puff(s)' },
    { value: 'drops', label: 'drop(s)' },
] as const;

// Helper function to get default times for a frequency
export const getDefaultTimesForFrequency = (frequency: string): string[] => {
    const freq = MEDICATION_FREQUENCIES.find(f => f.value === frequency);
    return freq?.defaultTimes || ['08:00'];
};

// Helper function to search medications
export const searchMedications = (query: string): PresetMedication[] => {
    const lowerQuery = query.toLowerCase();
    return ALL_PRESET_MEDICATIONS.filter(med =>
        med.name.toLowerCase().includes(lowerQuery) ||
        med.category.toLowerCase().includes(lowerQuery)
    );
};
