import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Predefined categories for medical records
export const MEDICAL_CATEGORIES = {
  LAB_REPORT: "Lab Report",
  PRESCRIPTION: "Prescription",
  MEDICAL_IMAGE: "Medical Image",
  BLOOD_TEST: "Blood Test",
  XRAY: "X-Ray",
  MRI: "MRI Scan",
  CT_SCAN: "CT Scan",
  ULTRASOUND: "Ultrasound",
  VACCINATION: "Vaccination Record",
  DISCHARGE_SUMMARY: "Discharge Summary",
  DOCTOR_NOTE: "Doctor's Note",
  OTHER: "Other Medical Document"
} as const;

// Cache to avoid re-categorizing identical files
const categorizationCache = new Map<string, string>();

// Generate a simple hash for file metadata (for caching)
const generateFileHash = (file: File): string => {
  return `${file.name}-${file.size}-${file.type}`;
};

// Convert file to base64 for Gemini API
const fileToGenerativePart = async (file: File) => {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(",")[1]);
      } else {
        reject(new Error("Failed to read file as base64 string."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

/**
 * Enhanced filename-based categorization with comprehensive pattern matching
 * Returns { category: string, confidence: 'high' | 'medium' | 'low' }
 */
const smartFilenameCategorization = (file: File): { category: string, confidence: 'high' | 'medium' | 'low' } => {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  // HIGH CONFIDENCE patterns - explicit keywords in filename
  const highConfidencePatterns = [
    // Lab Reports & Blood Tests
    { patterns: ['lab report', 'lab_report', 'labreport', 'laboratory report', 'pathology report'], category: MEDICAL_CATEGORIES.LAB_REPORT },
    { patterns: ['blood test', 'blood_test', 'bloodtest', 'blood work', 'blood_work', 'cbc', 'complete blood count'], category: MEDICAL_CATEGORIES.BLOOD_TEST },
    
    // Prescriptions
    { patterns: ['prescription', 'rx', 'medication list', 'medication_list', 'prescribed', 'drug order'], category: MEDICAL_CATEGORIES.PRESCRIPTION },
    
    // Imaging - X-Ray
    { patterns: ['x-ray', 'xray', 'x ray', 'radiograph', 'chest xray', 'dental xray'], category: MEDICAL_CATEGORIES.XRAY },
    
    // Imaging - MRI
    { patterns: ['mri', 'magnetic resonance', 'brain mri', 'spine mri'], category: MEDICAL_CATEGORIES.MRI },
    
    // Imaging - CT Scan
    { patterns: ['ct scan', 'ct_scan', 'ctscan', 'cat scan', 'computed tomography'], category: MEDICAL_CATEGORIES.CT_SCAN },
    
    // Imaging - Ultrasound
    { patterns: ['ultrasound', 'sonography', 'doppler', 'echo', 'echocardiogram'], category: MEDICAL_CATEGORIES.ULTRASOUND },
    
    // Vaccination
    { patterns: ['vaccination', 'vaccine', 'immunization', 'vaccination record', 'vaccine card'], category: MEDICAL_CATEGORIES.VACCINATION },
    
    // Discharge Summary
    { patterns: ['discharge', 'discharge summary', 'discharge_summary', 'hospital discharge'], category: MEDICAL_CATEGORIES.DISCHARGE_SUMMARY },
    
    // Doctor's Note
    { patterns: ['doctor note', 'doctor\'s note', 'physician note', 'consultation', 'clinical note', 'progress note', 'visit summary'], category: MEDICAL_CATEGORIES.DOCTOR_NOTE },
  ];
  
  // Check high confidence patterns
  for (const { patterns, category } of highConfidencePatterns) {
    if (patterns.some(pattern => fileName.includes(pattern))) {
      return { category, confidence: 'high' };
    }
  }
  
  // MEDIUM CONFIDENCE patterns - partial keywords
  const mediumConfidencePatterns = [
    { patterns: ['lab', 'test result', 'test_result', 'result', 'report'], category: MEDICAL_CATEGORIES.LAB_REPORT },
    { patterns: ['blood', 'serum', 'plasma'], category: MEDICAL_CATEGORIES.BLOOD_TEST },
    { patterns: ['medicine', 'medication', 'drug', 'tablet', 'capsule'], category: MEDICAL_CATEGORIES.PRESCRIPTION },
    { patterns: ['scan', 'imaging'], category: MEDICAL_CATEGORIES.MEDICAL_IMAGE },
    { patterns: ['doctor', 'dr.', 'physician', 'clinic'], category: MEDICAL_CATEGORIES.DOCTOR_NOTE },
  ];
  
  // Check medium confidence patterns
  for (const { patterns, category } of mediumConfidencePatterns) {
    if (patterns.some(pattern => fileName.includes(pattern))) {
      return { category, confidence: 'medium' };
    }
  }
  
  // LOW CONFIDENCE - file type based inference
  if (fileType.startsWith("image/")) {
    return { category: MEDICAL_CATEGORIES.MEDICAL_IMAGE, confidence: 'low' };
  }
  
  return { category: MEDICAL_CATEGORIES.OTHER, confidence: 'low' };
};

/**
 * Categorizes a medical record file using intelligent multi-strategy approach
 * Strategy 1: Check filename (high accuracy if title contains category)
 * Strategy 2: Use AI for visual analysis (when filename is ambiguous)
 * Strategy 3: Fallback to basic patterns
 * 
 * @param file - The medical record file to categorize
 * @returns The category of the medical record
 */
export const categorizeMedicalRecord = async (file: File): Promise<string> => {
  // Check cache first to save API quota
  const fileHash = generateFileHash(file);
  if (categorizationCache.has(fileHash)) {
    console.log("💾 Using cached categorization result");
    return categorizationCache.get(fileHash)!;
  }

  // STRATEGY 1: Smart filename analysis (fastest, most accurate for well-named files)
  const filenameResult = smartFilenameCategorization(file);
  
  // If we have high confidence from filename, use it directly (saves API calls!)
  if (filenameResult.confidence === 'high') {
    console.log(`📄 High-confidence filename match: "${file.name}" → ${filenameResult.category}`);
    categorizationCache.set(fileHash, filenameResult.category);
    return filenameResult.category;
  }

  // STRATEGY 2: AI visual analysis (for medium/low confidence or ambiguous filenames)
  if (!genAI) {
    console.warn("⚠️ No Gemini API key - using filename-based categorization");
    console.log(`📁 Filename categorized "${file.name}" as: ${filenameResult.category} (${filenameResult.confidence} confidence)`);
    return filenameResult.category;
  }

  try {
    console.log(`🤖 Filename confidence: ${filenameResult.confidence} - Using AI for visual verification...`);
    
    // Use gemini-2.5-flash for fast, accurate categorization
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent categorization
        maxOutputTokens: 30, // Slightly increased for better accuracy
      },
    });

    const imagePart = await fileToGenerativePart(file);

    // Enhanced prompt with context from filename analysis
    const prompt = `Analyze this medical document image and categorize it into ONE specific category.

IMPORTANT: Look at headers, titles, document structure, and content.

CATEGORIES (choose the most specific one):
1. Lab Report - Laboratory test results, pathology reports
2. Blood Test - Specifically blood work results (CBC, metabolic panel, etc.)
3. Prescription - Medication prescriptions, drug orders, Rx forms
4. X-Ray - X-ray images or reports with radiographic interpretations
5. MRI Scan - MRI images or reports
6. CT Scan - CT/CAT scan images or reports
7. Ultrasound - Ultrasound/sonography images or reports
8. Vaccination Record - Immunization records, vaccine cards
9. Discharge Summary - Hospital discharge papers
10. Doctor's Note - Consultation notes, progress notes, clinical notes
11. Medical Image - General medical images (if not covered above)
12. Other Medical Document - Any other medical document

${filenameResult.confidence === 'medium' ? `Hint: Filename suggests "${filenameResult.category}" but verify with document content.` : ''}

Return ONLY the category name (e.g., "Lab Report" or "Prescription"):`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text().trim();

    // Parse AI response and match to our categories
    let category = text;
    
    // Find the best matching category
    const categoryValues = Object.values(MEDICAL_CATEGORIES);
    const matchedCategory = categoryValues.find(cat => 
      text.toLowerCase().includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(text.toLowerCase())
    );

    if (matchedCategory) {
      category = matchedCategory;
    } else {
      // If no exact match, try intelligent mapping
      const lowerText = text.toLowerCase();
      if (lowerText.includes("lab")) category = MEDICAL_CATEGORIES.LAB_REPORT;
      else if (lowerText.includes("blood")) category = MEDICAL_CATEGORIES.BLOOD_TEST;
      else if (lowerText.includes("prescription") || lowerText.includes("rx") || lowerText.includes("medication")) category = MEDICAL_CATEGORIES.PRESCRIPTION;
      else if (lowerText.includes("x-ray") || lowerText.includes("xray") || lowerText.includes("radiograph")) category = MEDICAL_CATEGORIES.XRAY;
      else if (lowerText.includes("mri") || lowerText.includes("magnetic")) category = MEDICAL_CATEGORIES.MRI;
      else if (lowerText.includes("ct") || lowerText.includes("cat scan") || lowerText.includes("computed tomography")) category = MEDICAL_CATEGORIES.CT_SCAN;
      else if (lowerText.includes("ultrasound") || lowerText.includes("sonography")) category = MEDICAL_CATEGORIES.ULTRASOUND;
      else if (lowerText.includes("vaccine") || lowerText.includes("immunization")) category = MEDICAL_CATEGORIES.VACCINATION;
      else if (lowerText.includes("discharge")) category = MEDICAL_CATEGORIES.DISCHARGE_SUMMARY;
      else if (lowerText.includes("doctor") || lowerText.includes("note") || lowerText.includes("consultation")) category = MEDICAL_CATEGORIES.DOCTOR_NOTE;
      else if (lowerText.includes("image") || lowerText.includes("scan")) category = MEDICAL_CATEGORIES.MEDICAL_IMAGE;
      else {
        // If AI is uncertain, trust medium-confidence filename match
        if (filenameResult.confidence === 'medium') {
          category = filenameResult.category;
          console.log(`📋 Using filename category due to uncertain AI response`);
        } else {
          category = MEDICAL_CATEGORIES.OTHER;
        }
      }
    }

    // Cache the result
    categorizationCache.set(fileHash, category);
    
    console.log(`✅ Final categorization for "${file.name}": ${category}`);
    return category;

  } catch (error) {
    console.error("Error with AI categorization, using filename-based result:", error);
    console.log(`📁 Filename-based category: ${filenameResult.category} (${filenameResult.confidence} confidence)`);
    return filenameResult.category;
  }
};

/**
 * Clear the categorization cache (useful for testing)
 */
export const clearCategorizationCache = () => {
  categorizationCache.clear();
};
