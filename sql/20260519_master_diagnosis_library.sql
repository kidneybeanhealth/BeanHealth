-- ─────────────────────────────────────────────────────────────────────────────
-- Master Clinical Diagnosis Library — fresh seed for ALL hospitals
-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Wipe the existing catalog entirely.
-- Step 2: Re-seed every known hospital with the curated master list.
--
-- "Known hospitals" = any hospital_id that appears in hospital_prescriptions,
-- hospital_patients, or hospital_doctors — covers every active hospital.
--
-- Safe to re-run: after the wipe it simply re-inserts the full list.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1 — wipe existing catalog
TRUNCATE TABLE hospital_saved_diagnoses;

-- Step 2 — re-seed for every known hospital
WITH diagnoses (name, normalized_name) AS (
    VALUES
    -- Nephrology & Urology — Glomerular Diseases
    ('Acute Glomerulonephritis',                                  'ACUTE GLOMERULONEPHRITIS'),
    ('Chronic Glomerulonephritis',                                'CHRONIC GLOMERULONEPHRITIS'),
    ('Rapidly Progressive Glomerulonephritis (RPGN)',             'RAPIDLY PROGRESSIVE GLOMERULONEPHRITIS (RPGN)'),
    ('Nephrotic Syndrome',                                        'NEPHROTIC SYNDROME'),
    ('Minimal Change Disease',                                    'MINIMAL CHANGE DISEASE'),
    ('Focal Segmental Glomerulosclerosis',                        'FOCAL SEGMENTAL GLOMERULOSCLEROSIS'),
    ('Membranous Nephropathy',                                    'MEMBRANOUS NEPHROPATHY'),
    ('IgA Nephropathy (Berger''s Disease)',                       'IGA NEPHROPATHY (BERGER''S DISEASE)'),
    ('Lupus Nephritis',                                           'LUPUS NEPHRITIS'),
    ('Diabetic Nephropathy',                                      'DIABETIC NEPHROPATHY'),
    ('Alport Syndrome',                                           'ALPORT SYNDROME'),
    ('Thin Basement Membrane Nephropathy',                        'THIN BASEMENT MEMBRANE NEPHROPATHY'),

    -- Nephrology & Urology — Renal Failure & Ischemia
    ('Acute Kidney Injury (AKI)',                                 'ACUTE KIDNEY INJURY (AKI)'),
    ('AKI - Prerenal',                                            'AKI - PRERENAL'),
    ('AKI - Intrinsic Renal',                                     'AKI - INTRINSIC RENAL'),
    ('AKI - Postrenal',                                           'AKI - POSTRENAL'),
    ('Chronic Kidney Disease (CKD)',                              'CHRONIC KIDNEY DISEASE (CKD)'),
    ('CKD Stage 1',                                               'CKD STAGE 1'),
    ('CKD Stage 2',                                               'CKD STAGE 2'),
    ('CKD Stage 3',                                               'CKD STAGE 3'),
    ('CKD Stage 4',                                               'CKD STAGE 4'),
    ('CKD Stage 5',                                               'CKD STAGE 5'),
    ('End-Stage Renal Disease (ESRD)',                            'END-STAGE RENAL DISEASE (ESRD)'),
    ('Acute Tubular Necrosis (ATN)',                              'ACUTE TUBULAR NECROSIS (ATN)'),
    ('Acute Interstitial Nephritis (AIN)',                        'ACUTE INTERSTITIAL NEPHRITIS (AIN)'),
    ('Renal Artery Stenosis',                                     'RENAL ARTERY STENOSIS'),
    ('Renal Vein Thrombosis',                                     'RENAL VEIN THROMBOSIS'),
    ('Hepatorenal Syndrome',                                      'HEPATORENAL SYNDROME'),
    ('Cardiorenal Syndrome',                                      'CARDIORENAL SYNDROME'),

    -- Nephrology & Urology — Urinary Tract Infections & Inflammation
    ('Acute Pyelonephritis',                                      'ACUTE PYELONEPHRITIS'),
    ('Chronic Pyelonephritis',                                    'CHRONIC PYELONEPHRITIS'),
    ('Cystitis',                                                  'CYSTITIS'),
    ('Urethritis',                                                'URETHRITIS'),
    ('Renal Abscess',                                             'RENAL ABSCESS'),
    ('Perinephric Abscess',                                       'PERINEPHRIC ABSCESS'),
    ('Renal Tuberculosis',                                        'RENAL TUBERCULOSIS'),
    ('Interstitial Cystitis (Bladder Pain Syndrome)',             'INTERSTITIAL CYSTITIS (BLADDER PAIN SYNDROME)'),
    ('Malakoplakia',                                              'MALAKOPLAKIA'),

    -- Nephrology & Urology — Urolithiasis & Obstruction
    ('Nephrolithiasis',                                           'NEPHROLITHIASIS'),
    ('Calcium Oxalate Stones',                                    'CALCIUM OXALATE STONES'),
    ('Calcium Phosphate Stones',                                  'CALCIUM PHOSPHATE STONES'),
    ('Uric Acid Stones',                                          'URIC ACID STONES'),
    ('Struvite Stones',                                           'STRUVITE STONES'),
    ('Cystine Stones',                                            'CYSTINE STONES'),
    ('Ureterolithiasis',                                          'URETEROLITHIASIS'),
    ('Cystolithiasis',                                            'CYSTOLITHIASIS'),
    ('Hydronephrosis',                                            'HYDRONEPHROSIS'),
    ('Ureteropelvic Junction (UPJ) Obstruction',                  'URETEROPELVIC JUNCTION (UPJ) OBSTRUCTION'),
    ('Retroperitoneal Fibrosis',                                  'RETROPERITONEAL FIBROSIS'),
    ('Neurogenic Bladder',                                        'NEUROGENIC BLADDER'),
    ('Posterior Urethral Valves',                                 'POSTERIOR URETHRAL VALVES'),

    -- Nephrology & Urology — Prostatic & Scrotal Disorders
    ('Benign Prostatic Hyperplasia (BPH)',                        'BENIGN PROSTATIC HYPERPLASIA (BPH)'),
    ('Acute Bacterial Prostatitis',                               'ACUTE BACTERIAL PROSTATITIS'),
    ('Chronic Prostatitis',                                       'CHRONIC PROSTATITIS'),
    ('Prostatic Abscess',                                         'PROSTATIC ABSCESS'),
    ('Hydrocele',                                                 'HYDROCELE'),
    ('Varicocele',                                                'VARICOCELE'),
    ('Spermatocele',                                              'SPERMATOCELE'),
    ('Epididymitis',                                              'EPIDIDYMITIS'),
    ('Orchitis',                                                  'ORCHITIS'),
    ('Testicular Torsion',                                        'TESTICULAR TORSION'),
    ('Cryptorchidism',                                            'CRYPTORCHIDISM'),
    ('Phimosis',                                                  'PHIMOSIS'),
    ('Paraphimosis',                                              'PARAPHIMOSIS'),
    ('Priapism',                                                  'PRIAPISM'),
    ('Erectile Dysfunction',                                      'ERECTILE DYSFUNCTION'),

    -- Nephrology & Urology — Cystic & Congenital Anomalies
    ('Autosomal Dominant Polycystic Kidney Disease (ADPKD)',      'AUTOSOMAL DOMINANT POLYCYSTIC KIDNEY DISEASE (ADPKD)'),
    ('Autosomal Recessive Polycystic Kidney Disease (ARPKD)',     'AUTOSOMAL RECESSIVE POLYCYSTIC KIDNEY DISEASE (ARPKD)'),
    ('Medullary Sponge Kidney',                                   'MEDULLARY SPONGE KIDNEY'),
    ('Multicystic Dysplastic Kidney',                             'MULTICYSTIC DYSPLASTIC KIDNEY'),
    ('Horseshoe Kidney',                                          'HORSESHOE KIDNEY'),
    ('Renal Agenesis',                                            'RENAL AGENESIS'),
    ('Ectopic Kidney',                                            'ECTOPIC KIDNEY'),
    ('Vesicoureteral Reflux (VUR)',                               'VESICOURETERAL REFLUX (VUR)'),

    -- Nephrology & Urology — Neoplasms
    ('Renal Cell Carcinoma',                                      'RENAL CELL CARCINOMA'),
    ('Clear Cell Renal Carcinoma',                                'CLEAR CELL RENAL CARCINOMA'),
    ('Papillary Renal Cell Carcinoma',                            'PAPILLARY RENAL CELL CARCINOMA'),
    ('Chromophobe Renal Cell Carcinoma',                          'CHROMOPHOBE RENAL CELL CARCINOMA'),
    ('Transitional Cell Carcinoma (Urothelial Carcinoma)',        'TRANSITIONAL CELL CARCINOMA (UROTHELIAL CARCINOMA)'),
    ('Prostate Adenocarcinoma',                                   'PROSTATE ADENOCARCINOMA'),
    ('Testicular Germ Cell Tumor',                                'TESTICULAR GERM CELL TUMOR'),
    ('Seminoma',                                                  'SEMINOMA'),
    ('Non-Seminoma Testicular Tumor',                             'NON-SEMINOMA TESTICULAR TUMOR'),
    ('Wilms Tumor (Nephroblastoma)',                              'WILMS TUMOR (NEPHROBLASTOMA)'),
    ('Renal Angiomyolipoma',                                      'RENAL ANGIOMYOLIPOMA'),
    ('Renal Oncocytoma',                                          'RENAL ONCOCYTOMA'),

    -- Cardiology — Ischemic Heart Disease
    ('Stable Angina Pectoris',                                    'STABLE ANGINA PECTORIS'),
    ('Unstable Angina',                                           'UNSTABLE ANGINA'),
    ('Acute Myocardial Infarction (STEMI)',                       'ACUTE MYOCARDIAL INFARCTION (STEMI)'),
    ('Acute Myocardial Infarction (NSTEMI)',                      'ACUTE MYOCARDIAL INFARCTION (NSTEMI)'),
    ('Type 2 Myocardial Infarction',                              'TYPE 2 MYOCARDIAL INFARCTION'),
    ('Microvascular Angina',                                      'MICROVASCULAR ANGINA'),
    ('Ischemic Cardiomyopathy',                                   'ISCHEMIC CARDIOMYOPATHY'),
    ('Sudden Cardiac Death',                                      'SUDDEN CARDIAC DEATH'),

    -- Cardiology — Heart Failure & Myopathies
    ('Heart Failure with Reduced Ejection Fraction (HFrEF)',      'HEART FAILURE WITH REDUCED EJECTION FRACTION (HFREF)'),
    ('Heart Failure with Preserved Ejection Fraction (HFpEF)',    'HEART FAILURE WITH PRESERVED EJECTION FRACTION (HFPEF)'),
    ('Dilated Cardiomyopathy',                                    'DILATED CARDIOMYOPATHY'),
    ('Hypertrophic Obstructive Cardiomyopathy (HOCM)',            'HYPERTROPHIC OBSTRUCTIVE CARDIOMYOPATHY (HOCM)'),
    ('Restrictive Cardiomyopathy',                                'RESTRICTIVE CARDIOMYOPATHY'),
    ('Arrhythmogenic Right Ventricular Dysplasia (ARVD)',         'ARRHYTHMOGENIC RIGHT VENTRICULAR DYSPLASIA (ARVD)'),
    ('Acute Decompensated Heart Failure',                         'ACUTE DECOMPENSATED HEART FAILURE'),
    ('Cor Pulmonale',                                             'COR PULMONALE'),

    -- Cardiology — Arrhythmias & Conduction
    ('Atrial Fibrillation',                                       'ATRIAL FIBRILLATION'),
    ('Atrial Flutter',                                            'ATRIAL FLUTTER'),
    ('Paroxysmal Supraventricular Tachycardia (PSVT)',            'PAROXYSMAL SUPRAVENTRICULAR TACHYCARDIA (PSVT)'),
    ('Ventricular Tachycardia',                                   'VENTRICULAR TACHYCARDIA'),
    ('Ventricular Fibrillation',                                  'VENTRICULAR FIBRILLATION'),
    ('Premature Ventricular Contractions (PVC)',                  'PREMATURE VENTRICULAR CONTRACTIONS (PVC)'),
    ('Sinus Bradycardia',                                         'SINUS BRADYCARDIA'),
    ('Sick Sinus Syndrome',                                       'SICK SINUS SYNDROME'),
    ('First Degree Atrioventricular Block',                       'FIRST DEGREE ATRIOVENTRICULAR BLOCK'),
    ('Second Degree Atrioventricular Block',                      'SECOND DEGREE ATRIOVENTRICULAR BLOCK'),
    ('Third Degree Atrioventricular Block',                       'THIRD DEGREE ATRIOVENTRICULAR BLOCK'),
    ('Left Bundle Branch Block',                                  'LEFT BUNDLE BRANCH BLOCK'),
    ('Right Bundle Branch Block',                                 'RIGHT BUNDLE BRANCH BLOCK'),
    ('Wolff-Parkinson-White (WPW) Syndrome',                      'WOLFF-PARKINSON-WHITE (WPW) SYNDROME'),
    ('Long QT Syndrome',                                          'LONG QT SYNDROME'),
    ('Brugada Syndrome',                                          'BRUGADA SYNDROME'),

    -- Cardiology — Valvular Heart Diseases
    ('Aortic Stenosis',                                           'AORTIC STENOSIS'),
    ('Aortic Regurgitation',                                      'AORTIC REGURGITATION'),
    ('Mitral Stenosis',                                           'MITRAL STENOSIS'),
    ('Mitral Regurgitation',                                      'MITRAL REGURGITATION'),
    ('Mitral Valve Prolapse',                                     'MITRAL VALVE PROLAPSE'),
    ('Tricuspid Regurgitation',                                   'TRICUSPID REGURGITATION'),
    ('Tricuspid Stenosis',                                        'TRICUSPID STENOSIS'),
    ('Pulmonary Stenosis',                                        'PULMONARY STENOSIS'),
    ('Infective Endocarditis',                                    'INFECTIVE ENDOCARDITIS'),
    ('Rheumatic Heart Disease',                                   'RHEUMATIC HEART DISEASE'),
    ('Calcific Aortic Valve Disease',                             'CALCIFIC AORTIC VALVE DISEASE'),

    -- Cardiology — Pericardial & Myocardial Inflammation
    ('Acute Pericarditis',                                        'ACUTE PERICARDITIS'),
    ('Chronic Constrictive Pericarditis',                         'CHRONIC CONSTRICTIVE PERICARDITIS'),
    ('Pericardial Effusion',                                      'PERICARDIAL EFFUSION'),
    ('Cardiac Tamponade',                                         'CARDIAC TAMPONADE'),
    ('Acute Myocarditis',                                         'ACUTE MYOCARDITIS'),
    ('Myopericarditis',                                           'MYOPERICARDITIS'),

    -- Cardiology — Vascular & Aortic Disorders
    ('Essential Hypertension',                                    'ESSENTIAL HYPERTENSION'),
    ('Secondary Hypertension',                                    'SECONDARY HYPERTENSION'),
    ('Hypertensive Urgency',                                      'HYPERTENSIVE URGENCY'),
    ('Hypertensive Emergency',                                    'HYPERTENSIVE EMERGENCY'),
    ('Abdominal Aortic Aneurysm (AAA)',                           'ABDOMINAL AORTIC ANEURYSM (AAA)'),
    ('Thoracic Aortic Aneurysm',                                  'THORACIC AORTIC ANEURYSM'),
    ('Aortic Dissection',                                         'AORTIC DISSECTION'),
    ('Peripheral Artery Disease (PAD)',                           'PERIPHERAL ARTERY DISEASE (PAD)'),
    ('Thromboangiitis Obliterans (Buerger''s Disease)',           'THROMBOANGIITIS OBLITERANS (BUERGER''S DISEASE)'),
    ('Raynaud''s Phenomenon',                                     'RAYNAUD''S PHENOMENON'),
    ('Deep Vein Thrombosis (DVT)',                                'DEEP VEIN THROMBOSIS (DVT)'),
    ('Varicose Veins',                                            'VARICOSE VEINS'),
    ('Chronic Venous Insufficiency',                              'CHRONIC VENOUS INSUFFICIENCY'),
    ('Superficial Thrombophlebitis',                              'SUPERFICIAL THROMBOPHLEBITIS'),

    -- Gastroenterology — Esophageal & Gastric
    ('Gastroesophageal Reflux Disease (GERD)',                    'GASTROESOPHAGEAL REFLUX DISEASE (GERD)'),
    ('Barrett''s Esophagus',                                      'BARRETT''S ESOPHAGUS'),
    ('Achalasia',                                                 'ACHALASIA'),
    ('Esophageal Spasms',                                         'ESOPHAGEAL SPASMS'),
    ('Zenker''s Diverticulum',                                    'ZENKER''S DIVERTICULUM'),
    ('Esophageal Varices',                                        'ESOPHAGEAL VARICES'),
    ('Mallory-Weiss Tear',                                        'MALLORY-WEISS TEAR'),
    ('Acute Gastritis',                                           'ACUTE GASTRITIS'),
    ('Chronic Gastritis',                                         'CHRONIC GASTRITIS'),
    ('Peptic Ulcer Disease',                                      'PEPTIC ULCER DISEASE'),
    ('Gastroparesis',                                             'GASTROPARESIS'),
    ('Zollinger-Ellison Syndrome',                                'ZOLLINGER-ELLISON SYNDROME'),
    ('H. pylori Infection',                                       'H. PYLORI INFECTION'),

    -- Gastroenterology — Intestinal & Colorectal
    ('Celiac Disease',                                            'CELIAC DISEASE'),
    ('Crohn''s Disease',                                          'CROHN''S DISEASE'),
    ('Ulcerative Colitis',                                        'ULCERATIVE COLITIS'),
    ('Irritable Bowel Syndrome (IBS)',                            'IRRITABLE BOWEL SYNDROME (IBS)'),
    ('Diverticulosis',                                            'DIVERTICULOSIS'),
    ('Diverticulitis',                                            'DIVERTICULITIS'),
    ('Acute Appendicitis',                                        'ACUTE APPENDICITIS'),
    ('Small Intestinal Bacterial Overgrowth (SIBO)',              'SMALL INTESTINAL BACTERIAL OVERGROWTH (SIBO)'),
    ('Short Bowel Syndrome',                                      'SHORT BOWEL SYNDROME'),
    ('Ischemic Colitis',                                          'ISCHEMIC COLITIS'),
    ('Intussusception',                                           'INTUSSUSCEPTION'),
    ('Volvulus',                                                  'VOLVULUS'),
    ('Paralytic Ileus',                                           'PARALYTIC ILEUS'),
    ('C. difficile Colitis',                                      'C. DIFFICILE COLITIS'),
    ('Microscopic Colitis',                                       'MICROSCOPIC COLITIS'),
    ('Hemorrhoids',                                               'HEMORRHOIDS'),
    ('Anal Fissure',                                              'ANAL FISSURE'),
    ('Anorectal Abscess',                                         'ANORECTAL ABSCESS'),
    ('Fistula-in-Ano',                                            'FISTULA-IN-ANO'),

    -- Gastroenterology — Liver
    ('Nonalcoholic Fatty Liver Disease (NAFLD)',                  'NONALCOHOLIC FATTY LIVER DISEASE (NAFLD)'),
    ('Metabolic Dysfunction-Associated Steatohepatitis (MASH)',   'METABOLIC DYSFUNCTION-ASSOCIATED STEATOHEPATITIS (MASH)'),
    ('Alcoholic Liver Disease',                                   'ALCOHOLIC LIVER DISEASE'),
    ('Acute Liver Failure',                                       'ACUTE LIVER FAILURE'),
    ('Cirrhosis of the Liver',                                    'CIRRHOSIS OF THE LIVER'),
    ('Portal Hypertension',                                       'PORTAL HYPERTENSION'),
    ('Ascites',                                                   'ASCITES'),
    ('Hepatic Encephalopathy',                                    'HEPATIC ENCEPHALOPATHY'),
    ('Autoimmune Hepatitis',                                      'AUTOIMMUNE HEPATITIS'),
    ('Primary Biliary Cholangitis (PBC)',                         'PRIMARY BILIARY CHOLANGITIS (PBC)'),
    ('Primary Sclerosing Cholangitis (PSC)',                      'PRIMARY SCLEROSING CHOLANGITIS (PSC)'),
    ('Hemochromatosis',                                           'HEMOCHROMATOSIS'),
    ('Wilson''s Disease',                                         'WILSON''S DISEASE'),
    ('Alpha-1 Antitrypsin Deficiency',                            'ALPHA-1 ANTITRYPSIN DEFICIENCY'),
    ('Budd-Chiari Syndrome',                                      'BUDD-CHIARI SYNDROME'),

    -- Gastroenterology — Viral Hepatitis
    ('Acute Hepatitis A',                                         'ACUTE HEPATITIS A'),
    ('Acute Hepatitis B',                                         'ACUTE HEPATITIS B'),
    ('Chronic Hepatitis B',                                       'CHRONIC HEPATITIS B'),
    ('Hepatitis C',                                               'HEPATITIS C'),
    ('Hepatitis D',                                               'HEPATITIS D'),
    ('Hepatitis E',                                               'HEPATITIS E'),

    -- Gastroenterology — Pancreatic & Biliary
    ('Acute Pancreatitis',                                        'ACUTE PANCREATITIS'),
    ('Chronic Pancreatitis',                                      'CHRONIC PANCREATITIS'),
    ('Pancreatic Pseudocyst',                                     'PANCREATIC PSEUDOCYST'),
    ('Cholelithiasis (Gallstones)',                               'CHOLELITHIASIS (GALLSTONES)'),
    ('Cholecystitis',                                             'CHOLECYSTITIS'),
    ('Choledocholithiasis',                                       'CHOLEDOCHOLITHIASIS'),
    ('Acute Cholangitis',                                         'ACUTE CHOLANGITIS'),
    ('Biliary Dyskinesia',                                        'BILIARY DYSKINESIA'),
    ('Gallbladder Polyps',                                        'GALLBLADDER POLYPS'),

    -- Gastroenterology — GI Malignancies
    ('Esophageal Carcinoma',                                      'ESOPHAGEAL CARCINOMA'),
    ('Gastric Adenocarcinoma',                                    'GASTRIC ADENOCARCINOMA'),
    ('Colorectal Adenocarcinoma',                                 'COLORECTAL ADENOCARCINOMA'),
    ('Hepatocellular Carcinoma (HCC)',                            'HEPATOCELLULAR CARCINOMA (HCC)'),
    ('Cholangiocarcinoma',                                        'CHOLANGIOCARCINOMA'),
    ('Pancreatic Adenocarcinoma',                                 'PANCREATIC ADENOCARCINOMA'),
    ('Gastrointestinal Stromal Tumor (GIST)',                     'GASTROINTESTINAL STROMAL TUMOR (GIST)'),
    ('Neuroendocrine Tumor (Carcinoid Syndrome)',                  'NEUROENDOCRINE TUMOR (CARCINOID SYNDROME)'),

    -- Pulmonology — Obstructive Airway
    ('Asthma',                                                    'ASTHMA'),
    ('Allergic Asthma',                                           'ALLERGIC ASTHMA'),
    ('Non-Allergic Asthma',                                       'NON-ALLERGIC ASTHMA'),
    ('Occupational Asthma',                                       'OCCUPATIONAL ASTHMA'),
    ('Cough-Variant Asthma',                                      'COUGH-VARIANT ASTHMA'),
    ('Chronic Obstructive Pulmonary Disease (COPD)',              'CHRONIC OBSTRUCTIVE PULMONARY DISEASE (COPD)'),
    ('Chronic Bronchitis',                                        'CHRONIC BRONCHITIS'),
    ('Emphysema',                                                 'EMPHYSEMA'),
    ('Bronchiectasis',                                            'BRONCHIECTASIS'),
    ('Cystic Fibrosis',                                           'CYSTIC FIBROSIS'),
    ('Alpha-1 Antitrypsin Deficiency Lung Disease',               'ALPHA-1 ANTITRYPSIN DEFICIENCY LUNG DISEASE'),

    -- Pulmonology — Infectious Respiratory
    ('Community-Acquired Pneumonia (CAP)',                        'COMMUNITY-ACQUIRED PNEUMONIA (CAP)'),
    ('Hospital-Acquired Pneumonia (HAP)',                         'HOSPITAL-ACQUIRED PNEUMONIA (HAP)'),
    ('Ventilator-Associated Pneumonia (VAP)',                     'VENTILATOR-ASSOCIATED PNEUMONIA (VAP)'),
    ('Aspiration Pneumonia',                                      'ASPIRATION PNEUMONIA'),
    ('Pulmonary Tuberculosis',                                    'PULMONARY TUBERCULOSIS'),
    ('Miliary Tuberculosis',                                      'MILIARY TUBERCULOSIS'),
    ('Cavitary Tuberculosis',                                     'CAVITARY TUBERCULOSIS'),
    ('Acute Bronchitis',                                          'ACUTE BRONCHITIS'),
    ('Influenza',                                                 'INFLUENZA'),
    ('COVID-19 Acute Respiratory Distress',                       'COVID-19 ACUTE RESPIRATORY DISTRESS'),
    ('Lung Abscess',                                              'LUNG ABSCESS'),

    -- Pulmonology — Interstitial & Restrictive
    ('Idiopathic Pulmonary Fibrosis (IPF)',                       'IDIOPATHIC PULMONARY FIBROSIS (IPF)'),
    ('Sarcoidosis',                                               'SARCOIDOSIS'),
    ('Hypersensitivity Pneumonitis',                              'HYPERSENSITIVITY PNEUMONITIS'),
    ('Asbestosis',                                                'ASBESTOSIS'),
    ('Silicosis',                                                 'SILICOSIS'),
    ('Coal Workers'' Pneumoconiosis',                             'COAL WORKERS'' PNEUMOCONIOSIS'),
    ('Cryptogenic Organizing Pneumonia (COP)',                    'CRYPTOGENIC ORGANIZING PNEUMONIA (COP)'),
    ('Acute Respiratory Distress Syndrome (ARDS)',                'ACUTE RESPIRATORY DISTRESS SYNDROME (ARDS)'),

    -- Pulmonology — Pulmonary Vascular
    ('Pulmonary Embolism (PE)',                                   'PULMONARY EMBOLISM (PE)'),
    ('Pulmonary Arterial Hypertension (PAH)',                     'PULMONARY ARTERIAL HYPERTENSION (PAH)'),
    ('Chronic Thromboembolic Pulmonary Hypertension (CTEPH)',     'CHRONIC THROMBOEMBOLIC PULMONARY HYPERTENSION (CTEPH)'),
    ('Pulmonary Veno-Occlusive Disease',                          'PULMONARY VENO-OCCLUSIVE DISEASE'),
    ('Pulmonary Arteriovenous Malformations',                     'PULMONARY ARTERIOVENOUS MALFORMATIONS'),

    -- Pulmonology — Pleural & Mediastinal
    ('Pleural Effusion',                                          'PLEURAL EFFUSION'),
    ('Exudative Pleural Effusion',                                'EXUDATIVE PLEURAL EFFUSION'),
    ('Transudative Pleural Effusion',                             'TRANSUDATIVE PLEURAL EFFUSION'),
    ('Empyema',                                                   'EMPYEMA'),
    ('Hemothorax',                                                'HEMOTHORAX'),
    ('Chylothorax',                                               'CHYLOTHORAX'),
    ('Spontaneous Pneumothorax',                                  'SPONTANEOUS PNEUMOTHORAX'),
    ('Tension Pneumothorax',                                      'TENSION PNEUMOTHORAX'),
    ('Pleurisy',                                                  'PLEURISY'),
    ('Mediastinitis',                                             'MEDIASTINITIS'),

    -- Pulmonology — Sleep & Ventilatory
    ('Obstructive Sleep Apnea (OSA)',                             'OBSTRUCTIVE SLEEP APNEA (OSA)'),
    ('Central Sleep Apnea',                                       'CENTRAL SLEEP APNEA'),
    ('Obesity Hypoventilation Syndrome',                          'OBESITY HYPOVENTILATION SYNDROME'),
    ('Hyperventilation Syndrome',                                 'HYPERVENTILATION SYNDROME'),

    -- Pulmonology — Thoracic Malignancies
    ('Non-Small Cell Lung Carcinoma',                             'NON-SMALL CELL LUNG CARCINOMA'),
    ('Lung Adenocarcinoma',                                       'LUNG ADENOCARCINOMA'),
    ('Squamous Cell Lung Carcinoma',                              'SQUAMOUS CELL LUNG CARCINOMA'),
    ('Large Cell Lung Carcinoma',                                 'LARGE CELL LUNG CARCINOMA'),
    ('Small Cell Lung Carcinoma',                                 'SMALL CELL LUNG CARCINOMA'),
    ('Bronchial Carcinoid Tumor',                                 'BRONCHIAL CARCINOID TUMOR'),
    ('Malignant Pleural Mesothelioma',                            'MALIGNANT PLEURAL MESOTHELIOMA'),
    ('Thymoma',                                                   'THYMOMA'),

    -- Neurology — Cerebrovascular
    ('Ischemic Stroke',                                           'ISCHEMIC STROKE'),
    ('Transient Ischemic Attack (TIA)',                           'TRANSIENT ISCHEMIC ATTACK (TIA)'),
    ('Intracerebral Hemorrhage',                                  'INTRACEREBRAL HEMORRHAGE'),
    ('Subarachnoid Hemorrhage (SAH)',                             'SUBARACHNOID HEMORRHAGE (SAH)'),
    ('Ruptured Cerebral Aneurysm',                                'RUPTURED CEREBRAL ANEURYSM'),
    ('Arteriovenous Malformation (AVM)',                          'ARTERIOVENOUS MALFORMATION (AVM)'),
    ('Cerebral Venous Sinus Thrombosis',                          'CEREBRAL VENOUS SINUS THROMBOSIS'),

    -- Neurology — Neurodegenerative
    ('Alzheimer''s Disease',                                      'ALZHEIMER''S DISEASE'),
    ('Parkinson''s Disease',                                      'PARKINSON''S DISEASE'),
    ('Amyotrophic Lateral Sclerosis (ALS)',                       'AMYOTROPHIC LATERAL SCLEROSIS (ALS)'),
    ('Huntington''s Disease',                                     'HUNTINGTON''S DISEASE'),
    ('Frontotemporal Dementia',                                   'FRONTOTEMPORAL DEMENTIA'),
    ('Dementia with Lewy Bodies',                                 'DEMENTIA WITH LEWY BODIES'),
    ('Vascular Dementia',                                         'VASCULAR DEMENTIA'),
    ('Progressive Supranuclear Palsy (PSP)',                      'PROGRESSIVE SUPRANUCLEAR PALSY (PSP)'),
    ('Corticobasal Degeneration',                                 'CORTICOBASAL DEGENERATION'),

    -- Neurology — Demyelinating & Autoimmune
    ('Multiple Sclerosis (RRMS)',                                  'MULTIPLE SCLEROSIS (RRMS)'),
    ('Multiple Sclerosis (PPMS)',                                  'MULTIPLE SCLEROSIS (PPMS)'),
    ('Multiple Sclerosis (SPMS)',                                  'MULTIPLE SCLEROSIS (SPMS)'),
    ('Acute Disseminated Encephalomyelitis (ADEM)',               'ACUTE DISSEMINATED ENCEPHALOMYELITIS (ADEM)'),
    ('Neuromyelitis Optica Spectrum Disorder (NMOSD)',            'NEUROMYELITIS OPTICA SPECTRUM DISORDER (NMOSD)'),
    ('Guillain-Barré Syndrome (GBS)',                             'GUILLAIN-BARRÉ SYNDROME (GBS)'),
    ('Chronic Inflammatory Demyelinating Polyneuropathy (CIDP)',  'CHRONIC INFLAMMATORY DEMYELINATING POLYNEUROPATHY (CIDP)'),
    ('Myasthenia Gravis',                                         'MYASTHENIA GRAVIS'),
    ('Lambert-Eaton Myasthenic Syndrome',                         'LAMBERT-EATON MYASTHENIC SYNDROME'),

    -- Neurology — Epilepsy & Paroxysmal
    ('Focal Epilepsy',                                            'FOCAL EPILEPSY'),
    ('Generalized Epilepsy',                                      'GENERALIZED EPILEPSY'),
    ('Status Epilepticus',                                        'STATUS EPILEPTICUS'),
    ('Absence Seizures',                                          'ABSENCE SEIZURES'),
    ('Myoclonic Seizures',                                        'MYOCLONIC SEIZURES'),
    ('Febrile Seizures',                                          'FEBRILE SEIZURES'),
    ('Non-Epileptic Seizures',                                    'NON-EPILEPTIC SEIZURES'),
    ('Migraine with Aura',                                        'MIGRAINE WITH AURA'),
    ('Migraine without Aura',                                     'MIGRAINE WITHOUT AURA'),
    ('Cluster Headaches',                                         'CLUSTER HEADACHES'),
    ('Tension Headaches',                                         'TENSION HEADACHES'),
    ('Trigeminal Neuralgia',                                      'TRIGEMINAL NEURALGIA'),
    ('Idiopathic Intracranial Hypertension (Pseudotumor Cerebri)','IDIOPATHIC INTRACRANIAL HYPERTENSION (PSEUDOTUMOR CEREBRI)'),

    -- Neurology — CNS Infections
    ('Acute Bacterial Meningitis',                                'ACUTE BACTERIAL MENINGITIS'),
    ('Viral Meningitis',                                          'VIRAL MENINGITIS'),
    ('Fungal Meningitis',                                         'FUNGAL MENINGITIS'),
    ('Tuberculous Meningitis',                                    'TUBERCULOUS MENINGITIS'),
    ('Viral Encephalitis',                                        'VIRAL ENCEPHALITIS'),
    ('Herpes Simplex Encephalitis',                               'HERPES SIMPLEX ENCEPHALITIS'),
    ('Brain Abscess',                                             'BRAIN ABSCESS'),
    ('Neurocysticercosis',                                        'NEUROCYSTICERCOSIS'),
    ('Creutzfeldt-Jakob Disease',                                 'CREUTZFELDT-JAKOB DISEASE'),

    -- Neurology — Neuromuscular & Spinal Cord
    ('Cervical Radiculopathy',                                    'CERVICAL RADICULOPATHY'),
    ('Lumbar Sciatica',                                           'LUMBAR SCIATICA'),
    ('Spinal Stenosis',                                           'SPINAL STENOSIS'),
    ('Cauda Equina Syndrome',                                     'CAUDA EQUINA SYNDROME'),
    ('Central Cord Syndrome',                                     'CENTRAL CORD SYNDROME'),
    ('Brown-Séquard Syndrome',                                    'BROWN-SÉQUARD SYNDROME'),
    ('Diabetic Peripheral Neuropathy',                            'DIABETIC PERIPHERAL NEUROPATHY'),
    ('Carpal Tunnel Syndrome',                                    'CARPAL TUNNEL SYNDROME'),
    ('Bell''s Palsy',                                             'BELL''S PALSY'),
    ('Complex Regional Pain Syndrome (CRPS)',                     'COMPLEX REGIONAL PAIN SYNDROME (CRPS)'),

    -- Neurology — CNS Tumors
    ('Glioblastoma Multiforme',                                   'GLIOBLASTOMA MULTIFORME'),
    ('Astrocytoma',                                               'ASTROCYTOMA'),
    ('Oligodendroglioma',                                         'OLIGODENDROGLIOMA'),
    ('Ependymoma',                                                'EPENDYMOMA'),
    ('Meningioma',                                                'MENINGIOMA'),
    ('Pituitary Adenoma',                                         'PITUITARY ADENOMA'),
    ('Acoustic Neuroma (Vestibular Schwannoma)',                   'ACOUSTIC NEUROMA (VESTIBULAR SCHWANNOMA)'),
    ('Medulloblastoma',                                           'MEDULLOBLASTOMA'),
    ('Brain Metastases',                                          'BRAIN METASTASES'),

    -- Endocrinology — Glucose Metabolism
    ('Type 1 Diabetes Mellitus',                                  'TYPE 1 DIABETES MELLITUS'),
    ('Type 2 Diabetes Mellitus',                                  'TYPE 2 DIABETES MELLITUS'),
    ('Latent Autoimmune Diabetes in Adults (LADA)',               'LATENT AUTOIMMUNE DIABETES IN ADULTS (LADA)'),
    ('Maturity-Onset Diabetes of the Young (MODY)',               'MATURITY-ONSET DIABETES OF THE YOUNG (MODY)'),
    ('Gestational Diabetes',                                      'GESTATIONAL DIABETES'),
    ('Diabetic Ketoacidosis (DKA)',                               'DIABETIC KETOACIDOSIS (DKA)'),
    ('Hyperosmolar Hyperglycemic State (HHS)',                    'HYPEROSMOLAR HYPERGLYCEMIC STATE (HHS)'),
    ('Hypoglycemia',                                              'HYPOGLYCEMIA'),
    ('Insulinoma',                                                'INSULINOMA'),

    -- Endocrinology — Thyroid
    ('Primary Hypothyroidism',                                    'PRIMARY HYPOTHYROIDISM'),
    ('Hashimoto''s Thyroiditis',                                  'HASHIMOTO''S THYROIDITIS'),
    ('Graves'' Disease',                                          'GRAVES'' DISEASE'),
    ('Toxic Multinodular Goiter',                                 'TOXIC MULTINODULAR GOITER'),
    ('Thyroid Storm',                                             'THYROID STORM'),
    ('Myxedema Coma',                                             'MYXEDEMA COMA'),
    ('Subacute Thyroiditis',                                      'SUBACUTE THYROIDITIS'),
    ('Papillary Thyroid Carcinoma',                               'PAPILLARY THYROID CARCINOMA'),
    ('Follicular Thyroid Carcinoma',                              'FOLLICULAR THYROID CARCINOMA'),
    ('Medullary Thyroid Carcinoma',                               'MEDULLARY THYROID CARCINOMA'),
    ('Anaplastic Thyroid Carcinoma',                              'ANAPLASTIC THYROID CARCINOMA'),

    -- Endocrinology — Adrenal
    ('Cushing''s Syndrome',                                       'CUSHING''S SYNDROME'),
    ('Primary Adrenal Insufficiency (Addison''s Disease)',        'PRIMARY ADRENAL INSUFFICIENCY (ADDISON''S DISEASE)'),
    ('Secondary Adrenal Insufficiency',                           'SECONDARY ADRENAL INSUFFICIENCY'),
    ('Congenital Adrenal Hyperplasia (CAH)',                      'CONGENITAL ADRENAL HYPERPLASIA (CAH)'),
    ('Primary Aldosteronism (Conn''s Syndrome)',                  'PRIMARY ALDOSTERONISM (CONN''S SYNDROME)'),
    ('Pheochromocytoma',                                          'PHEOCHROMOCYTOMA'),
    ('Adrenocortical Carcinoma',                                  'ADRENOCORTICAL CARCINOMA'),

    -- Endocrinology — Pituitary & Hypothalamic
    ('Prolactinoma',                                              'PROLACTINOMA'),
    ('Acromegaly',                                                'ACROMEGALY'),
    ('Gigantism',                                                 'GIGANTISM'),
    ('Cushing''s Disease',                                        'CUSHING''S DISEASE'),
    ('Central Diabetes Insipidus',                                'CENTRAL DIABETES INSIPIDUS'),
    ('Nephrogenic Diabetes Insipidus',                            'NEPHROGENIC DIABETES INSIPIDUS'),
    ('Syndrome of Inappropriate Antidiuretic Hormone (SIADH)',    'SYNDROME OF INAPPROPRIATE ANTIDIURETIC HORMONE (SIADH)'),
    ('Hypopituitarism',                                           'HYPOPITUITARISM'),
    ('Sheehan''s Syndrome',                                       'SHEEHAN''S SYNDROME'),
    ('Pituitary Apoplexy',                                        'PITUITARY APOPLEXY'),

    -- Endocrinology — Bone & Parathyroid
    ('Primary Hyperparathyroidism',                               'PRIMARY HYPERPARATHYROIDISM'),
    ('Secondary Hyperparathyroidism',                             'SECONDARY HYPERPARATHYROIDISM'),
    ('Tertiary Hyperparathyroidism',                              'TERTIARY HYPERPARATHYROIDISM'),
    ('Hypoparathyroidism',                                        'HYPOPARATHYROIDISM'),
    ('Osteoporosis',                                              'OSTEOPOROSIS'),
    ('Osteopenia',                                                'OSTEOPENIA'),
    ('Osteomalacia',                                              'OSTEOMALACIA'),
    ('Rickets',                                                   'RICKETS'),
    ('Paget''s Disease of Bone',                                  'PAGET''S DISEASE OF BONE'),
    ('Renal Osteodystrophy',                                      'RENAL OSTEODYSTROPHY'),

    -- Endocrinology — Metabolic & Lipid
    ('Familial Hypercholesterolemia',                             'FAMILIAL HYPERCHOLESTEROLEMIA'),
    ('Mixed Dyslipidemia',                                        'MIXED DYSLIPIDEMIA'),
    ('Hypertriglyceridemia',                                      'HYPERTRIGLYCERIDEMIA'),
    ('Metabolic Syndrome',                                        'METABOLIC SYNDROME'),
    ('Gout',                                                      'GOUT'),
    ('Primary Hyperoxaluria',                                     'PRIMARY HYPEROXALURIA'),
    ('Acute Intermittent Porphyria',                              'ACUTE INTERMITTENT PORPHYRIA'),
    ('Amyloidosis',                                               'AMYLOIDOSIS'),

    -- Hematology — Anemias & Red Cell
    ('Iron Deficiency Anemia',                                    'IRON DEFICIENCY ANEMIA'),
    ('Vitamin B12 Deficiency Anemia (Pernicious Anemia)',         'VITAMIN B12 DEFICIENCY ANEMIA (PERNICIOUS ANEMIA)'),
    ('Folate Deficiency Anemia',                                  'FOLATE DEFICIENCY ANEMIA'),
    ('Anemia of Chronic Disease',                                 'ANEMIA OF CHRONIC DISEASE'),
    ('Aplastic Anemia',                                           'APLASTIC ANEMIA'),
    ('Sickle Cell Disease',                                       'SICKLE CELL DISEASE'),
    ('Beta-Thalassemia Major',                                    'BETA-THALASSEMIA MAJOR'),
    ('Beta-Thalassemia Minor',                                    'BETA-THALASSEMIA MINOR'),
    ('Alpha-Thalassemia',                                         'ALPHA-THALASSEMIA'),
    ('G6PD Deficiency',                                           'G6PD DEFICIENCY'),
    ('Hereditary Spherocytosis',                                  'HEREDITARY SPHEROCYTOSIS'),
    ('Autoimmune Hemolytic Anemia',                               'AUTOIMMUNE HEMOLYTIC ANEMIA'),
    ('Polycythemia Vera',                                         'POLYCYTHEMIA VERA'),

    -- Hematology — Coagulation & Platelet
    ('Immune Thrombocytopenic Purpura (ITP)',                     'IMMUNE THROMBOCYTOPENIC PURPURA (ITP)'),
    ('Thrombotic Thrombocytopenic Purpura (TTP)',                 'THROMBOTIC THROMBOCYTOPENIC PURPURA (TTP)'),
    ('Hemolytic Uremic Syndrome (HUS)',                           'HEMOLYTIC UREMIC SYNDROME (HUS)'),
    ('Disseminated Intravascular Coagulation (DIC)',              'DISSEMINATED INTRAVASCULAR COAGULATION (DIC)'),
    ('Hemophilia A',                                              'HEMOPHILIA A'),
    ('Hemophilia B',                                              'HEMOPHILIA B'),
    ('von Willebrand Disease',                                    'VON WILLEBRAND DISEASE'),
    ('Heparin-Induced Thrombocytopenia (HIT)',                    'HEPARIN-INDUCED THROMBOCYTOPENIA (HIT)'),
    ('Factor V Leiden Mutation',                                  'FACTOR V LEIDEN MUTATION'),
    ('Antiphospholipid Syndrome',                                 'ANTIPHOSPHOLIPID SYNDROME'),

    -- Hematology — Leukemias
    ('Acute Myeloid Leukemia (AML)',                              'ACUTE MYELOID LEUKEMIA (AML)'),
    ('Acute Lymphoblastic Leukemia (ALL)',                        'ACUTE LYMPHOBLASTIC LEUKEMIA (ALL)'),
    ('Chronic Myeloid Leukemia (CML)',                            'CHRONIC MYELOID LEUKEMIA (CML)'),
    ('Chronic Lymphocytic Leukemia (CLL)',                        'CHRONIC LYMPHOCYTIC LEUKEMIA (CLL)'),
    ('Myelodysplastic Syndromes (MDS)',                           'MYELODYSPLASTIC SYNDROMES (MDS)'),
    ('Essential Thrombocythemia',                                 'ESSENTIAL THROMBOCYTHEMIA'),
    ('Primary Myelofibrosis',                                     'PRIMARY MYELOFIBROSIS'),

    -- Hematology — Lymphomas & Plasma Cell
    ('Hodgkin Lymphoma',                                          'HODGKIN LYMPHOMA'),
    ('Non-Hodgkin Lymphoma',                                      'NON-HODGKIN LYMPHOMA'),
    ('Diffuse Large B-Cell Lymphoma',                             'DIFFUSE LARGE B-CELL LYMPHOMA'),
    ('Follicular Lymphoma',                                       'FOLLICULAR LYMPHOMA'),
    ('Mantle Cell Lymphoma',                                      'MANTLE CELL LYMPHOMA'),
    ('Burkitt Lymphoma',                                          'BURKITT LYMPHOMA'),
    ('T-Cell Lymphoma',                                           'T-CELL LYMPHOMA'),
    ('Multiple Myeloma',                                          'MULTIPLE MYELOMA'),
    ('Monoclonal Gammopathy of Undetermined Significance (MGUS)', 'MONOCLONAL GAMMOPATHY OF UNDETERMINED SIGNIFICANCE (MGUS)'),
    ('Waldenström Macroglobulinemia',                             'WALDENSTRÖM MACROGLOBULINEMIA'),

    -- Hematology — Solid Organ Malignancies
    ('Breast Adenocarcinoma (Invasive Ductal)',                   'BREAST ADENOCARCINOMA (INVASIVE DUCTAL)'),
    ('Breast Adenocarcinoma (Invasive Lobular)',                  'BREAST ADENOCARCINOMA (INVASIVE LOBULAR)'),
    ('Malignant Melanoma',                                        'MALIGNANT MELANOMA'),
    ('Basal Cell Carcinoma',                                      'BASAL CELL CARCINOMA'),
    ('Squamous Cell Skin Carcinoma',                              'SQUAMOUS CELL SKIN CARCINOMA'),
    ('Head and Neck Squamous Cell Carcinoma',                     'HEAD AND NECK SQUAMOUS CELL CARCINOMA'),
    ('Osteosarcoma',                                              'OSTEOSARCOMA'),
    ('Chondrosarcoma',                                            'CHONDROSARCOMA'),
    ('Ewing Sarcoma',                                             'EWING SARCOMA'),
    ('Leiomyosarcoma',                                            'LEIOMYOSARCOMA'),
    ('Liposarcoma',                                               'LIPOSARCOMA'),

    -- Rheumatology — Systemic Autoimmune Connective Tissue
    ('Systemic Lupus Erythematosus (SLE)',                        'SYSTEMIC LUPUS ERYTHEMATOSUS (SLE)'),
    ('Rheumatoid Arthritis',                                      'RHEUMATOID ARTHRITIS'),
    ('Sjogren''s Syndrome',                                       'SJOGREN''S SYNDROME'),
    ('Systemic Sclerosis (Scleroderma)',                          'SYSTEMIC SCLEROSIS (SCLERODERMA)'),
    ('Limited Systemic Sclerosis (CREST Syndrome)',               'LIMITED SYSTEMIC SCLEROSIS (CREST SYNDROME)'),
    ('Polymyositis',                                              'POLYMYOSITIS'),
    ('Dermatomyositis',                                           'DERMATOMYOSITIS'),
    ('Mixed Connective Tissue Disease (MCTD)',                    'MIXED CONNECTIVE TISSUE DISEASE (MCTD)'),

    -- Rheumatology — Spondyloarthropathies
    ('Ankylosing Spondylitis',                                    'ANKYLOSING SPONDYLITIS'),
    ('Psoriatic Arthritis',                                       'PSORIATIC ARTHRITIS'),
    ('Reactive Arthritis (Reiter''s Syndrome)',                   'REACTIVE ARTHRITIS (REITER''S SYNDROME)'),
    ('Enteropathic Arthritis',                                    'ENTEROPATHIC ARTHRITIS'),
    ('Juvenile Idiopathic Arthritis',                             'JUVENILE IDIOPATHIC ARTHRITIS'),

    -- Rheumatology — Vasculitides
    ('Giant Cell Arteritis (Temporal Arteritis)',                 'GIANT CELL ARTERITIS (TEMPORAL ARTERITIS)'),
    ('Takayasu''s Arteritis',                                     'TAKAYASU''S ARTERITIS'),
    ('Polyarteritis Nodosa',                                      'POLYARTERITIS NODOSA'),
    ('Kawasaki Disease',                                          'KAWASAKI DISEASE'),
    ('Granulomatosis with Polyangiitis (Wegener''s)',             'GRANULOMATOSIS WITH POLYANGIITIS (WEGENER''S)'),
    ('Eosinophilic Granulomatosis with Polyangiitis (Churg-Strauss)', 'EOSINOPHILIC GRANULOMATOSIS WITH POLYANGIITIS (CHURG-STRAUSS)'),
    ('Microscopic Polyangiitis',                                  'MICROSCOPIC POLYANGIITIS'),
    ('IgA Vasculitis (Henoch-Schönlein Purpura)',                 'IGA VASCULITIS (HENOCH-SCHÖNLEIN PURPURA)'),
    ('Behçet''s Disease',                                         'BEHÇET''S DISEASE'),

    -- Rheumatology — Immunodeficiencies & Allergies
    ('Severe Combined Immunodeficiency (SCID)',                   'SEVERE COMBINED IMMUNODEFICIENCY (SCID)'),
    ('Common Variable Immunodeficiency (CVID)',                   'COMMON VARIABLE IMMUNODEFICIENCY (CVID)'),
    ('X-Linked Agammaglobulinemia',                               'X-LINKED AGAMMAGLOBULINEMIA'),
    ('Selective IgA Deficiency',                                  'SELECTIVE IGA DEFICIENCY'),
    ('Hereditary Angioedema',                                     'HEREDITARY ANGIOEDEMA'),
    ('Systemic Anaphylaxis',                                      'SYSTEMIC ANAPHYLAXIS'),
    ('Stevens-Johnson Syndrome',                                  'STEVENS-JOHNSON SYNDROME'),
    ('Toxic Epidermal Necrolysis',                                'TOXIC EPIDERMAL NECROLYSIS')
),
hospitals AS (
    SELECT DISTINCT hospital_id FROM hospital_prescriptions
    UNION
    SELECT DISTINCT hospital_id FROM hospital_patients
    UNION
    SELECT DISTINCT hospital_id FROM hospital_doctors
)
INSERT INTO hospital_saved_diagnoses (hospital_id, name, normalized_name)
SELECT h.hospital_id, d.name, d.normalized_name
FROM hospitals h
CROSS JOIN diagnoses d
ON CONFLICT (hospital_id, normalized_name) DO NOTHING;
