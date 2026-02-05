# Project Generalization Proposal
## Transitioning BeanHealth from Single-Tenant (KKC) to Multi-Tenant Platform

### 1. Executive Summary
This document outlines the architectural plan to generalize the BeanHealth Enterprise application.  
**Primary Goal:** Enable onboarding of new hospitals immediately without disrupting the live operations of **Kongunad Kidney Centre (KKC)**.
**Strategy:** Implement the **"Tenant Strategy Pattern"**. This allows us to keep KKC's highly specific, hardcoded logic (PDFs, Receipts, Doctor Sorting) isolated in "Legacy Modules" while building a clean, database-driven "Generic Engine" for all future clients.

---

### 2. Architecture: The "Traffic Cop" Pattern

We will verify the Hospital ID at runtime and route the application logic to either the "Custom KKC Module" or the "Generic Module".

**Visual Concept:**
```
User Actions (Print/View PDF) 
       ⬇
[ Traffic Cop Switch ] -> Check Hospital ID
       ⬇
   ------------------
   |                |
[ KKC Module ]   [ Generic Module ]
(Hardcoded)      (Database Driven)
   |                |
"Om Muruga"      "Dynamic Header"
Specific Fonts    User Uploaded Logo
```

---

### 3. Implementation Plan (Component by Component)

#### A. PDF Generation (Prescriptions)
**Current State:** `KKCPDFGenerator` class exists with hardcoded text and Tamil translations.
**Proposed Action:**
1.  **Isolate:** Rename `src/utils/kkcPdfGenerator.ts` to `src/utils/generators/kkcPdfGenerator.ts`.
2.  **Create Generic:** Create `src/utils/generators/GenericPdfGenerator.ts`. This class will accept a `config` object (Hospital Name, Address, Logo URL) in its constructor.
3.  **Router:** Create a factory file `src/utils/PdfGeneratorFactory.ts`:
    ```typescript
    export const getPdfGenerator = (hospitalId: string) => {
        if (hospitalId === KKC_UUID) return new KKCPDFGenerator();
        return new GenericPdfGenerator(hospitalConfig);
    };
    ```

#### B. Token Receipt Printing (Thermal Printer)
**Current State:** `tokenReceiptGenerator.ts` contains "Om Muruga" and specific layout instructions.
**Proposed Action:**
1.  **Refactor:** Rename the main function to `generateKKCReceipt`.
2.  **Create Generic:** Create `generateStandardReceipt`. It will be a clean, logo-free text version using standard ESC/POS commands that work on any 58mm/80mm printer.
3.  **Router:** Export a `getReceiptGenerator(hospitalId)` function (as discussed).

#### C. Prescription Modal UI
**Current State:** `PrescriptionModal.tsx` has hardcoded "KONGUNAD KIDNEY CENTRE" header and specific Tamil input fields.
**Proposed Action:**
1.  **Split:** Move current code to `src/components/prescriptions/templates/KKCPrescriptionModal.tsx`.
2.  **Generic Template:** Create `src/components/prescriptions/templates/GenericPrescriptionModal.tsx`. This version will remove Tamil fields and use the `hospital_profiles.logo_url` for the header.
3.  **Wrapper:** The main `PrescriptionModal.tsx` will simply import both and render one based on `doctor.hospital_id`.

#### D. Doctor Login (Sorting Logic)
**Current State:** `DoctorLogin.tsx` forces "Dr. Prabhakar" and "Dr. Divakar" to the top.
**Proposed Action:**
1.  **Configuration:** Move this logic into a config object or a simple utility function `sortDoctors(doctors, hospitalId)`.
2.  **Logic:**
    ```typescript
    if (hospitalId === KKC_UUID) {
       // Run existing Prabhakar/Divakar sort logic
    } else {
       // Run standard alphabetical sort
    }
    ```

---

### 4. Database Changes (Non-Breaking)
To support the "Generic Module", we need to store the data that was previously hardcoded.

**Table:** `hospital_profiles`
**New Columns to Add:**
*   `logo_url` (Text): URL to the hospital's logo image.
*   `primary_color` (Text): Hex code for branding (e.g., `#003366`).
*   `header_text` (Text): Custom text to display on dashboard/PDFs.
*   `config_flags` (JSON):
    ```json
    {
       "show_religious_symbols": false,
       "printer_width": "80mm",
       "enable_bilingual": false
    }
    ```

---

### 5. Execution Steps (Safe Rollout)

1.  **Phase 1: File Restructuring (Low Risk)**
    *   Move the specific KKC files into a `templates/kkc` folder.
    *   Update imports so the app still compiles.
    *   *Result:* App behaves exactly the same, but file structure is ready for expansion.

2.  **Phase 2: The Factory Switch (Low Risk)**
    *   Implement the "Traffic Cop" functions (`getReceiptGenerator`, etc.).
    *   Hardcode the switch to *always* return KKC for now (or strictly check KKC ID).
    *   *Result:* Code structure supports flexible switching.

3.  **Phase 3: The Generic Implementation (Development)**
    *   Build the `GenericPdfGenerator` and `GenericPrescriptionModal`.
    *   These are new files, so they **cannot** break the existing app.

4.  **Phase 4: Test & Deploy**
    *   Create a "Demo Hospital" in the database.
    *   Log in as Demo User -> Verify "Generic" view.
    *   Log in as KKC User -> Verify "Legacy" view.

---
### 6. Team Discussion Points
*   **UUID Strategy:** We need to identify the exact UUID of "Kongunad Kidney Centre" from the production database to hardcode it as the `LEGACY_ID`.
*   **Generic Fallback:** Confirm if the generic PDF should initially support just English or if we need a translation system immediately. (Suggestion: Start with English-only for generic).
