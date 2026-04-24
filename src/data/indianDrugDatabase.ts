/**
 * BeanHealth Indian Drug Reference Database
 *
 * Curated brand → generic mapping for Indian pharma brands.
 * Cross-referenced: CDSCO/NPPA · Jan Aushadhi · CIMS India · MIMS India
 * ATC codes: WHO ATC Classification 2024.
 * Categories follow NRCeS ABDM IG clinical classification.
 *
 * HOW TO EXTEND:
 *   1. Add entries here for known brands.
 *   2. Unknown brands encountered in production → drug_review_queue table.
 *   3. After curation approval → promote to this file + reference_drugs table.
 */

export interface RefDrugEntry {
    brand_name: string;            // normalised UPPER_CASE key (used for slug matching)
    display_name: string;          // pretty display
    generic_name: string;          // primary active moiety
    components: string[];          // full ingredient list (for combinations)
    category: string;              // drug class label
    atc_code?: string;             // WHO ATC code of primary ingredient
    cdsco_schedule?: string;       // H / H1 / X / OTC
    jan_aushadhi?: boolean;
    rxnorm_ingredients?: string[]; // RxNorm ingredient names
    indications?: string[];
    renal_precaution?: boolean;    // flag for CKD patients
}

/* ─── Combination drug expansion table ─────────────────────────────────── */

/**
 * Maps a normalised brand slug → ordered ingredient list.
 * When a prescription string like "Telma-AM 40/5" is parsed,
 * the ratio "40/5" is split and assigned positionally to the
 * ingredients in this table.
 *
 * ingredient shape: { name, category, atcCode }
 */
export interface ComboIngredient {
    name: string;
    category: string;
    atc_code: string;
}

export interface ComboDrugEntry {
    /** Slug patterns to match (all uppercased, spaces→underscore) */
    slugs: string[];
    display_name: string;
    ingredients: ComboIngredient[];
}

export const COMBO_DRUG_TABLE: ComboDrugEntry[] = [
    {
        slugs: ['TELMA_AM', 'TELMIKIND_AM', 'TELSAR_AM', 'TELISTA_AM', 'TELMISAT_AM', 'TELZAP_AM'],
        display_name: 'Telmisartan + Amlodipine',
        ingredients: [
            { name: 'Telmisartan', category: 'ARB', atc_code: 'C09CA07' },
            { name: 'Amlodipine', category: 'CCB', atc_code: 'C08CA01' },
        ],
    },
    {
        slugs: ['TELMA_H', 'TELMIKIND_H', 'TELSAR_H', 'TELISTA_H'],
        display_name: 'Telmisartan + HCTZ',
        ingredients: [
            { name: 'Telmisartan', category: 'ARB', atc_code: 'C09CA07' },
            { name: 'Hydrochlorothiazide', category: 'DIURETICS', atc_code: 'C03AA03' },
        ],
    },
    {
        slugs: ['LOSARTAN_H', 'LOSAR_H', 'LOSACAR_H', 'REPACE_H', 'LOSIUM_H'],
        display_name: 'Losartan + HCTZ',
        ingredients: [
            { name: 'Losartan Potassium', category: 'ARB', atc_code: 'C09CA01' },
            { name: 'Hydrochlorothiazide', category: 'DIURETICS', atc_code: 'C03AA03' },
        ],
    },
    {
        slugs: ['OLMY_H', 'OLMIGHTY_H', 'OLMEZEST_H', 'OLSAR_H'],
        display_name: 'Olmesartan + HCTZ',
        ingredients: [
            { name: 'Olmesartan Medoxomil', category: 'ARB', atc_code: 'C09CA08' },
            { name: 'Hydrochlorothiazide', category: 'DIURETICS', atc_code: 'C03AA03' },
        ],
    },
    {
        slugs: ['OLMY_AM', 'OLMIGHTY_AM', 'OLMEZEST_AM'],
        display_name: 'Olmesartan + Amlodipine',
        ingredients: [
            { name: 'Olmesartan Medoxomil', category: 'ARB', atc_code: 'C09CA08' },
            { name: 'Amlodipine', category: 'CCB', atc_code: 'C08CA01' },
        ],
    },
    {
        slugs: ['CARDACE_H', 'RAMIPRIL_H'],
        display_name: 'Ramipril + HCTZ',
        ingredients: [
            { name: 'Ramipril', category: 'ACE INHIBITOR', atc_code: 'C09AA05' },
            { name: 'Hydrochlorothiazide', category: 'DIURETICS', atc_code: 'C03AA03' },
        ],
    },
    {
        slugs: ['AMLONG_AT', 'AMLOPIN_AT', 'AMLIP_AT', 'AMCARD_AT'],
        display_name: 'Amlodipine + Atenolol',
        ingredients: [
            { name: 'Amlodipine', category: 'CCB', atc_code: 'C08CA01' },
            { name: 'Atenolol', category: 'BETA BLOCKER', atc_code: 'C07AB03' },
        ],
    },
    {
        slugs: ['STORVAS_CV', 'ATORVA_CV', 'LIPITOR_CV', 'ATORLIP_CV'],
        display_name: 'Atorvastatin + Clopidogrel',
        ingredients: [
            { name: 'Atorvastatin', category: 'STATIN', atc_code: 'C10AA05' },
            { name: 'Clopidogrel', category: 'ANTIPLATELET', atc_code: 'B01AC04' },
        ],
    },
    {
        slugs: ['GLIZID_M', 'DIAMICRON_M', 'GLICLAZIDE_M'],
        display_name: 'Gliclazide + Metformin',
        ingredients: [
            { name: 'Gliclazide', category: 'ANTI-DIABETIC', atc_code: 'A10BB09' },
            { name: 'Metformin Hydrochloride', category: 'ANTI-DIABETIC', atc_code: 'A10BA02' },
        ],
    },
    {
        slugs: ['GLYCOMET_GP', 'GLUCONORM_G', 'GLIMESTAR_M', 'AMARYL_M', 'GEMER'],
        display_name: 'Glimepiride + Metformin',
        ingredients: [
            { name: 'Glimepiride', category: 'ANTI-DIABETIC', atc_code: 'A10BB12' },
            { name: 'Metformin Hydrochloride', category: 'ANTI-DIABETIC', atc_code: 'A10BA02' },
        ],
    },
    {
        slugs: ['AUGMENTIN', 'CO_AMOXICLAV', 'CLAVAM', 'MOXCLAV', 'AMOXYCLAV'],
        display_name: 'Amoxicillin + Clavulanic Acid',
        ingredients: [
            { name: 'Amoxicillin', category: 'ANTIBIOTIC', atc_code: 'J01CA04' },
            { name: 'Clavulanic Acid', category: 'ANTIBIOTIC', atc_code: 'J01CR02' },
        ],
    },
    {
        slugs: ['LASILACTONE', 'LASIX_SR'],
        display_name: 'Furosemide + Spironolactone',
        ingredients: [
            { name: 'Furosemide', category: 'DIURETICS', atc_code: 'C03CA01' },
            { name: 'Spironolactone', category: 'DIURETICS', atc_code: 'C03DA01' },
        ],
    },
    {
        slugs: ['COVERSYL_AM', 'COVERSYL_PLUS', 'COVERAM'],
        display_name: 'Perindopril + Amlodipine',
        ingredients: [
            { name: 'Perindopril Erbumine', category: 'ACE INHIBITOR', atc_code: 'C09AA04' },
            { name: 'Amlodipine', category: 'CCB', atc_code: 'C08CA01' },
        ],
    },
    {
        slugs: ['CLOPILET_A', 'DEPLATT_A', 'CLAVIX_GOLD', 'CLOPIODE_A', 'ECOSPRIN_GOLD'],
        display_name: 'Clopidogrel + Aspirin',
        ingredients: [
            { name: 'Clopidogrel Bisulphate', category: 'ANTIPLATELET', atc_code: 'B01AC04' },
            { name: 'Aspirin', category: 'ANTIPLATELET', atc_code: 'B01AC06' },
        ],
    },
    {
        slugs: ['ECOSPRIN_AV', 'ATORVA_AV', 'LIPICURE_AV'],
        display_name: 'Aspirin + Atorvastatin',
        ingredients: [
            { name: 'Aspirin', category: 'ANTIPLATELET', atc_code: 'B01AC06' },
            { name: 'Atorvastatin Calcium', category: 'STATIN', atc_code: 'C10AA05' },
        ],
    },
    {
        slugs: ['BACTRIM_DS', 'SEPTRAN_DS', 'COTRIM_DS'],
        display_name: 'Trimethoprim + Sulfamethoxazole',
        ingredients: [
            { name: 'Trimethoprim', category: 'ANTIBIOTIC', atc_code: 'J01EA01' },
            { name: 'Sulfamethoxazole', category: 'ANTIBIOTIC', atc_code: 'J01EC01' },
        ],
    },
    {
        slugs: ['DUTAS_T', 'DUTAGEN_T', 'URIMAX_D'],
        display_name: 'Dutasteride + Tamsulosin',
        ingredients: [
            { name: 'Dutasteride', category: 'ALPHA REDUCTASE INHIBITOR', atc_code: 'G04CB02' },
            { name: 'Tamsulosin Hydrochloride', category: 'ALPHA BLOCKER', atc_code: 'G04CA02' },
        ],
    },
    {
        slugs: ['AUXIPRESS_PLUS', 'TELMA_AM_H'],
        display_name: 'Telmisartan + Amlodipine + HCTZ',
        ingredients: [
            { name: 'Telmisartan', category: 'ARB', atc_code: 'C09CA07' },
            { name: 'Amlodipine', category: 'CCB', atc_code: 'C08CA01' },
            { name: 'Hydrochlorothiazide', category: 'DIURETICS', atc_code: 'C03AA03' },
        ],
    },
    {
        slugs: ['NVPANON_D', 'PANTOP_D', 'PAN_D', 'PANTODAC_D', 'PANMAC_D'],
        display_name: 'Pantoprazole + Domperidone',
        ingredients: [
            { name: 'Pantoprazole Sodium', category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC02' },
            { name: 'Domperidone', category: 'ANTIEMETIC', atc_code: 'A03FA03' },
        ],
    },
    {
        slugs: ['ISTAMET', 'ISTAMET_50_500', 'JANUMET', 'SITAGMET', 'SITAMET'],
        display_name: 'Sitagliptin + Metformin',
        ingredients: [
            { name: 'Sitagliptin Phosphate', category: 'ANTI-DIABETIC', atc_code: 'A10BH01' },
            { name: 'Metformin Hydrochloride', category: 'ANTI-DIABETIC', atc_code: 'A10BA02' },
        ],
    },
    {
        slugs: ['TORSENORM_PLUS', 'DYTOR_PLUS', 'LASIX_ALDACTONE'],
        display_name: 'Torsemide + Spironolactone',
        ingredients: [
            { name: 'Torsemide', category: 'DIURETICS', atc_code: 'C03CA04' },
            { name: 'Spironolactone', category: 'DIURETICS', atc_code: 'C03DA01' },
        ],
    },
    {
        slugs: ['STORVAS_EZ', 'ATORVA_EZ', 'LIPITOR_EZ', 'ATORZET'],
        display_name: 'Atorvastatin + Ezetimibe',
        ingredients: [
            { name: 'Atorvastatin Calcium', category: 'STATIN', atc_code: 'C10AA05' },
            { name: 'Ezetimibe', category: 'LIPID LOWERING', atc_code: 'C10AX09' },
        ],
    },
    {
        slugs: ['ROSUBEAT_CV', 'ROZUCOR_CV', 'ROSUVASTATIN_CV'],
        display_name: 'Rosuvastatin + Clopidogrel',
        ingredients: [
            { name: 'Rosuvastatin Calcium', category: 'STATIN', atc_code: 'C10AA07' },
            { name: 'Clopidogrel Bisulphate', category: 'ANTIPLATELET', atc_code: 'B01AC04' },
        ],
    },
    {
        slugs: ['RAPILIF_D', 'SILODOSIN_D', 'SILODAL_D'],
        display_name: 'Silodosin + Dutasteride',
        ingredients: [
            { name: 'Silodosin', category: 'ALPHA BLOCKER', atc_code: 'G04CA04' },
            { name: 'Dutasteride', category: 'ALPHA REDUCTASE INHIBITOR', atc_code: 'G04CB02' },
        ],
    },
    {
        slugs: ['RAPILIF_M', 'SILODOSIN_M'],
        display_name: 'Silodosin + Mirabegron',
        ingredients: [
            { name: 'Silodosin', category: 'ALPHA BLOCKER', atc_code: 'G04CA04' },
            { name: 'Mirabegron', category: 'BETA-3 AGONIST', atc_code: 'G04BD12' },
        ],
    },
    {
        slugs: ['MONTAIR_LC', 'MONTELUKAST_L', 'TELEKAST_L', 'LEVOCET_M'],
        display_name: 'Montelukast + Levocetirizine',
        ingredients: [
            { name: 'Montelukast Sodium', category: 'LEUKOTRIENE ANTAGONIST', atc_code: 'R03DC03' },
            { name: 'Levocetirizine Hydrochloride', category: 'ANTIHISTAMINE', atc_code: 'R06AE09' },
        ],
    },
    {
        slugs: ['VEINTREE', 'VEINTREE_NT', 'DAFLON', 'DIOSMIN_H'],
        display_name: 'Diosmin + Hesperidin',
        ingredients: [
            { name: 'Diosmin', category: 'VENOTONIC', atc_code: 'C05CA03' },
            { name: 'Hesperidin', category: 'VENOTONIC', atc_code: 'C05CA05' },
        ],
    },
    {
        slugs: ['FERRILIP', 'FERROBIS_FA', 'FERIRON_FA'],
        display_name: 'Ferrous Bisglycinate + Folic Acid',
        ingredients: [
            { name: 'Ferrous Bisglycinate', category: 'HAEMATOLOGICALS', atc_code: 'B03AA' },
            { name: 'Folic Acid', category: 'VITAMINS & MINERALS', atc_code: 'B03BB01' },
        ],
    },
    {
        slugs: ['SEROFLOW', 'SEROFLO', 'FLIXOTIDE_S', 'ADVAIR'],
        display_name: 'Fluticasone + Salmeterol',
        ingredients: [
            { name: 'Fluticasone Propionate', category: 'CORTICOSTEROID INHALER', atc_code: 'R03BA05' },
            { name: 'Salmeterol Xinafoate', category: 'LABA', atc_code: 'R03AC12' },
        ],
    },
    {
        slugs: ['JOINTACE_DN', 'GLUCOSAMINE_DN'],
        display_name: 'Diacerein + Glucosamine',
        ingredients: [
            { name: 'Diacerein', category: 'SYMPTOMATIC SLOW-ACTING DRUG', atc_code: 'M01AX21' },
            { name: 'Glucosamine Sulphate', category: 'SYMPTOMATIC SLOW-ACTING DRUG', atc_code: 'M01AX05' },
        ],
    },
    {
        slugs: ['RHYZODEG', 'RYZODEG'],
        display_name: 'Insulin Degludec + Insulin Aspart',
        ingredients: [
            { name: 'Insulin Degludec', category: 'INSULIN', atc_code: 'A10AE06' },
            { name: 'Insulin Aspart', category: 'INSULIN', atc_code: 'A10AB05' },
        ],
    },
    {
        slugs: ['SOMPRAZ_D', 'NEXPRO_D', 'ESOMAC_D', 'RACIPER_D'],
        display_name: 'Esomeprazole + Domperidone',
        ingredients: [
            { name: 'Esomeprazole Magnesium', category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC05' },
            { name: 'Domperidone', category: 'ANTIEMETIC', atc_code: 'A03FA03' },
        ],
    },
    {
        slugs: ['ULTRACET', 'ULTRACET_ER', 'TRAMACET', 'DOLOPAR'],
        display_name: 'Tramadol + Paracetamol',
        ingredients: [
            { name: 'Tramadol Hydrochloride', category: 'OPIOID ANALGESIC', atc_code: 'N02AX02' },
            { name: 'Paracetamol', category: 'ANALGESICS', atc_code: 'N02BE01' },
        ],
    },
    {
        slugs: ['SYNDOPA', 'SYNDOPA_PLUS', 'SINEMET', 'TIDOMET'],
        display_name: 'Levodopa + Carbidopa',
        ingredients: [
            { name: 'Levodopa', category: 'ANTI-PARKINSON', atc_code: 'N04BA01' },
            { name: 'Carbidopa', category: 'ANTI-PARKINSON', atc_code: 'N04BA02' },
        ],
    },
    {
        slugs: ['TENEPRIDE_M', 'TENELI_M', 'TENELIGLIPTIN_M'],
        display_name: 'Teneligliptin + Metformin',
        ingredients: [
            { name: 'Teneligliptin Hydrobromide', category: 'ANTI-DIABETIC', atc_code: 'A10BH08' },
            { name: 'Metformin Hydrochloride', category: 'ANTI-DIABETIC', atc_code: 'A10BA02' },
        ],
    },
    {
        slugs: ['MIRBEG_S', 'MIRABEGRON_S', 'BETMIGA_S'],
        display_name: 'Mirabegron + Solifenacin',
        ingredients: [
            { name: 'Mirabegron', category: 'BETA-3 AGONIST', atc_code: 'G04BD12' },
            { name: 'Solifenacin Succinate', category: 'ANTICHOLINERGIC', atc_code: 'G04BD08' },
        ],
    },
    {
        slugs: ['FARORIGHT_CV', 'FAROPENEM_CV'],
        display_name: 'Faropenem + Clavulanic Acid',
        ingredients: [
            { name: 'Faropenem Sodium', category: 'ANTIBIOTIC', atc_code: 'J01DI01' },
            { name: 'Clavulanic Acid', category: 'ANTIBIOTIC', atc_code: 'J01CR02' },
        ],
    },
];

/* ─── Main drug database ────────────────────────────────────────────────── */

export const INDIAN_DRUG_DATABASE: RefDrugEntry[] = [

    /* ── CKD / Nephrology ─────────────────────────────────────────────── */

    { brand_name: 'TORSENORM', display_name: 'Torsenorm', generic_name: 'Torsemide', components: ['Torsemide'], category: 'DIURETICS', atc_code: 'C03CA04', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['torsemide'], indications: ['Oedema', 'Hypertension', 'CKD fluid overload'], renal_precaution: false },
    { brand_name: 'DYTOR', display_name: 'Dytor', generic_name: 'Torsemide', components: ['Torsemide'], category: 'DIURETICS', atc_code: 'C03CA04', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['torsemide'], renal_precaution: false },
    { brand_name: 'LASIX', display_name: 'Lasix', generic_name: 'Furosemide', components: ['Furosemide'], category: 'DIURETICS', atc_code: 'C03CA01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['furosemide'], indications: ['Oedema', 'Acute pulmonary oedema', 'CKD fluid management'], renal_precaution: false },
    { brand_name: 'ALDACTONE', display_name: 'Aldactone', generic_name: 'Spironolactone', components: ['Spironolactone'], category: 'DIURETICS', atc_code: 'C03DA01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['spironolactone'], indications: ['Ascites', 'Hyperaldosteronism', 'Heart failure'], renal_precaution: true },
    { brand_name: 'SEVELAMER', display_name: 'Sevelamer', generic_name: 'Sevelamer Carbonate', components: ['Sevelamer Carbonate'], category: 'PHOSPHATE BINDER', atc_code: 'V03AE02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['sevelamer carbonate'], indications: ['Hyperphosphataemia in CKD', 'Dialysis'], renal_precaution: false },
    { brand_name: 'PHOSLYRA', display_name: 'Phoslyra', generic_name: 'Calcium Acetate', components: ['Calcium Acetate'], category: 'PHOSPHATE BINDER', atc_code: 'V03AE07', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['calcium acetate'], indications: ['Hyperphosphataemia in CKD'], renal_precaution: false },
    { brand_name: 'RENODAPT', display_name: 'Renodapt', generic_name: 'Mycophenolate Mofetil', components: ['Mycophenolate Mofetil'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AA06', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['mycophenolate mofetil'], indications: ['Renal transplant rejection prophylaxis', 'IgA nephropathy'], renal_precaution: true },
    { brand_name: 'TACROLIMUS', display_name: 'Tacrolimus', generic_name: 'Tacrolimus', components: ['Tacrolimus'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AD02', cdsco_schedule: 'H1', jan_aushadhi: false, rxnorm_ingredients: ['tacrolimus'], indications: ['Renal transplant', 'Nephrotic syndrome'], renal_precaution: true },
    { brand_name: 'PROGRAF', display_name: 'Prograf', generic_name: 'Tacrolimus', components: ['Tacrolimus'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AD02', cdsco_schedule: 'H1', jan_aushadhi: false, rxnorm_ingredients: ['tacrolimus'], renal_precaution: true },
    { brand_name: 'CYCLOPHOSPHAMIDE', display_name: 'Cyclophosphamide', generic_name: 'Cyclophosphamide', components: ['Cyclophosphamide'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L01AA01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['cyclophosphamide'], indications: ['Lupus nephritis', 'Vasculitis', 'Membranous nephropathy'], renal_precaution: true },
    { brand_name: 'ERYTOP', display_name: 'Erytop', generic_name: 'Erythropoietin Alfa', components: ['Erythropoietin Alfa'], category: 'HAEMATOLOGICALS', atc_code: 'B03XA01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['epoetin alfa'], indications: ['CKD anaemia', 'Pre-dialysis anaemia'], renal_precaution: false },
    { brand_name: 'EPREX', display_name: 'Eprex', generic_name: 'Epoetin Alfa', components: ['Epoetin Alfa'], category: 'HAEMATOLOGICALS', atc_code: 'B03XA01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['epoetin alfa'], indications: ['CKD anaemia'], renal_precaution: false },
    { brand_name: 'FERONIA', display_name: 'Feronia', generic_name: 'Iron Sucrose', components: ['Iron Sucrose'], category: 'HAEMATOLOGICALS', atc_code: 'B03AC', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['iron sucrose'], indications: ['Iron deficiency anaemia in CKD', 'IV iron replacement'], renal_precaution: false },
    { brand_name: 'MONOFER', display_name: 'Monofer', generic_name: 'Iron Isomaltoside', components: ['Iron Isomaltoside'], category: 'HAEMATOLOGICALS', atc_code: 'B03AC', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['iron isomaltoside'], renal_precaution: false },
    { brand_name: 'ACICARB', display_name: 'Acicarb', generic_name: 'Sodium Bicarbonate', components: ['Sodium Bicarbonate'], category: 'ELECTROLYTES & ALKALI', atc_code: 'B05XA02', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['sodium bicarbonate'], indications: ['CKD metabolic acidosis', 'Acid-base correction'], renal_precaution: false },
    { brand_name: 'RENAL_D3', display_name: 'Renal D3', generic_name: 'Cholecalciferol', components: ['Cholecalciferol (Vitamin D3)'], category: 'VITAMINS & MINERALS', atc_code: 'A11CC05', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['cholecalciferol'], indications: ['Vitamin D deficiency', 'CKD bone disease', 'Renal osteodystrophy'], renal_precaution: false },
    { brand_name: 'CALCITRIOL', display_name: 'Calcitriol', generic_name: 'Calcitriol', components: ['Calcitriol'], category: 'VITAMINS & MINERALS', atc_code: 'A11CC04', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['calcitriol'], indications: ['Secondary hyperparathyroidism', 'Renal osteodystrophy', 'CKD-MBD'], renal_precaution: false },
    { brand_name: 'ROCALTROL', display_name: 'Rocaltrol', generic_name: 'Calcitriol', components: ['Calcitriol'], category: 'VITAMINS & MINERALS', atc_code: 'A11CC04', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['calcitriol'], renal_precaution: false },

    /* ── ACE Inhibitors ───────────────────────────────────────────────── */

    { brand_name: 'CARDACE', display_name: 'Cardace', generic_name: 'Ramipril', components: ['Ramipril'], category: 'ACE INHIBITOR', atc_code: 'C09AA05', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['ramipril'], indications: ['Hypertension', 'CKD proteinuria reduction', 'Heart failure'], renal_precaution: true },
    { brand_name: 'ENVAS', display_name: 'Envas', generic_name: 'Enalapril', components: ['Enalapril'], category: 'ACE INHIBITOR', atc_code: 'C09AA02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['enalapril'], renal_precaution: true },
    { brand_name: 'LISINOPRIL', display_name: 'Lisinopril', generic_name: 'Lisinopril', components: ['Lisinopril'], category: 'ACE INHIBITOR', atc_code: 'C09AA03', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['lisinopril'], renal_precaution: true },
    { brand_name: 'ZESTRIL', display_name: 'Zestril', generic_name: 'Lisinopril', components: ['Lisinopril'], category: 'ACE INHIBITOR', atc_code: 'C09AA03', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['lisinopril'], renal_precaution: true },
    { brand_name: 'PERINDOPRIL', display_name: 'Perindopril', generic_name: 'Perindopril', components: ['Perindopril Erbumine'], category: 'ACE INHIBITOR', atc_code: 'C09AA04', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['perindopril'], renal_precaution: true },

    /* ── ARBs ─────────────────────────────────────────────────────────── */

    { brand_name: 'LOSARTAN', display_name: 'Losartan', generic_name: 'Losartan Potassium', components: ['Losartan Potassium'], category: 'ARB', atc_code: 'C09CA01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['losartan potassium'], indications: ['Hypertension', 'Diabetic nephropathy', 'CKD'], renal_precaution: true },
    { brand_name: 'REPACE', display_name: 'Repace', generic_name: 'Losartan Potassium', components: ['Losartan Potassium'], category: 'ARB', atc_code: 'C09CA01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['losartan potassium'], renal_precaution: true },
    { brand_name: 'TELMISARTAN', display_name: 'Telmisartan', generic_name: 'Telmisartan', components: ['Telmisartan'], category: 'ARB', atc_code: 'C09CA07', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['telmisartan'], renal_precaution: true },
    { brand_name: 'TELMA', display_name: 'Telma', generic_name: 'Telmisartan', components: ['Telmisartan'], category: 'ARB', atc_code: 'C09CA07', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['telmisartan'], renal_precaution: true },
    { brand_name: 'TELMIKIND', display_name: 'Telmikind', generic_name: 'Telmisartan', components: ['Telmisartan'], category: 'ARB', atc_code: 'C09CA07', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['telmisartan'], renal_precaution: true },
    { brand_name: 'OLMY', display_name: 'Olmy', generic_name: 'Olmesartan', components: ['Olmesartan Medoxomil'], category: 'ARB', atc_code: 'C09CA08', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['olmesartan medoxomil'], renal_precaution: true },
    { brand_name: 'OLMIGHTY', display_name: 'Olmighty', generic_name: 'Olmesartan', components: ['Olmesartan Medoxomil'], category: 'ARB', atc_code: 'C09CA08', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['olmesartan medoxomil'], renal_precaution: true },
    { brand_name: 'VALTAN', display_name: 'Valtan', generic_name: 'Valsartan', components: ['Valsartan'], category: 'ARB', atc_code: 'C09CA03', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['valsartan'], renal_precaution: true },
    { brand_name: 'DIOVAN', display_name: 'Diovan', generic_name: 'Valsartan', components: ['Valsartan'], category: 'ARB', atc_code: 'C09CA03', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['valsartan'], renal_precaution: true },

    /* ── CCBs ─────────────────────────────────────────────────────────── */

    { brand_name: 'AMLIP', display_name: 'Amlip', generic_name: 'Amlodipine Besylate', components: ['Amlodipine Besylate'], category: 'CCB', atc_code: 'C08CA01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['amlodipine besylate'], indications: ['Hypertension', 'Angina'], renal_precaution: false },
    { brand_name: 'AMLONG', display_name: 'Amlong', generic_name: 'Amlodipine', components: ['Amlodipine'], category: 'CCB', atc_code: 'C08CA01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['amlodipine'], renal_precaution: false },
    { brand_name: 'STAMLO', display_name: 'Stamlo', generic_name: 'Amlodipine', components: ['Amlodipine'], category: 'CCB', atc_code: 'C08CA01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['amlodipine'], renal_precaution: false },
    { brand_name: 'NIFEDIPINE', display_name: 'Nifedipine', generic_name: 'Nifedipine', components: ['Nifedipine'], category: 'CCB', atc_code: 'C08CA05', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['nifedipine'], renal_precaution: false },
    { brand_name: 'DILZEM', display_name: 'Dilzem', generic_name: 'Diltiazem', components: ['Diltiazem Hydrochloride'], category: 'CCB', atc_code: 'C08DB01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['diltiazem hydrochloride'], renal_precaution: false },

    /* ── Beta Blockers ────────────────────────────────────────────────── */

    { brand_name: 'ATENOLOL', display_name: 'Atenolol', generic_name: 'Atenolol', components: ['Atenolol'], category: 'BETA BLOCKER', atc_code: 'C07AB03', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['atenolol'], renal_precaution: true },
    { brand_name: 'METOPROLOL', display_name: 'Metoprolol', generic_name: 'Metoprolol Succinate', components: ['Metoprolol Succinate'], category: 'BETA BLOCKER', atc_code: 'C07AB02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['metoprolol succinate'], renal_precaution: false },
    { brand_name: 'BETALOC', display_name: 'Betaloc', generic_name: 'Metoprolol Succinate', components: ['Metoprolol Succinate'], category: 'BETA BLOCKER', atc_code: 'C07AB02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['metoprolol succinate'], renal_precaution: false },
    { brand_name: 'CARVEDILOL', display_name: 'Carvedilol', generic_name: 'Carvedilol', components: ['Carvedilol'], category: 'BETA BLOCKER', atc_code: 'C07AG02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['carvedilol'], indications: ['Hypertension', 'Heart failure', 'CKD with hypertension'], renal_precaution: false },
    { brand_name: 'CARCA', display_name: 'Carca', generic_name: 'Carvedilol', components: ['Carvedilol'], category: 'BETA BLOCKER', atc_code: 'C07AG02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['carvedilol'], renal_precaution: false },

    /* ── Anti-diabetics ───────────────────────────────────────────────── */

    { brand_name: 'GLYCOMET', display_name: 'Glycomet', generic_name: 'Metformin Hydrochloride', components: ['Metformin Hydrochloride'], category: 'ANTI-DIABETIC', atc_code: 'A10BA02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['metformin hydrochloride'], indications: ['Type 2 DM'], renal_precaution: true },
    { brand_name: 'GLUCOPHAGE', display_name: 'Glucophage', generic_name: 'Metformin Hydrochloride', components: ['Metformin Hydrochloride'], category: 'ANTI-DIABETIC', atc_code: 'A10BA02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['metformin hydrochloride'], renal_precaution: true },
    { brand_name: 'GLIZID', display_name: 'Glizid', generic_name: 'Gliclazide', components: ['Gliclazide'], category: 'ANTI-DIABETIC', atc_code: 'A10BB09', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['gliclazide'], renal_precaution: true },
    { brand_name: 'DIAMICRON', display_name: 'Diamicron', generic_name: 'Gliclazide', components: ['Gliclazide'], category: 'ANTI-DIABETIC', atc_code: 'A10BB09', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['gliclazide'], renal_precaution: true },
    { brand_name: 'AMARYL', display_name: 'Amaryl', generic_name: 'Glimepiride', components: ['Glimepiride'], category: 'ANTI-DIABETIC', atc_code: 'A10BB12', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['glimepiride'], renal_precaution: true },
    { brand_name: 'GLIMEPIRIDE', display_name: 'Glimepiride', generic_name: 'Glimepiride', components: ['Glimepiride'], category: 'ANTI-DIABETIC', atc_code: 'A10BB12', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['glimepiride'], renal_precaution: true },
    { brand_name: 'JARDIANCE', display_name: 'Jardiance', generic_name: 'Empagliflozin', components: ['Empagliflozin'], category: 'ANTI-DIABETIC', atc_code: 'A10BK03', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['empagliflozin'], indications: ['Type 2 DM', 'CKD progression reduction', 'Heart failure'], renal_precaution: true },
    { brand_name: 'FORXIGA', display_name: 'Forxiga', generic_name: 'Dapagliflozin', components: ['Dapagliflozin'], category: 'ANTI-DIABETIC', atc_code: 'A10BK01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['dapagliflozin'], indications: ['Type 2 DM', 'CKD', 'Heart failure'], renal_precaution: true },
    { brand_name: 'SUGARLESS', display_name: 'Sugarless', generic_name: 'Dapagliflozin', components: ['Dapagliflozin'], category: 'ANTI-DIABETIC', atc_code: 'A10BK01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['dapagliflozin'], renal_precaution: true },
    { brand_name: 'INSULIN', display_name: 'Insulin', generic_name: 'Insulin Human', components: ['Insulin Human'], category: 'INSULIN', atc_code: 'A10AB01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['insulin human'], renal_precaution: false },
    { brand_name: 'LANTUS', display_name: 'Lantus', generic_name: 'Insulin Glargine', components: ['Insulin Glargine'], category: 'INSULIN', atc_code: 'A10AE04', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['insulin glargine'], renal_precaution: false },
    { brand_name: 'NOVORAPID', display_name: 'Novorapid', generic_name: 'Insulin Aspart', components: ['Insulin Aspart'], category: 'INSULIN', atc_code: 'A10AB05', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['insulin aspart'], renal_precaution: false },

    /* ── Steroids ─────────────────────────────────────────────────────── */

    { brand_name: 'WYSOLONE', display_name: 'Wysolone', generic_name: 'Prednisolone', components: ['Prednisolone'], category: 'STEROID', atc_code: 'H02AB06', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['prednisolone'], indications: ['Nephrotic syndrome', 'IgA nephropathy', 'Vasculitis'], renal_precaution: false },
    { brand_name: 'OMNACORTIL', display_name: 'Omnacortil', generic_name: 'Prednisolone', components: ['Prednisolone'], category: 'STEROID', atc_code: 'H02AB06', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['prednisolone'], renal_precaution: false },
    { brand_name: 'DEXA', display_name: 'Dexa', generic_name: 'Dexamethasone', components: ['Dexamethasone'], category: 'STEROID', atc_code: 'H02AB02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['dexamethasone'], renal_precaution: false },

    /* ── Statins ──────────────────────────────────────────────────────── */

    { brand_name: 'ATORVA', display_name: 'Atorva', generic_name: 'Atorvastatin Calcium', components: ['Atorvastatin Calcium'], category: 'STATIN', atc_code: 'C10AA05', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['atorvastatin calcium'], renal_precaution: false },
    { brand_name: 'LIPITOR', display_name: 'Lipitor', generic_name: 'Atorvastatin Calcium', components: ['Atorvastatin Calcium'], category: 'STATIN', atc_code: 'C10AA05', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['atorvastatin calcium'], renal_precaution: false },
    { brand_name: 'STORVAS', display_name: 'Storvas', generic_name: 'Atorvastatin Calcium', components: ['Atorvastatin Calcium'], category: 'STATIN', atc_code: 'C10AA05', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['atorvastatin calcium'], renal_precaution: false },
    { brand_name: 'ROSUVASTATIN', display_name: 'Rosuvastatin', generic_name: 'Rosuvastatin Calcium', components: ['Rosuvastatin Calcium'], category: 'STATIN', atc_code: 'C10AA07', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['rosuvastatin calcium'], renal_precaution: false },
    { brand_name: 'ROZUCOR', display_name: 'Rozucor', generic_name: 'Rosuvastatin Calcium', components: ['Rosuvastatin Calcium'], category: 'STATIN', atc_code: 'C10AA07', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['rosuvastatin calcium'], renal_precaution: false },

    /* ── Antiplatelets ────────────────────────────────────────────────── */

    { brand_name: 'ASPIRIN', display_name: 'Aspirin', generic_name: 'Aspirin', components: ['Acetylsalicylic Acid'], category: 'ANTIPLATELET', atc_code: 'B01AC06', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['aspirin'], renal_precaution: true },
    { brand_name: 'ECOSPRIN', display_name: 'Ecosprin', generic_name: 'Aspirin', components: ['Aspirin (Enteric Coated)'], category: 'ANTIPLATELET', atc_code: 'B01AC06', cdsco_schedule: 'OTC', jan_aushadhi: false, rxnorm_ingredients: ['aspirin'], renal_precaution: true },
    { brand_name: 'CLOPIDOGREL', display_name: 'Clopidogrel', generic_name: 'Clopidogrel', components: ['Clopidogrel Bisulphate'], category: 'ANTIPLATELET', atc_code: 'B01AC04', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['clopidogrel'], renal_precaution: false },
    { brand_name: 'CLOPILET', display_name: 'Clopilet', generic_name: 'Clopidogrel', components: ['Clopidogrel Bisulphate'], category: 'ANTIPLATELET', atc_code: 'B01AC04', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['clopidogrel'], renal_precaution: false },

    /* ── Antibiotics ──────────────────────────────────────────────────── */

    { brand_name: 'CIPLOX', display_name: 'Ciplox', generic_name: 'Ciprofloxacin', components: ['Ciprofloxacin'], category: 'ANTIBIOTIC', atc_code: 'J01MA02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['ciprofloxacin'], indications: ['UTI', 'Pyelonephritis'], renal_precaution: true },
    { brand_name: 'CIPROFLOXACIN', display_name: 'Ciprofloxacin', generic_name: 'Ciprofloxacin', components: ['Ciprofloxacin'], category: 'ANTIBIOTIC', atc_code: 'J01MA02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['ciprofloxacin'], renal_precaution: true },
    { brand_name: 'NITROFURANTOIN', display_name: 'Nitrofurantoin', generic_name: 'Nitrofurantoin', components: ['Nitrofurantoin'], category: 'ANTIBIOTIC', atc_code: 'J01XE01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['nitrofurantoin'], indications: ['Lower UTI'], renal_precaution: true },
    { brand_name: 'FAROART', display_name: 'Faroart', generic_name: 'Faropenem Sodium', components: ['Faropenem Sodium'], category: 'ANTIBIOTIC', atc_code: 'J01DI01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['faropenem'], indications: ['UTI', 'Respiratory infections'], renal_precaution: true },
    { brand_name: 'CEFIXIME', display_name: 'Cefixime', generic_name: 'Cefixime', components: ['Cefixime Trihydrate'], category: 'ANTIBIOTIC', atc_code: 'J01DD08', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['cefixime'], indications: ['UTI', 'Respiratory tract infection'], renal_precaution: true },
    { brand_name: 'AUGMENTIN', display_name: 'Augmentin', generic_name: 'Amoxicillin + Clavulanic Acid', components: ['Amoxicillin', 'Clavulanic Acid'], category: 'ANTIBIOTIC', atc_code: 'J01CR02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['amoxicillin', 'clavulanic acid'], renal_precaution: true },
    { brand_name: 'CLAVAM', display_name: 'Clavam', generic_name: 'Amoxicillin + Clavulanic Acid', components: ['Amoxicillin', 'Clavulanic Acid'], category: 'ANTIBIOTIC', atc_code: 'J01CR02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['amoxicillin', 'clavulanic acid'], renal_precaution: true },
    { brand_name: 'AZITHROMYCIN', display_name: 'Azithromycin', generic_name: 'Azithromycin', components: ['Azithromycin Dihydrate'], category: 'ANTIBIOTIC', atc_code: 'J01FA10', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['azithromycin'], renal_precaution: false },
    { brand_name: 'AZITHRAL', display_name: 'Azithral', generic_name: 'Azithromycin', components: ['Azithromycin Dihydrate'], category: 'ANTIBIOTIC', atc_code: 'J01FA10', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['azithromycin'], renal_precaution: false },

    /* ── NSAIDs / Analgesics ──────────────────────────────────────────── */

    { brand_name: 'VOVERAN', display_name: 'Voveran', generic_name: 'Diclofenac Sodium', components: ['Diclofenac Sodium'], category: 'NSAID', atc_code: 'M01AB05', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['diclofenac sodium'], renal_precaution: true },
    { brand_name: 'KETODAN', display_name: 'Ketodan', generic_name: 'Ketorolac Tromethamine', components: ['Ketorolac Tromethamine'], category: 'NSAID', atc_code: 'M01AB15', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['ketorolac tromethamine'], indications: ['Short-term pain relief', 'Post-operative analgesia'], renal_precaution: true },
    { brand_name: 'DOLO', display_name: 'Dolo', generic_name: 'Paracetamol', components: ['Paracetamol'], category: 'ANALGESICS', atc_code: 'N02BE01', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['acetaminophen'], renal_precaution: false },
    { brand_name: 'CALPOL', display_name: 'Calpol', generic_name: 'Paracetamol', components: ['Paracetamol'], category: 'ANALGESICS', atc_code: 'N02BE01', cdsco_schedule: 'OTC', jan_aushadhi: false, rxnorm_ingredients: ['acetaminophen'], renal_precaution: false },
    { brand_name: 'PARACETAMOL', display_name: 'Paracetamol', generic_name: 'Paracetamol', components: ['Paracetamol'], category: 'ANALGESICS', atc_code: 'N02BE01', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['acetaminophen'], renal_precaution: false },

    /* ── GI Agents ────────────────────────────────────────────────────── */

    { brand_name: 'PAN', display_name: 'Pan', generic_name: 'Pantoprazole', components: ['Pantoprazole Sodium'], category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['pantoprazole'], renal_precaution: false },
    { brand_name: 'PANTOP', display_name: 'Pantop', generic_name: 'Pantoprazole', components: ['Pantoprazole Sodium'], category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC02', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['pantoprazole'], renal_precaution: false },
    { brand_name: 'OMEZ', display_name: 'Omez', generic_name: 'Omeprazole', components: ['Omeprazole'], category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['omeprazole'], renal_precaution: false },
    { brand_name: 'RANTAC', display_name: 'Rantac', generic_name: 'Ranitidine', components: ['Ranitidine Hydrochloride'], category: 'H2 BLOCKER', atc_code: 'A02BA02', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['ranitidine'], renal_precaution: true },
    { brand_name: 'ONDANSETRON', display_name: 'Ondansetron', generic_name: 'Ondansetron', components: ['Ondansetron Hydrochloride'], category: 'ANTIEMETIC', atc_code: 'A04AA01', cdsco_schedule: 'H', jan_aushadhi: true, rxnorm_ingredients: ['ondansetron'], renal_precaution: false },
    { brand_name: 'EMESET', display_name: 'Emeset', generic_name: 'Ondansetron', components: ['Ondansetron Hydrochloride'], category: 'ANTIEMETIC', atc_code: 'A04AA01', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['ondansetron'], renal_precaution: false },

    /* ── Vitamins & Minerals ──────────────────────────────────────────── */

    { brand_name: 'SHELCAL', display_name: 'Shelcal', generic_name: 'Calcium Carbonate + Vitamin D3', components: ['Calcium Carbonate', 'Cholecalciferol'], category: 'VITAMINS & MINERALS', atc_code: 'A12AA04', cdsco_schedule: 'OTC', jan_aushadhi: false, rxnorm_ingredients: ['calcium carbonate', 'cholecalciferol'], renal_precaution: false },
    { brand_name: 'CALCIGARD', display_name: 'Calcigard', generic_name: 'Nifedipine', components: ['Nifedipine'], category: 'CCB', atc_code: 'C08CA05', cdsco_schedule: 'H', jan_aushadhi: false, rxnorm_ingredients: ['nifedipine'], renal_precaution: false },
    { brand_name: 'FOLIC_ACID', display_name: 'Folic Acid', generic_name: 'Folic Acid', components: ['Folic Acid'], category: 'VITAMINS & MINERALS', atc_code: 'B03BB01', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['folic acid'], renal_precaution: false },
    { brand_name: 'FERROUS_SULPHATE', display_name: 'Ferrous Sulphate', generic_name: 'Ferrous Sulphate', components: ['Ferrous Sulphate'], category: 'HAEMATOLOGICALS', atc_code: 'B03AA07', cdsco_schedule: 'OTC', jan_aushadhi: true, rxnorm_ingredients: ['ferrous sulfate'], renal_precaution: false },

    /* ── Anticoagulants ──────────────────────────────────────────────── */

    { brand_name: 'APIGAT', display_name: 'Apigat', generic_name: 'Apixaban', components: ['Apixaban'], category: 'ANTICOAGULANT', atc_code: 'B01AF02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'APIXABAN', display_name: 'Apixaban', generic_name: 'Apixaban', components: ['Apixaban'], category: 'ANTICOAGULANT', atc_code: 'B01AF02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'APIXAPIL', display_name: 'Apixapil', generic_name: 'Apixaban', components: ['Apixaban'], category: 'ANTICOAGULANT', atc_code: 'B01AF02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    /* ── Alpha Blockers / BPH ────────────────────────────────────────── */

    { brand_name: 'ALFOO', display_name: 'Alfoo', generic_name: 'Alfuzosin Hydrochloride', components: ['Alfuzosin Hydrochloride'], category: 'ALPHA BLOCKER', atc_code: 'G04CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'FLOTRAL', display_name: 'Flotral', generic_name: 'Alfuzosin Hydrochloride', components: ['Alfuzosin Hydrochloride'], category: 'ALPHA BLOCKER', atc_code: 'G04CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'CINTAPRO', display_name: 'Cintapro', generic_name: 'Prazosin Hydrochloride', components: ['Prazosin Hydrochloride'], category: 'ALPHA BLOCKER', atc_code: 'C02CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Additional CCBs ─────────────────────────────────────────────── */

    { brand_name: 'BENITAB', display_name: 'Benitab', generic_name: 'Benidipine Hydrochloride', components: ['Benidipine Hydrochloride'], category: 'CCB', atc_code: 'C08CA15', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'CILACAR', display_name: 'Cilacar', generic_name: 'Cilnidipine', components: ['Cilnidipine'], category: 'CCB', atc_code: 'C08CA14', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'ANGIZEM_CD', display_name: 'Angizem CD', generic_name: 'Diltiazem Hydrochloride', components: ['Diltiazem Hydrochloride'], category: 'CCB', atc_code: 'C08DB01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'CARDIVAS_CR', display_name: 'Cardivas CR', generic_name: 'Carvedilol', components: ['Carvedilol'], category: 'BETA BLOCKER', atc_code: 'C07AG02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'FLUNDOC', display_name: 'Flundoc', generic_name: 'Flunarizine Hydrochloride', components: ['Flunarizine Hydrochloride'], category: 'ANTIVERTIGO', atc_code: 'N07CA03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Additional ACE Inhibitors ───────────────────────────────────── */

    { brand_name: 'COVERSYL', display_name: 'Coversyl', generic_name: 'Perindopril Erbumine', components: ['Perindopril Erbumine'], category: 'ACE INHIBITOR', atc_code: 'C09AA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    /* ── Cardiac Glycoside / Anti-anginal ────────────────────────────── */

    { brand_name: 'DIXIN', display_name: 'Dixin', generic_name: 'Digoxin', components: ['Digoxin'], category: 'CARDIAC GLYCOSIDE', atc_code: 'C01AA05', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: true },
    { brand_name: 'CARDIZINE', display_name: 'Cardizine', generic_name: 'Trimetazidine Dihydrochloride', components: ['Trimetazidine Dihydrochloride'], category: 'ANTI-ANGINAL', atc_code: 'C01EB15', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'ARKAPRESS', display_name: 'Arkapress', generic_name: 'Clonidine Hydrochloride', components: ['Clonidine Hydrochloride'], category: 'CENTRALLY ACTING ANTIHYPERTENSIVE', atc_code: 'C02AC01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Immunosuppressants (additional brands) ──────────────────────── */

    { brand_name: 'AZORAN', display_name: 'Azoran', generic_name: 'Azathioprine', components: ['Azathioprine'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AX01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'CYCLOXAN', display_name: 'Cycloxan', generic_name: 'Cyclophosphamide', components: ['Cyclophosphamide'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L01AA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'ENDOXEN', display_name: 'Endoxen', generic_name: 'Cyclophosphamide', components: ['Cyclophosphamide'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L01AA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'CMVCEL', display_name: 'CMVcel', generic_name: 'Valganciclovir Hydrochloride', components: ['Valganciclovir Hydrochloride'], category: 'ANTIVIRAL', atc_code: 'J05AB14', cdsco_schedule: 'H1', jan_aushadhi: false, renal_precaution: true },

    /* ── Steroids / Mineralocorticoids ───────────────────────────────── */

    { brand_name: 'DEFSTEAD', display_name: 'Defstead', generic_name: 'Deflazacort', components: ['Deflazacort'], category: 'STEROID', atc_code: 'H02AB13', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'FLUDRICORT', display_name: 'Fludricort', generic_name: 'Fludrocortisone Acetate', components: ['Fludrocortisone Acetate'], category: 'MINERALOCORTICOID', atc_code: 'H02AA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Haematologicals (ESA) ───────────────────────────────────────── */

    { brand_name: 'DARBEJOY', display_name: 'Darbejoy', generic_name: 'Darbepoetin Alfa', components: ['Darbepoetin Alfa'], category: 'HAEMATOLOGICALS', atc_code: 'B03XA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Diuretics / MRA ─────────────────────────────────────────────── */

    { brand_name: 'EPTUS', display_name: 'Eptus', generic_name: 'Eplerenone', components: ['Eplerenone'], category: 'DIURETICS', atc_code: 'C03DA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'DIAMOX', display_name: 'Diamox', generic_name: 'Acetazolamide', components: ['Acetazolamide'], category: 'DIURETICS', atc_code: 'S01EC01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    /* ── Thyroid Hormone ─────────────────────────────────────────────── */

    { brand_name: 'ELTROXIN', display_name: 'Eltroxin', generic_name: 'Levothyroxine Sodium', components: ['Levothyroxine Sodium'], category: 'THYROID HORMONE', atc_code: 'H03AA01', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: false },

    /* ── Additional Anti-diabetics ───────────────────────────────────── */

    { brand_name: 'DYNAGLIPT_L', display_name: 'Dynaglipt-L', generic_name: 'Linagliptin', components: ['Linagliptin'], category: 'ANTI-DIABETIC', atc_code: 'A10BH05', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Antigout ────────────────────────────────────────────────────── */

    { brand_name: 'FIXURIC_ER', display_name: 'Fixuric ER', generic_name: 'Febuxostat', components: ['Febuxostat'], category: 'ANTIGOUT', atc_code: 'M04AA03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Antifungal ──────────────────────────────────────────────────── */

    { brand_name: 'FLUCON', display_name: 'Flucon', generic_name: 'Fluconazole', components: ['Fluconazole'], category: 'ANTIFUNGAL', atc_code: 'J02AC01', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: true },

    /* ── Additional Antibiotics ──────────────────────────────────────── */

    { brand_name: 'BACTRIM_DS', display_name: 'Bactrim DS', generic_name: 'Trimethoprim + Sulfamethoxazole', components: ['Trimethoprim', 'Sulfamethoxazole'], category: 'ANTIBIOTIC', atc_code: 'J01EE01', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: true },
    { brand_name: 'CEPHOPRL', display_name: 'Cephoprl', generic_name: 'Cefpodoxime Proxetil', components: ['Cefpodoxime Proxetil'], category: 'ANTIBIOTIC', atc_code: 'J01DD13', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'DOXY', display_name: 'Doxy', generic_name: 'Doxycycline Hyclate', components: ['Doxycycline Hyclate'], category: 'ANTIBIOTIC', atc_code: 'J01AA02', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: false },

    /* ── Antiepileptics ──────────────────────────────────────────────── */

    { brand_name: 'ENCORATE_CHRONO', display_name: 'Encorate Chrono', generic_name: 'Sodium Valproate', components: ['Sodium Valproate', 'Valproic Acid'], category: 'ANTIEPILEPTIC', atc_code: 'N03AG01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'GABANEF', display_name: 'Gabanef', generic_name: 'Gabapentin', components: ['Gabapentin'], category: 'ANTICONVULSANT', atc_code: 'N03AX12', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'GABAWELL', display_name: 'Gabawell', generic_name: 'Gabapentin', components: ['Gabapentin'], category: 'ANTICONVULSANT', atc_code: 'N03AX12', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    /* ── Neuropsychiatric ────────────────────────────────────────────── */

    { brand_name: 'ATARAX', display_name: 'Atarax', generic_name: 'Hydroxyzine Hydrochloride', components: ['Hydroxyzine Hydrochloride'], category: 'ANTIHISTAMINE', atc_code: 'N05BB01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'DUZELA', display_name: 'Duzela', generic_name: 'Duloxetine Hydrochloride', components: ['Duloxetine Hydrochloride'], category: 'ANTIDEPRESSANT', atc_code: 'N06AX21', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'BROMOCRIPTIN', display_name: 'Bromocriptin', generic_name: 'Bromocriptine Mesylate', components: ['Bromocriptine Mesylate'], category: 'DOPAMINE AGONIST', atc_code: 'N04BC01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'BACFEN', display_name: 'Bacfen', generic_name: 'Baclofen', components: ['Baclofen'], category: 'MUSCLE RELAXANT', atc_code: 'M03BX01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    /* ── Bronchodilators ─────────────────────────────────────────────── */

    { brand_name: 'ABPHYLINE_SR', display_name: 'Abphyline SR', generic_name: 'Theophylline', components: ['Theophylline'], category: 'BRONCHODILATOR', atc_code: 'R03DA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'DOXOBID', display_name: 'Doxobid', generic_name: 'Doxofylline', components: ['Doxofylline'], category: 'BRONCHODILATOR', atc_code: 'R03DA11', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Antihistamines ──────────────────────────────────────────────── */

    { brand_name: 'FEXCEL', display_name: 'Fexcel', generic_name: 'Fexofenadine Hydrochloride', components: ['Fexofenadine Hydrochloride'], category: 'ANTIHISTAMINE', atc_code: 'R06AX26', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },

    /* ── GI Agents (additional) ──────────────────────────────────────── */

    { brand_name: 'ELDOPER', display_name: 'Eldoper', generic_name: 'Domperidone', components: ['Domperidone'], category: 'ANTIEMETIC', atc_code: 'A03FA03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'DULCOFLEX', display_name: 'Dulcoflex', generic_name: 'Bisacodyl', components: ['Bisacodyl'], category: 'LAXATIVE', atc_code: 'A06AB02', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'DROTIN', display_name: 'Drotin', generic_name: 'Drotaverine Hydrochloride', components: ['Drotaverine Hydrochloride'], category: 'ANTISPASMODIC', atc_code: 'A03AD02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'G_PANASE', display_name: 'G-Panase', generic_name: 'Pancreatin', components: ['Pancreatin'], category: 'DIGESTIVE ENZYME', atc_code: 'A09AA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Urology ─────────────────────────────────────────────────────── */

    { brand_name: 'EDEGRA', display_name: 'Edegra', generic_name: 'Sildenafil Citrate', components: ['Sildenafil Citrate'], category: 'PDE5 INHIBITOR', atc_code: 'G04BE03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Vitamins & Minerals (additional) ───────────────────────────── */

    { brand_name: 'CADCAL', display_name: 'Cadcal', generic_name: 'Calcium Carbonate', components: ['Calcium Carbonate'], category: 'VITAMINS & MINERALS', atc_code: 'A12AA04', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'B_LONG', display_name: 'B-Long', generic_name: 'Pyridoxine Hydrochloride', components: ['Pyridoxine Hydrochloride (Vitamin B6)'], category: 'VITAMINS & MINERALS', atc_code: 'A11HA02', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'ARISTOMOL', display_name: 'Aristomol', generic_name: 'Paracetamol', components: ['Paracetamol'], category: 'ANALGESICS', atc_code: 'N02BE01', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },

    /* ── High-frequency Kongunad prescriptions ───────────────────────── */

    // NAC — renoprotection, contrast nephropathy prophylaxis, mucolysis
    { brand_name: 'NACSAVE', display_name: 'Nacsave', generic_name: 'N-Acetylcysteine', components: ['N-Acetylcysteine'], category: 'RENOPROTECTIVE', atc_code: 'R05CB01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'NACSHIELD', display_name: 'Nacshield', generic_name: 'N-Acetylcysteine', components: ['N-Acetylcysteine'], category: 'RENOPROTECTIVE', atc_code: 'R05CB01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Urinary alkalinizer — UTI, kidney stones, CKD metabolic acidosis
    { brand_name: 'UZUPAS', display_name: 'Uzupas', generic_name: 'Disodium Hydrogen Citrate', components: ['Disodium Hydrogen Citrate'], category: 'URINARY ALKALINIZER', atc_code: 'A12BA01', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'OXALO', display_name: 'Oxalo', generic_name: 'Potassium Citrate', components: ['Potassium Citrate'], category: 'URINARY ALKALINIZER', atc_code: 'A12BA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Phosphate binder variants
    { brand_name: 'PHOCEL', display_name: 'Phocel', generic_name: 'Calcium Acetate', components: ['Calcium Acetate'], category: 'PHOSPHATE BINDER', atc_code: 'V03AE07', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'SEVNATE', display_name: 'Sevnate', generic_name: 'Sevelamer Carbonate', components: ['Sevelamer Carbonate'], category: 'PHOSPHATE BINDER', atc_code: 'V03AE02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Sodium Bicarbonate EC (enteric coated variant)
    { brand_name: 'SODIC_EC', display_name: 'Sodic EC', generic_name: 'Sodium Bicarbonate', components: ['Sodium Bicarbonate (Enteric Coated)'], category: 'ELECTROLYTES & ALKALI', atc_code: 'B05XA02', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },

    // CCB — Lercanidipine (renoprotective, preferred in CKD with proteinuria)
    { brand_name: 'LALCAR_ER', display_name: 'Lalcar ER', generic_name: 'Lercanidipine Hydrochloride', components: ['Lercanidipine Hydrochloride'], category: 'CCB', atc_code: 'C08CA13', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Alpha-1A selective blocker (BPH)
    { brand_name: 'RAPILIF', display_name: 'Rapilif', generic_name: 'Silodosin', components: ['Silodosin'], category: 'ALPHA BLOCKER', atc_code: 'G04CA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'PRAZONIC_XL', display_name: 'Prazonic XL', generic_name: 'Prazosin Hydrochloride', components: ['Prazosin Hydrochloride'], category: 'ALPHA BLOCKER', atc_code: 'C02CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Beta-3 agonist — overactive bladder (common in CKD)
    { brand_name: 'MIRBEG', display_name: 'Mirbeg', generic_name: 'Mirabegron', components: ['Mirabegron'], category: 'BETA-3 AGONIST', atc_code: 'G04BD12', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Vasopressor — orthostatic hypotension in dialysis patients
    { brand_name: 'MIDOTAB', display_name: 'Midotab', generic_name: 'Midodrine Hydrochloride', components: ['Midodrine Hydrochloride'], category: 'VASOPRESSOR', atc_code: 'C01CA17', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Anti-diabetic — Voglibose (alpha-glucosidase inhibitor)
    { brand_name: 'VOLIBO_R', display_name: 'Volibo-R', generic_name: 'Voglibose', components: ['Voglibose'], category: 'ANTI-DIABETIC', atc_code: 'A10BX13', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // COX-2 inhibitor (use with caution in CKD)
    { brand_name: 'CELERA_NU', display_name: 'Celera NU', generic_name: 'Celecoxib', components: ['Celecoxib'], category: 'COX-2 INHIBITOR', atc_code: 'M01AH01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // DMARD — Hydroxychloroquine (lupus nephritis, IgA nephropathy)
    { brand_name: 'OHCQ', display_name: 'OHCQ', generic_name: 'Hydroxychloroquine Sulphate', components: ['Hydroxychloroquine Sulphate'], category: 'DMARD', atc_code: 'P01BA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // GI prokinetic — Prucalopride (5-HT4 agonist, constipation in CKD)
    { brand_name: 'PRULOOZ', display_name: 'Prulooz', generic_name: 'Prucalopride Succinate', components: ['Prucalopride Succinate'], category: 'PROKINETIC', atc_code: 'A03AE04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Antivertigo — Betahistine
    { brand_name: 'BETHERAN', display_name: 'Betheran', generic_name: 'Betahistine Dihydrochloride', components: ['Betahistine Dihydrochloride'], category: 'ANTIVERTIGO', atc_code: 'N07CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'VERTIN', display_name: 'Vertin', generic_name: 'Betahistine Dihydrochloride', components: ['Betahistine Dihydrochloride'], category: 'ANTIVERTIGO', atc_code: 'N07CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Thyroid (additional brand)
    { brand_name: 'THYRONORM', display_name: 'Thyronorm', generic_name: 'Levothyroxine Sodium', components: ['Levothyroxine Sodium'], category: 'THYROID HORMONE', atc_code: 'H03AA01', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: false },

    // Appetite stimulant/antiemetic
    { brand_name: 'LONGIFENE', display_name: 'Longifene', generic_name: 'Buclizine Hydrochloride', components: ['Buclizine Hydrochloride'], category: 'ANTIHISTAMINE', atc_code: 'R06AA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Sitagliptin mono (combo handled in COMBO_DRUG_TABLE as ISTAMET)
    { brand_name: 'JANUVIA', display_name: 'Januvia', generic_name: 'Sitagliptin Phosphate', components: ['Sitagliptin Phosphate'], category: 'ANTI-DIABETIC', atc_code: 'A10BH01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Antibiotic — Cefuroxime Axetil (250mg matches CCVF prescriptions)
    { brand_name: 'CCVF', display_name: 'CCVF', generic_name: 'Cefuroxime Axetil', components: ['Cefuroxime Axetil'], category: 'ANTIBIOTIC', atc_code: 'J01DC02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    /* ── Complete Kongunad catalog — H to Z ──────────────────────────── */

    // Immunosuppressants — Mycophenolate brands (transplant/nephrotic)
    { brand_name: 'MY360', display_name: 'My360', generic_name: 'Mycophenolate Sodium', components: ['Mycophenolate Sodium'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AA06', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'MYSTEAD', display_name: 'Mystead', generic_name: 'Mycophenolate Mofetil', components: ['Mycophenolate Mofetil'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AA06', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'TACRORITE', display_name: 'Tacrorite', generic_name: 'Tacrolimus', components: ['Tacrolimus'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AD02', cdsco_schedule: 'H1', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'VINGRAF', display_name: 'Vingraf', generic_name: 'Tacrolimus', components: ['Tacrolimus'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L04AD02', cdsco_schedule: 'H1', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'METHOTREXATE', display_name: 'Methotrexate', generic_name: 'Methotrexate', components: ['Methotrexate'], category: 'DMARD', atc_code: 'L01BA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'HYDROXY_UREA', display_name: 'Hydroxy Urea', generic_name: 'Hydroxyurea', components: ['Hydroxyurea'], category: 'IMMUNOSUPPRESSANT', atc_code: 'L01XX05', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'SAAZ', display_name: 'Saaz', generic_name: 'Sulfasalazine', components: ['Sulfasalazine'], category: 'DMARD', atc_code: 'A07EC01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Anti-diabetics (additional)
    { brand_name: 'ISTAVEL', display_name: 'Istavel', generic_name: 'Vildagliptin', components: ['Vildagliptin'], category: 'ANTI-DIABETIC', atc_code: 'A10BH02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'NATRISE', display_name: 'Natrise', generic_name: 'Pioglitazone Hydrochloride', components: ['Pioglitazone Hydrochloride'], category: 'ANTI-DIABETIC', atc_code: 'A10BG03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'MELMET_SR', display_name: 'Melmet SR', generic_name: 'Metformin Hydrochloride', components: ['Metformin Hydrochloride'], category: 'ANTI-DIABETIC', atc_code: 'A10BA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'RYBELSUS', display_name: 'Rybelsus', generic_name: 'Semaglutide', components: ['Semaglutide'], category: 'ANTI-DIABETIC', atc_code: 'A10BJ06', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'VOLIBO_R', display_name: 'Volibo-R', generic_name: 'Voglibose', components: ['Voglibose'], category: 'ANTI-DIABETIC', atc_code: 'A10BX13', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Insulin (additional brands/formulations)
    { brand_name: 'H_MIXTARD', display_name: 'H.Mixtard', generic_name: 'Biphasic Insulin Human (30/70)', components: ['Insulin Human (Regular)', 'Insulin Human (NPH)'], category: 'INSULIN', atc_code: 'A10AD01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'H_INSULIN', display_name: 'H.Insulin', generic_name: 'Insulin Human', components: ['Insulin Human'], category: 'INSULIN', atc_code: 'A10AB01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'EGLUCENT', display_name: 'Eglucent 25/75', generic_name: 'Biphasic Insulin Aspart (25/75)', components: ['Insulin Aspart', 'Insulin Aspart Protamine'], category: 'INSULIN', atc_code: 'A10AD05', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Beta blockers (additional)
    { brand_name: 'NEBISTAR', display_name: 'Nebistar', generic_name: 'Nebivolol Hydrochloride', components: ['Nebivolol Hydrochloride'], category: 'BETA BLOCKER', atc_code: 'C07AB12', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'INDEROL', display_name: 'Inderol', generic_name: 'Propranolol Hydrochloride', components: ['Propranolol Hydrochloride'], category: 'BETA BLOCKER', atc_code: 'C07AA05', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: false },
    { brand_name: 'INDEROL_LA', display_name: 'Inderol LA', generic_name: 'Propranolol Hydrochloride', components: ['Propranolol Hydrochloride'], category: 'BETA BLOCKER', atc_code: 'C07AA05', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'RX_BETA_XL', display_name: 'Rx Beta XL', generic_name: 'Metoprolol Succinate', components: ['Metoprolol Succinate'], category: 'BETA BLOCKER', atc_code: 'C07AB02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Diuretics (critical CKD drugs)
    { brand_name: 'MATZOL', display_name: 'Matzol', generic_name: 'Metolazone', components: ['Metolazone'], category: 'DIURETICS', atc_code: 'C03BA08', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'TORGO', display_name: 'Torgo', generic_name: 'Torsemide', components: ['Torsemide'], category: 'DIURETICS', atc_code: 'C03CA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // ARBs (additional brands)
    { brand_name: 'MEGACET', display_name: 'Megacet', generic_name: 'Valsartan', components: ['Valsartan'], category: 'ARB', atc_code: 'C09CA03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'CRAVIHENZ', display_name: 'Cravihenz', generic_name: 'Valsartan', components: ['Valsartan'], category: 'ARB', atc_code: 'C09CA03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Cardiac — nitrates, anti-anginals, heart rate
    { brand_name: 'IVABRAD', display_name: 'Ivabrad', generic_name: 'Ivabradine Hydrochloride', components: ['Ivabradine Hydrochloride'], category: 'ANTI-ANGINAL', atc_code: 'C01EB17', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'ISORDIL', display_name: 'Isordil', generic_name: 'Isosorbide Dinitrate', components: ['Isosorbide Dinitrate'], category: 'NITRATE', atc_code: 'C01DA08', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: false },
    { brand_name: 'NITROCONTIN', display_name: 'Nitrocontin', generic_name: 'Glyceryl Trinitrate', components: ['Glyceryl Trinitrate'], category: 'NITRATE', atc_code: 'C01DA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'KORANDIL', display_name: 'Korandil', generic_name: 'Nicorandil', components: ['Nicorandil'], category: 'ANTI-ANGINAL', atc_code: 'C01DX16', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'TICAVIC', display_name: 'Ticavic', generic_name: 'Ticagrelor', components: ['Ticagrelor'], category: 'ANTIPLATELET', atc_code: 'B01AC24', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'TRANOSTAT', display_name: 'Tranostat', generic_name: 'Tranexamic Acid', components: ['Tranexamic Acid'], category: 'ANTIFIBRINOLYTIC', atc_code: 'B02AA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Anticoagulant — Rivaroxaban
    { brand_name: 'RIVAFLOW', display_name: 'Rivaflow', generic_name: 'Rivaroxaban', components: ['Rivaroxaban'], category: 'ANTICOAGULANT', atc_code: 'B01AF01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // CCB — Nifedipine extended release brands
    { brand_name: 'NICARDIA_R', display_name: 'Nicardia-R', generic_name: 'Nifedipine', components: ['Nifedipine'], category: 'CCB', atc_code: 'C08CA05', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'NICARDIA_XL', display_name: 'Nicardia XL', generic_name: 'Nifedipine', components: ['Nifedipine'], category: 'CCB', atc_code: 'C08CA05', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'SILOMAX', display_name: 'Silomax', generic_name: 'Silodosin', components: ['Silodosin'], category: 'ALPHA BLOCKER', atc_code: 'G04CA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Neuropsychiatric
    { brand_name: 'LEVIPILL', display_name: 'Levipill', generic_name: 'Levetiracetam', components: ['Levetiracetam'], category: 'ANTIEPILEPTIC', atc_code: 'N03AX14', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'LONAZEP', display_name: 'Lonazep', generic_name: 'Clonazepam', components: ['Clonazepam'], category: 'ANTIEPILEPTIC', atc_code: 'N03AE01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'PETRIL', display_name: 'Petril', generic_name: 'Clonazepam', components: ['Clonazepam'], category: 'ANTIEPILEPTIC', atc_code: 'N03AE01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'VALPORATE', display_name: 'Valporate', generic_name: 'Sodium Valproate', components: ['Sodium Valproate'], category: 'ANTIEPILEPTIC', atc_code: 'N03AG01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'QPIN', display_name: 'Qpin', generic_name: 'Quetiapine Fumarate', components: ['Quetiapine Fumarate'], category: 'ANTIPSYCHOTIC', atc_code: 'N05AH04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'SERTA', display_name: 'Serta', generic_name: 'Sertraline Hydrochloride', components: ['Sertraline Hydrochloride'], category: 'ANTIDEPRESSANT', atc_code: 'N06AB06', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'ZOLWING', display_name: 'Zolwing', generic_name: 'Zolpidem Tartrate', components: ['Zolpidem Tartrate'], category: 'HYPNOTIC', atc_code: 'N05CF02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'SYNDOPA', display_name: 'Syndopa', generic_name: 'Levodopa + Carbidopa', components: ['Levodopa', 'Carbidopa'], category: 'ANTI-PARKINSON', atc_code: 'N04BA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Antivertigo
    { brand_name: 'STUGERON', display_name: 'Stugeron', generic_name: 'Cinnarizine', components: ['Cinnarizine'], category: 'ANTIVERTIGO', atc_code: 'N07CA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'CINNARIZINE', display_name: 'Cinnarizine', generic_name: 'Cinnarizine', components: ['Cinnarizine'], category: 'ANTIVERTIGO', atc_code: 'N07CA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Anti-TB / Antibiotics (additional)
    { brand_name: 'INH', display_name: 'INH', generic_name: 'Isoniazid', components: ['Isoniazid'], category: 'ANTIBIOTIC', atc_code: 'J04AC01', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: true },
    { brand_name: 'RIFAMPICIN', display_name: 'Rifampicin', generic_name: 'Rifampicin', components: ['Rifampicin'], category: 'ANTIBIOTIC', atc_code: 'J04AB02', cdsco_schedule: 'H', jan_aushadhi: true, renal_precaution: false },
    { brand_name: 'LINEZOLID', display_name: 'Linezolid', generic_name: 'Linezolid', components: ['Linezolid'], category: 'ANTIBIOTIC', atc_code: 'J01XX08', cdsco_schedule: 'H1', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'MINOZ', display_name: 'Minoz', generic_name: 'Minocycline Hydrochloride', components: ['Minocycline Hydrochloride'], category: 'ANTIBIOTIC', atc_code: 'J01AA08', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'UTINIFT', display_name: 'Utinift', generic_name: 'Nitrofurantoin', components: ['Nitrofurantoin'], category: 'ANTIBIOTIC', atc_code: 'J01XE01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'URIKIND', display_name: 'Urikind', generic_name: 'Potassium Citrate', components: ['Potassium Citrate'], category: 'URINARY ALKALINIZER', atc_code: 'A12BA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Phosphate binders (additional brands)
    { brand_name: 'ZEROPHOS', display_name: 'Zerophos', generic_name: 'Calcium Acetate', components: ['Calcium Acetate'], category: 'PHOSPHATE BINDER', atc_code: 'V03AE07', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Vitamins & Minerals (high-frequency)
    { brand_name: 'N_CALCIFEROL', display_name: 'N-Calciferol Sachet', generic_name: 'Cholecalciferol', components: ['Cholecalciferol (Vitamin D3)'], category: 'VITAMINS & MINERALS', atc_code: 'A11CC05', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'RIBOFLAVIN', display_name: 'Riboflavin', generic_name: 'Riboflavin', components: ['Riboflavin (Vitamin B2)'], category: 'VITAMINS & MINERALS', atc_code: 'A11HA04', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'MAGMAXX', display_name: 'Magmaxx', generic_name: 'Magnesium Oxide', components: ['Magnesium Oxide'], category: 'VITAMINS & MINERALS', atc_code: 'A12CC', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'OMEGAREN', display_name: 'Omegaren', generic_name: 'Omega-3 Fatty Acids', components: ['Omega-3 Fatty Acids (EPA + DHA)'], category: 'VITAMINS & MINERALS', atc_code: 'C10AX06', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'REFERVIT', display_name: 'Refervit', generic_name: 'Methylcobalamin + Folic Acid + Pyridoxine', components: ['Methylcobalamin', 'Folic Acid', 'Pyridoxine Hydrochloride'], category: 'VITAMINS & MINERALS', atc_code: 'B03BB01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // GI / Hepatobiliary
    { brand_name: 'UDIGOAT', display_name: 'Udigoat', generic_name: 'Ursodeoxycholic Acid', components: ['Ursodeoxycholic Acid'], category: 'HEPATOBILIARY', atc_code: 'A05AA02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'COLOSPA_R', display_name: 'Colospa-R', generic_name: 'Mebeverine Hydrochloride', components: ['Mebeverine Hydrochloride'], category: 'ANTISPASMODIC', atc_code: 'A03AA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'VIBACT', display_name: 'Vibact', generic_name: 'Bacillus Clausii', components: ['Bacillus Clausii (Probiotic)'], category: 'PROBIOTIC', atc_code: 'A07FA', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'PANON', display_name: 'Panon', generic_name: 'Pantoprazole', components: ['Pantoprazole Sodium'], category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'PANTAPROZOLE', display_name: 'Pantaprozole', generic_name: 'Pantoprazole', components: ['Pantoprazole Sodium'], category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'JUNIOR_LANZOLE', display_name: 'Junior Lanzole', generic_name: 'Lansoprazole', components: ['Lansoprazole'], category: 'PROTON PUMP INHIBITOR', atc_code: 'A02BC03', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Steroid variants
    { brand_name: 'STERIO', display_name: 'Sterio', generic_name: 'Methylprednisolone', components: ['Methylprednisolone'], category: 'STEROID', atc_code: 'H02AB04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'SICRIPTIN', display_name: 'Sicriptin', generic_name: 'Bromocriptine Mesylate', components: ['Bromocriptine Mesylate'], category: 'DOPAMINE AGONIST', atc_code: 'N04BC01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Statins (additional)
    { brand_name: 'ROSUVA_GOLD', display_name: 'Rosuva Gold', generic_name: 'Rosuvastatin Calcium', components: ['Rosuvastatin Calcium'], category: 'STATIN', atc_code: 'C10AA07', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Antigout
    { brand_name: 'ZYCOLCHIN', display_name: 'Zycolchin', generic_name: 'Colchicine', components: ['Colchicine'], category: 'ANTIGOUT', atc_code: 'M04AC01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Antiplatelet (additional)
    { brand_name: 'CLOPIODE', display_name: 'Clopiode', generic_name: 'Clopidogrel', components: ['Clopidogrel Bisulphate'], category: 'ANTIPLATELET', atc_code: 'B01AC04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Prazosin variants
    { brand_name: 'PRAZOPRESS_XL', display_name: 'Prazopress XL', generic_name: 'Prazosin Hydrochloride', components: ['Prazosin Hydrochloride'], category: 'ALPHA BLOCKER', atc_code: 'C02CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'PRAZOTEZ_SR', display_name: 'Prazotez SR', generic_name: 'Prazosin Hydrochloride', components: ['Prazosin Hydrochloride'], category: 'ALPHA BLOCKER', atc_code: 'C02CA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    /* ── Previously skipped — now resolved ──────────────────────────── */

    // GI protective
    { brand_name: 'SUCRAVAR_O', display_name: 'Sucravar-O Gel', generic_name: 'Sucralfate', components: ['Sucralfate'], category: 'GASTROPROTECTIVE', atc_code: 'A02BX02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Antibiotic + probiotic co-pack (active ingredient = Amoxicillin)
    { brand_name: 'LENTICILIN_LB', display_name: 'Lenticilin LB', generic_name: 'Amoxicillin + Lactobacillus', components: ['Amoxicillin', 'Lactobacillus Sporogenes'], category: 'ANTIBIOTIC', atc_code: 'J01CA04', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // Digestive enzymes
    { brand_name: 'ARISTOZYME', display_name: 'Aristozyme', generic_name: 'Fungal Diastase + Pepsin', components: ['Fungal Diastase', 'Pepsin'], category: 'DIGESTIVE ENZYME', atc_code: 'A09AA', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },

    // Appetite stimulant
    { brand_name: 'APTIVATE', display_name: 'Aptivate', generic_name: 'Cyproheptadine Hydrochloride', components: ['Cyproheptadine Hydrochloride'], category: 'APPETITE STIMULANT', atc_code: 'R06AX02', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Urinary alkalinizers / electrolyte syrups
    { brand_name: 'ALKASTONE_B6', display_name: 'Alkastone B6', generic_name: 'Potassium Magnesium Citrate + Pyridoxine', components: ['Potassium Citrate', 'Magnesium Citrate', 'Pyridoxine Hydrochloride'], category: 'URINARY ALKALINIZER', atc_code: 'A12BA01', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'CRAMPAC_KM', display_name: 'Crampac KM', generic_name: 'Potassium Magnesium Citrate', components: ['Potassium Citrate', 'Magnesium Citrate'], category: 'ELECTROLYTES & ALKALI', atc_code: 'A12BA01', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: true },
    { brand_name: 'POTRIDE', display_name: 'Potride', generic_name: 'Potassium Chloride', components: ['Potassium Chloride'], category: 'ELECTROLYTES & ALKALI', atc_code: 'A12BA01', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: true },

    // CKD nutrition / EAA / Ketoanalogue supplements
    { brand_name: 'KETONANO', display_name: 'Ketonano', generic_name: 'Essential Amino Acids + Ketoanalogues', components: ['Alpha-Keto Acid Analogues', 'Essential Amino Acids'], category: 'CKD NUTRITIONAL SUPPLEMENT', atc_code: 'V06DB', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },
    { brand_name: 'RENOALFA', display_name: 'Renoalfa', generic_name: 'Essential Amino Acids + Ketoanalogues', components: ['Alpha-Keto Acid Analogues', 'Essential Amino Acids'], category: 'CKD NUTRITIONAL SUPPLEMENT', atc_code: 'V06DB', cdsco_schedule: 'H', jan_aushadhi: false, renal_precaution: false },

    // Calcium supplement (higher dose variant)
    { brand_name: 'SHELCAL_HD', display_name: 'Shelcal HD', generic_name: 'Calcium Carbonate + Vitamin D3 + Magnesium', components: ['Calcium Carbonate', 'Cholecalciferol', 'Magnesium Oxide'], category: 'VITAMINS & MINERALS', atc_code: 'A12AA04', cdsco_schedule: 'OTC', jan_aushadhi: false, renal_precaution: false },
];

/* ─── Lookup helpers ────────────────────────────────────────────────────── */

export function buildReferenceMap(): Map<string, RefDrugEntry> {
    const map = new Map<string, RefDrugEntry>();
    for (const entry of INDIAN_DRUG_DATABASE) {
        map.set(entry.brand_name.toUpperCase(), entry);
        const displayKey = entry.display_name.toUpperCase().replace(/[\s-]+/g, '_');
        if (!map.has(displayKey)) map.set(displayKey, entry);
    }
    return map;
}

export function buildComboMap(): Map<string, ComboDrugEntry> {
    const map = new Map<string, ComboDrugEntry>();
    for (const entry of COMBO_DRUG_TABLE) {
        for (const slug of entry.slugs) {
            map.set(slug.toUpperCase(), entry);
        }
    }
    return map;
}

export function toResolverFormat(entries: RefDrugEntry[]) {
    return entries.map(e => ({
        brand_name: e.display_name,
        generic_name: e.generic_name,
        category: e.category,
        components: e.components,
        atc_code: e.atc_code,
        renal_precaution: e.renal_precaution ?? false,
        cdsco_schedule: e.cdsco_schedule,
    }));
}
