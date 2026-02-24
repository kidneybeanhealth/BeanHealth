import { GoogleGenerativeAI } from "@google/generative-ai";
import { MedicalRecord } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Simple cache to avoid re-analyzing identical files
const analysisCache = new Map<string, MedicalRecordWithVitals>();



// Generate a simple hash for file content (for caching)
const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .substring(0, 16);
};

// Create intelligent fallback analysis when quota is exceeded
const createFallbackAnalysis = (file: File): MedicalRecordWithVitals => {
    const fileName = file.name.toLowerCase();
    const today = new Date().toISOString().split("T")[0];

    // Smart type detection based on filename
    let type = "Medical Document";
    if (fileName.includes("lab") || fileName.includes("blood"))
        type = "Lab Report";
    else if (fileName.includes("prescription") || fileName.includes("rx"))
        type = "Prescription";
    else if (fileName.includes("xray") || fileName.includes("x-ray"))
        type = "X-Ray Report";
    else if (fileName.includes("doctor") || fileName.includes("note"))
        type = "Doctor's Note";

    return {
        id: `rec-${Date.now()}`,
        date: today,
        type,
        summary: `${type} uploaded successfully. AI analysis temporarily unavailable - please review the document manually for detailed information.`,
        doctor: "Unknown",
        category: "General"
        // No extractedVitals - only provide when AI actually extracts them
    };
};

// Normalize lab test type to consistent lowercase, underscore-separated code
const normalizeLabTestType = (testType: string): string => {
    if (!testType) return '';

    // Common mappings for standardized test type codes
    const mappings: Record<string, string> = {
        'egfr': 'egfr',
        'gfr': 'egfr',
        'glomerular filtration rate': 'egfr',
        'blood urea nitrogen': 'bun',
        'albumin-creatinine ratio': 'acr',
        'albumin creatinine ratio': 'acr',
        'uacr': 'acr',
        'hba1c': 'hba1c',
        'a1c': 'hba1c',
        'hemoglobin a1c': 'hba1c',
        'glycated hemoglobin': 'hba1c',
        'total cholesterol': 'total_cholesterol',
        'ldl cholesterol': 'ldl',
        'hdl cholesterol': 'hdl',
        'vitamin d': 'vitamin_d',
        '25-oh vitamin d': 'vitamin_d',
        '25-hydroxyvitamin d': 'vitamin_d',
        'vitamin b12': 'vitamin_b12',
        'white blood cell': 'wbc',
        'red blood cell': 'rbc',
        'c-reactive protein': 'crp',
    };

    const normalized = testType.toLowerCase().trim();

    // Check for direct mapping
    if (mappings[normalized]) {
        return mappings[normalized];
    }

    // Otherwise, convert to snake_case
    return normalized
        .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
        .replace(/\s+/g, '_')          // Replace spaces with underscores
        .replace(/_+/g, '_')           // Collapse multiple underscores
        .replace(/^_|_$/g, '');        // Trim leading/trailing underscores
};


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

// Interface for extracted vital signs
export interface ExtractedVitals {
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    temperature?: { value: number; unit: "F" | "C" };
    glucose?: number;
    date: string;
}

// Interface for AI extracted medications
export interface AIExtractedMedication {
    name: string;
    dosage: string;
    unit: string;
    frequency?: string;
    instructions?: string;
}

// Interface for AI extracted case details
export interface AIExtractedCaseDetails {
    primaryCondition?: string;
    latestComplaint?: string;
    medicalHistory?: string[];
}

// Interface for AI extracted lab results (supports any lab type)
export interface AIExtractedLabResult {
    testType: string;      // Can be standard (creatinine, egfr) or custom (vitamin_d, etc)
    testName: string;      // Human-readable name for display
    value: number;
    unit: string;
    referenceMin?: number;
    referenceMax?: number;
    testDate?: string;     // Falls back to document date if not present
}

// Enhanced interface that includes both analysis and vitals
export interface MedicalRecordWithVitals extends MedicalRecord {
    extractedVitals?: ExtractedVitals;
    extractedMedications?: AIExtractedMedication[];
    extractedCaseDetails?: AIExtractedCaseDetails;
    extractedLabResults?: AIExtractedLabResult[];  // NEW: Lab results extraction
}

export const analyzeMedicalRecord = async (
    file: File
): Promise<MedicalRecordWithVitals> => {
    if (!genAI) {
        // Return a default medical record if API key is not available
        return {
            id: Date.now().toString(),
            date: new Date().toISOString().split("T")[0],
            type: "Medical Document",
            summary:
                "Document uploaded (AI analysis unavailable - no API key configured)",
            doctor: "Unknown",
            category: "General",
        };
    }

    // Check cache first to save API quota
    try {
        const fileHash = await generateFileHash(file);
        const cacheKey = `${file.name}-${file.size}-${fileHash}`;

        if (analysisCache.has(cacheKey)) {
            console.log("💾 Using cached analysis result (quota saved!)");
            const cached = analysisCache.get(cacheKey)!;
            return {
                ...cached,
                id: `rec-${Date.now()}`, // Generate new ID for each upload
            };
        }


    } catch (error) {
        // Continue with analysis if cache check fails
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.1, // Lower temperature for more consistent results
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 2048, // Increased for detailed summaries
            },
        });


        const imagePart = await fileToGenerativePart(file);

        const prompt = `You are an expert medical document analyzer. Analyze this medical record thoroughly and extract ALL relevant information.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no explanations):
{
  "date": "YYYY-MM-DD",
  "type": "document type",
  "summary": {
    "Current Issue/Reason for Visit": ["bullet point 1", "bullet point 2"],
    "Medical History": ["history item 1", "history item 2"],
    "Findings/Results": ["finding 1", "finding 2"],
    "Diagnosis": ["diagnosis 1", "diagnosis 2"],
    "Medications/Treatment": ["medication 1", "treatment 1"],
    "Recommendations/Follow-up": ["recommendation 1", "follow-up 1"]
  },
  "doctor": "doctor/facility name",
  "vitals": {
    "bloodPressure": {"systolic": 120, "diastolic": 80},
    "heartRate": 72,
    "temperature": {"value": 98.6, "unit": "F"},
    "glucose": 95
  },
  "medications": [
    {
      "name": "Medication Name",
      "dosage": "10",
      "unit": "mg",
      "frequency": "once daily",
      "instructions": "Take with food"
    }
  ],
  "caseDetails": {
    "primaryCondition": "Main diagnosis or condition",
    "latestComplaint": "Current symptoms or reason for visit",
    "medicalHistory": ["Past condition 1", "Past condition 2"]
  },
  "labResults": [
    {
      "testType": "creatinine",
      "testName": "Creatinine",
      "value": 1.2,
      "unit": "mg/dL",
      "referenceMin": 0.7,
      "referenceMax": 1.3
    }
  ]
}

EXTRACTION INSTRUCTIONS:

1. DATE:
   - Look for: Visit date, report date, test date, consultation date
   - Format: YYYY-MM-DD (convert any date format to this)
   - If multiple dates, use the most recent medical event date
   - If no date found, use today's date

2. TYPE:
   - Choose from: "Lab Report", "Blood Test", "Prescription", "X-Ray Report", "MRI Report", "CT Scan", "Ultrasound", "Doctor's Note", "Discharge Summary", "Vaccination Record", "Medical Image", "Medical Document"
   - Be specific (e.g., prefer "Blood Test" over "Lab Report" if it's specifically blood work)


3. SUMMARY (MOST IMPORTANT - STRUCTURED JSON FORMAT):
   Create a structured JSON object with these sections (only include sections with content):
   
   **Current Issue/Reason for Visit:**
   - Main complaint or purpose of document
   - Presenting symptoms or concerns
   
   **Medical History (if mentioned):**
   - Previous conditions, surgeries, chronic diseases
   - Relevant past medical events
   
   **Findings/Results:**
   - Lab values with reference ranges (e.g., "Hemoglobin: 14.2 g/dL [normal: 13.5-17.5]")
   - Test results, measurements, observations
   - Abnormal findings highlighted
   
   **Diagnosis:**
   - Primary diagnosis or assessment
   - Differential diagnoses if mentioned
   
   **Medications/Treatment:**
   - Prescribed medications with dosages
   - Treatment plan or interventions
   - Instructions given to patient
   
   **Recommendations/Follow-up:**
   - Next steps, follow-up appointments
   - Lifestyle recommendations
   - Warning signs to watch for
   
   Format each section as an array of strings. Only include sections that have relevant content from the document.

4. DOCTOR:
   - Extract: Doctor's full name, credentials (MD, DO, etc.)
   - If no doctor name, look for: Clinic name, hospital name, medical facility
   - Format: "Dr. FirstName LastName, MD" or "Facility Name"
   - Use "Unknown" only if absolutely no provider info found

5. VITALS (Extract ALL available measurements):
   - bloodPressure: Look for BP, blood pressure (e.g., "120/80", "BP 130/85 mmHg")
   - heartRate: HR, pulse, heart rate (e.g., "72 bpm", "Pulse: 80", "HR 75/min")
   - temperature: Temp, temperature (e.g., "98.6°F", "37°C", "36.8C")
   - glucose: Blood sugar, glucose, blood glucose (e.g., "95 mg/dL", "Glucose: 110", "5.5 mmol/L")
   - respiratoryRate: RR, respiratory rate (e.g., "16/min", "RR: 18")
   - oxygenSaturation: SpO2, O2 saturation (e.g., "98%", "SpO2: 97%")
   - weight: Patient weight (e.g., "70 kg", "154 lbs")
   - height: Patient height (e.g., "175 cm", "5'9\"")
   - bmi: Body Mass Index (e.g., "24.5", "BMI: 22.3")
   
   Only include measurements that are explicitly stated in the document.

6. LAB RESULTS (CRITICAL - Extract ALL laboratory test results):
   Extract EVERY lab test found in the document. For each lab result, include:
   - testType: Lowercase, underscore-separated code (e.g., "creatinine", "egfr", "vitamin_d", "hba1c")
   - testName: Human-readable name (e.g., "Creatinine", "eGFR", "Vitamin D", "HbA1c")
   - value: Numeric value only
   - unit: Unit of measurement (e.g., "mg/dL", "mL/min/1.73m²", "ng/mL", "%")
   - referenceMin: Lower bound of normal range if provided
   - referenceMax: Upper bound of normal range if provided
   
   COMMON LAB TESTS TO LOOK FOR:
   - Kidney: Creatinine, eGFR (GFR), BUN (Blood Urea Nitrogen), ACR (Albumin-Creatinine Ratio)
   - Electrolytes: Potassium, Sodium, Chloride, Bicarbonate (CO2), Calcium, Phosphorus, Magnesium
   - Blood: Hemoglobin, Hematocrit, WBC, RBC, Platelets
   - Diabetes: Glucose, HbA1c (A1C), Fasting Glucose
   - Liver: ALT (SGPT), AST (SGOT), Bilirubin, Albumin, ALP
   - Lipids: Total Cholesterol, LDL, HDL, Triglycerides
   - Thyroid: TSH, T3, T4, Free T4
   - Vitamins: Vitamin D (25-OH), Vitamin B12, Folate, Iron, Ferritin
   - Urine: Protein, Microalbumin, Specific Gravity
   - Other: Uric Acid, CRP, ESR, PSA
   
   Extract ALL lab values found, even if not in this list. This is essential for trend tracking.

CRITICAL: Return ONLY the JSON object. No markdown formatting, no code blocks, no explanations.`;

        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        const text = response.text().trim();

        // Enhanced JSON parsing with multiple fallback strategies
        let parsedResult: any = null;

        // Strategy 1: Direct JSON parsing
        try {
            parsedResult = JSON.parse(text);
        } catch (parseError) {
            console.log("Direct JSON parsing failed, trying extraction methods...");

            // Strategy 2: Extract JSON from code blocks
            const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
                try {
                    parsedResult = JSON.parse(codeBlockMatch[1]);
                    console.log("Successfully extracted JSON from code block");
                } catch (e) {
                    console.log("Code block extraction failed");
                }
            }

            // Strategy 3: Find JSON object in text
            if (!parsedResult) {
                const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
                if (jsonMatch) {
                    try {
                        parsedResult = JSON.parse(jsonMatch[0]);
                        console.log("Successfully extracted JSON from text");
                    } catch (e) {
                        console.log("Text extraction failed");
                    }
                }
            }

            // Strategy 4: Try to fix common JSON issues
            if (!parsedResult && text.includes("{") && text.includes("}")) {
                try {
                    let fixedText = text
                        .replace(/'/g, '"') // Replace single quotes with double quotes
                        .replace(/(\w+):/g, '"$1":') // Add quotes around keys
                        .replace(/,\s*}/g, "}") // Remove trailing commas
                        .replace(/,\s*]/g, "]"); // Remove trailing commas in arrays

                    const jsonMatch = fixedText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsedResult = JSON.parse(jsonMatch[0]);
                        console.log("Successfully parsed fixed JSON");
                    }
                } catch (e) {
                    console.log("JSON fixing failed");
                }
            }
        }

        // If all parsing strategies failed, create intelligent fallback
        if (!parsedResult) {
            console.log(
                "All JSON parsing strategies failed, creating intelligent fallback"
            );

            // Try to extract information from the text response
            const dateMatch =
                text.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/) ||
                text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/);
            const doctorMatch =
                text.match(/(?:dr\.?|doctor)\s+([a-z\s]+)/i) ||
                text.match(/([a-z]+,?\s+[a-z]+)\s+(?:md|m\.d\.)/i);

            let extractedDate = new Date().toISOString().split("T")[0];
            if (dateMatch) {
                try {
                    const date = new Date(dateMatch[1]);
                    if (!isNaN(date.getTime())) {
                        extractedDate = date.toISOString().split("T")[0];
                    }
                } catch (e) {
                    console.log("Date extraction failed");
                }
            }

            parsedResult = {
                date: extractedDate,
                type: "Medical Document",
                summary: {
                    "Current Issue/Reason for Visit": [
                        text.length > 0 && text.length < 500
                            ? text.replace(/[{}"\[\]]/g, "").trim()
                            : "Medical document analyzed - please review the uploaded file for details"
                    ]
                },
                doctor: doctorMatch ? doctorMatch[1].trim() : "Unknown",
            };
        }

        // Validate and clean the parsed result
        const cleanResult: MedicalRecordWithVitals = {
            id: `rec-${Date.now()}`,
            date: parsedResult.date || new Date().toISOString().split("T")[0],
            type: parsedResult.type || "Medical Document",
            summary: typeof parsedResult.summary === 'object'
                ? JSON.stringify(parsedResult.summary)
                : (parsedResult.summary || "Medical record analyzed"),
            doctor: parsedResult.doctor || "Unknown",
            category: "General",
        };

        // Extract vitals if present
        if (parsedResult.vitals) {
            const vitals = parsedResult.vitals;
            const hasVitals =
                vitals.bloodPressure ||
                vitals.heartRate ||
                vitals.temperature ||
                vitals.glucose;

            if (hasVitals) {
                cleanResult.extractedVitals = {
                    ...vitals,
                    date: cleanResult.date,
                };
                console.log(
                    "✅ Vitals extracted from combined analysis:",
                    cleanResult.extractedVitals
                );
            }
        }

        // Extract medications if present
        if (parsedResult.medications && Array.isArray(parsedResult.medications) && parsedResult.medications.length > 0) {
            cleanResult.extractedMedications = parsedResult.medications.map((med: any) => ({
                name: med.name || '',
                dosage: med.dosage || '',
                unit: med.unit || 'mg',
                frequency: med.frequency,
                instructions: med.instructions,
            })).filter((med: any) => med.name);

            console.log(
                "💊 Medications extracted from analysis:",
                cleanResult.extractedMedications
            );
        }

        // Extract case details if present
        if (parsedResult.caseDetails) {
            cleanResult.extractedCaseDetails = {
                primaryCondition: parsedResult.caseDetails.primaryCondition,
                latestComplaint: parsedResult.caseDetails.latestComplaint,
                medicalHistory: parsedResult.caseDetails.medicalHistory,
            };

            console.log(
                "📋 Case details extracted from analysis:",
                cleanResult.extractedCaseDetails
            );
        }

        // Extract lab results if present
        if (parsedResult.labResults && Array.isArray(parsedResult.labResults) && parsedResult.labResults.length > 0) {
            cleanResult.extractedLabResults = parsedResult.labResults
                .map((lab: any) => ({
                    testType: normalizeLabTestType(lab.testType || lab.testName || ''),
                    testName: lab.testName || lab.testType || '',
                    value: typeof lab.value === 'number' ? lab.value : parseFloat(lab.value),
                    unit: lab.unit || '',
                    referenceMin: lab.referenceMin,
                    referenceMax: lab.referenceMax,
                    testDate: lab.testDate || cleanResult.date,
                }))
                .filter((lab: any) => lab.testType && !isNaN(lab.value) && lab.unit);

            console.log(
                "🔬 Lab results extracted from analysis:",
                cleanResult.extractedLabResults
            );
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanResult.date)) {
            cleanResult.date = new Date().toISOString().split("T")[0];
        }

        console.log("Final analysis result:", cleanResult);

        // Cache the result to save future API calls
        try {
            const fileHash = await generateFileHash(file);
            const cacheKey = `${file.name}-${file.size}-${fileHash}`;
            analysisCache.set(cacheKey, cleanResult);
            console.log("💾 Analysis result cached for future use");

            // Limit cache size to prevent memory issues
            if (analysisCache.size > 50) {
                const firstKey = analysisCache.keys().next().value;
                analysisCache.delete(firstKey);
            }
        } catch (error) {
            console.log("⚠️ Failed to cache result");
        }

        return cleanResult;
    } catch (error) {
        console.error("Error analyzing medical record:", error);

        // If it's a quota error, use intelligent fallback
        if (error instanceof Error && error.message.includes("429")) {
            return createFallbackAnalysis(file);
        }

        // Return a basic record instead of throwing error to prevent upload failure
        return {
            id: `rec-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            type: "Medical Document",
            summary:
                "Document uploaded successfully. AI analysis encountered an issue - please review the file manually.",
            doctor: "Unknown",
            category: "General",
        };
    }
};

export const getChatResponse = async (
    history: any[],
    newMessage: string
): Promise<string> => {
    if (!genAI) {
        return "AI chat is currently unavailable. Please check your configuration.";
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction:
                "You are a helpful medical assistant for Beanhealth. Your role is to answer user questions about their health data in a clear, concise, and friendly manner. Do not provide medical advice. If asked for medical advice, direct the user to consult with their doctor.",
        });

        const chat = model.startChat({
            history: history,
        });

        const result = await chat.sendMessage(newMessage);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error getting chat response:", error);
        return "I'm sorry, I'm having trouble responding right now. Please try again later.";
    }
};

// Test function to check AI connectivity and response format
export const testAIConnection = async (): Promise<{
    success: boolean;
    message: string;
}> => {
    if (!genAI) {
        return {
            success: false,
            message: "Gemini AI not configured - missing API key",
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(
            'Respond with exactly this JSON: {"test": "success", "message": "AI is working"}'
        );
        const response = await result.response;
        const text = response.text().trim();

        console.log("AI test response:", text);

        try {
            const parsed = JSON.parse(text);
            if (parsed.test === "success") {
                return {
                    success: true,
                    message: "AI connection successful and responding correctly",
                };
            }
        } catch (parseError) {
            // AI responded but not in JSON format
            return {
                success: false,
                message: `AI responded but not in expected format: ${text.substring(
                    0,
                    100
                )}`,
            };
        }

        return {
            success: false,
            message: "AI responded but test failed",
        };
    } catch (error) {
        return {
            success: false,
            message: `AI connection failed: ${error instanceof Error ? error.message : "Unknown error"
                }`,
        };
    }
};

export const summarizeAllRecords = async (
    records: MedicalRecord[]
): Promise<string> => {
    if (!genAI) {
        return "AI summary is currently unavailable. Please check your configuration.";
    }

    if (records.length === 0) {
        return "No records available to summarize.";
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.2, // Lower for more consistent, factual summaries
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1024, // Increased for detailed structured summary
            },
            systemInstruction: `You are an expert medical data analyst creating comprehensive health summaries for patients.

CRITICAL RULES:
1. Create structured, detailed summaries with clear sections
2. Use bullet points for better readability
3. Highlight key findings, trends, and patterns across records
4. Use simple, patient-friendly language
5. NEVER provide medical advice, diagnosis, or treatment recommendations
6. Focus on factual information from the records
7. Identify trends over time (improving, stable, declining)
8. Mention abnormal results or concerning findings
9. Note medication changes or new prescriptions
10. Summarize doctor's recommendations when available`,
        });

        // Sort records by date (most recent first) and limit to most recent 15 for comprehensive analysis
        const sortedRecords = records
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 15);

        // Group records by type for better analysis
        const recordsByType = sortedRecords.reduce((acc, record) => {
            const type = record.type || 'Other';
            if (!acc[type]) acc[type] = [];
            acc[type].push(record);
            return acc;
        }, {} as Record<string, MedicalRecord[]>);

        const prompt = `Analyze these medical records and create a comprehensive health summary:

RECORDS (Most recent first):
${sortedRecords
                .map((r, index) => `
${index + 1}. Date: ${r.date}
   Type: ${r.type}
   Doctor/Facility: ${r.doctor}
   Summary: ${r.summary}
   Category: ${r.category || 'General'}
`)
                .join('\n')}

RECORD TYPES AVAILABLE:
${Object.entries(recordsByType)
                .map(([type, recs]) => `- ${type}: ${recs.length} record(s)`)
                .join('\n')}

CREATE A STRUCTURED SUMMARY WITH THESE SECTIONS:

📋 **Recent Medical Activity:**
- Summarize the most recent visits, tests, or consultations (last 2-3 entries)
- Mention dates and purposes

🏥 **Medical History & Conditions:**
- List any chronic conditions or ongoing health issues mentioned
- Note previous diagnoses or significant medical events
- Include relevant surgical history if mentioned

🔬 **Key Test Results & Findings:**
- Highlight important lab values and their trends
- Mention any abnormal results (with context if available)
- Note imaging results (X-rays, MRIs, etc.)

💊 **Current Medications & Treatments:**
- List prescribed medications with dosages if available
- Mention treatment plans or interventions
- Note any medication changes

📊 **Health Trends & Patterns:**
- Identify improving, stable, or concerning trends
- Compare recent vs. older results when possible
- Mention vital sign patterns (BP, heart rate, etc.)

⚕️ **Doctor's Recommendations:**
- Summarize follow-up instructions
- List lifestyle recommendations
- Note any warning signs mentioned

Use bullet points within each section. Be specific with numbers and measurements. Keep language simple and clear. If a section has no relevant information, write "No information available in current records."`

        const result = await model.generateContent(prompt);
        const response = result.response;
        const summaryText = response.text().trim();

        // Validate and clean the summary
        if (!summaryText || summaryText.length < 10) {
            return generateFallbackSummary(records);
        }

        // Remove any potential medical advice language
        const cleanedSummary = summaryText
            .replace(/\b(should|must|need to|recommend|suggest|advise)\b/gi, "")
            .replace(/\bconsult.*?doctor\b/gi, "")
            .trim();

        return cleanedSummary || generateFallbackSummary(records);
    } catch (error) {
        console.error("Error summarizing records:", error);
        return generateFallbackSummary(records);
    }
};

// Helper function to generate fallback summary
const generateFallbackSummary = (records: MedicalRecord[]): string => {
    const recordCount = records.length;

    if (recordCount === 0) {
        return "No medical records available to summarize.";
    }

    // Sort by date to get the most recent
    const sortedRecords = records.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestRecord = sortedRecords[0];
    const recordTypes = [...new Set(records.map((r) => r.type))];

    if (recordCount === 1) {
        return `Your medical record from ${new Date(
            latestRecord.date
        ).toLocaleDateString()} (${latestRecord.type}) has been documented: ${latestRecord.summary
            }`;
    } else {
        const typesList = recordTypes.slice(0, 3).join(", ");
        return `You have ${recordCount} medical records including ${typesList}. Your most recent entry from ${new Date(
            latestRecord.date
        ).toLocaleDateString()} shows: ${latestRecord.summary}`;
    }
};
