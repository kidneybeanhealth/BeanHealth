# BeanHealth — Complete Implementation Blueprint
### Multi-Tenant Generalization — Every File, Every Line of Code

> **Purpose:** This document is a complete hands-on implementation guide.  
> Any developer can pick this up and execute it from start to finish without any prior context.  
> Each step is self-contained and independently deployable.

---

## 🟢 START HERE — Executive Summary

### Is it safe to implement while KKC is live?

**YES — each phase is independently safe. Here's why and what to do in order.**

| Phase | What you do | KKC disruption | Safe while live? |
|-------|-------------|----------------|-----------------|
| **Phase 0** | Run SQL in Supabase (adds columns to existing table) | None | ✅ YES |
| **Phase 1** | Create `TenantContext.tsx` + wrap routes | 1 extra DB call on login (~200ms) | ✅ YES |
| **Phase 2** | Add new receipt generator files | None (old file untouched) | ✅ YES |
| **Phase 3** | Add prescription modal selector files | None (old modal untouched) | ✅ YES |
| **Phase 4** | Fix doctor sort in DoctorLogin.tsx | Identical result for KKC | ✅ YES |
| **Phase 5** | Add setup wizard for new hospitals | KKC never sees it (setup_completed=true) | ✅ YES |
| **Phase 6** | Admin settings panel | Optional, KKC sees no difference | ✅ YES |

### The One Critical Rule
**Never rename `hospital_name` or `contact_number` columns.** The live code in `authService.ts` and `ReceptionDashboard.tsx` writes to those exact column names. You can add new columns (`display_name`, `phone`) alongside them — which is exactly what Phase 0 does.

### Execution Order
```
Step 1 → Run Phase 0 SQL in Supabase (takes 30 seconds, zero downtime)
Step 2 → Create contexts/TenantContext.tsx
Step 3 → Modify routes/index.tsx (add TenantProvider wrapper)
Step 4 → Create utils/receipts/ folder (3 files)
Step 5 → Create components/prescriptions/ folder (3 files)
Step 6 → Modify components/enterprise/DoctorLogin.tsx (doctor sort)
Step 7 → Create HospitalSetupWizard (for future new hospitals)
Step 8 → Create admin settings panel
```

---

---

## Project Context

- **Framework:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Current client:** Kongunad Kidney Centre (KKC) — must never be disrupted
- **Goal:** Support multiple hospitals with their own branding, prescription modals, and receipt layouts

---

## File Structure After Full Implementation

```
src/
├── contexts/
│   ├── AuthContext.tsx          ← EXISTING, unchanged
│   └── TenantContext.tsx        ← NEW — created in Phase 1
│
├── components/
│   ├── enterprise/
│   │   ├── DoctorLogin.tsx      ← MODIFIED in Phase 4
│   │   └── ... (rest unchanged)
│   │
│   └── prescriptions/          ← NEW FOLDER — created in Phase 3
│       ├── PrescriptionModalSelector.tsx   ← NEW — traffic cop
│       ├── templates/
│       │   ├── KKCPrescriptionModal.tsx    ← NEW — exact current KKC modal code
│       │   └── StandardPrescriptionModal.tsx   ← NEW — generic clean modal
│       └── index.ts            ← NEW — exports
│
├── utils/
│   ├── tokenReceiptGenerator.ts     ← EXISTING, unchanged (KKC version)
│   ├── doctorSortStrategy.ts        ← NEW — created in Phase 4
│   └── receipts/                    ← NEW FOLDER — created in Phase 2
│       ├── receiptGeneratorSelector.ts  ← NEW — traffic cop
│       ├── kkcReceiptGenerator.ts       ← NEW — exact current KKC receipt code
│       └── standardReceiptGenerator.ts  ← NEW — generic clean receipt
│
└── routes/
    └── index.tsx               ← MODIFIED in Phase 1 (wrap TenantProvider)

sql/
└── hospital_profiles_migration.sql  ← NEW — created in Phase 0
```

---

## PHASE 0 — Database Migration
> **Deploy:** Run directly in Supabase SQL Editor. No code deployment needed.  
> **KKC Impact:** ZERO. Verified safe. See proof below.

---

### ✅ SAFETY PROOF — Why this is safe while KKC is live

The live code reads from `hospital_profiles` in 3 places. Every column used already exists.  
We are **only ADDING new columns** — never renaming, never dropping.

| File | Operation | Columns currently used |
|------|-----------|----------------------|
| `src/services/authService.ts:165` | UPSERT | `hospital_name`, `address`, `contact_number`, `updated_at` |
| `src/components/enterprise/ReceptionDashboard.tsx:490` | SELECT `*` → reads | `hospital_name`, `address`, `contact_number`, `email`, `avatar_url` |
| `src/components/enterprise/ReceptionDashboard.tsx:598` | UPSERT | `hospital_name`, `address`, `contact_number`, `updated_at` |
| `src/components/enterprise/TrackPatientsPage.tsx:158` | SELECT `avatar_url` | `avatar_url` |

**All these columns already exist. Adding new columns cannot break them. This SQL is safe to run at any time.**

---

### ⚠️ IMPORTANT: The `hospital_profiles` table already exists in your DB

The table was created by an older script with these columns:  
`id`, `hospital_name`, `address`, `contact_number`, `created_at`, `updated_at`, `avatar_url`, `email`, `printer_settings`, `enable_pa_actor_auth`

Do NOT run `CREATE TABLE` — it will error.  
The SQL below uses `ALTER TABLE ADD COLUMN IF NOT EXISTS` which is safe.

---

### Create file: `sql/hospital_profiles_migration.sql`

```sql
-- ============================================================
-- PHASE 0: hospital_profiles — ADD new multi-tenant columns
-- The table already exists. This ONLY adds new columns.
-- Safe to run while KKC is live.
-- Safe to re-run (all use IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- STEP 1: Add new columns alongside existing ones
-- DO NOT rename or drop hospital_name / contact_number
-- (live code still reads those column names)
ALTER TABLE public.hospital_profiles
    ADD COLUMN IF NOT EXISTS display_name    TEXT,
    ADD COLUMN IF NOT EXISTS city            TEXT,
    ADD COLUMN IF NOT EXISTS phone           TEXT,
    ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
    ADD COLUMN IF NOT EXISTS working_hours   TEXT,
    ADD COLUMN IF NOT EXISTS footer_phone    TEXT,
    ADD COLUMN IF NOT EXISTS footer_instagram TEXT,
    ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT '#1a56db',
    ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS config          JSONB DEFAULT '{
        "prescription": "standard",
        "receipt": "standard",
        "show_religious_header": false,
        "religious_header_text": null,
        "enable_bilingual_prescription": false,
        "doctor_sort_order": []
    }'::jsonb;

-- STEP 2: Copy existing data into the new column aliases
-- (Only fills rows where the new column is still NULL)
UPDATE public.hospital_profiles
SET
    display_name = hospital_name,
    phone        = contact_number
WHERE display_name IS NULL;

-- STEP 3: Seed KKC's row with full config
-- ON CONFLICT DO UPDATE: safe to re-run, only updates multi-tenant fields
INSERT INTO public.hospital_profiles (
    id,
    hospital_name,        -- keep old column for existing live code
    display_name,         -- new alias used by TenantContext
    address,
    city,
    contact_number,       -- keep old column for existing live code
    phone,                -- new alias used by TenantContext
    emergency_phone,
    working_hours,
    footer_phone,
    footer_instagram,
    setup_completed,
    config
)
VALUES (
    '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1',
    'KONGUNAD KIDNEY CENTRE',
    'KONGUNAD KIDNEY CENTRE',
    'Coimbatore',
    '641 012',
    '0422 - 2494333, 73588 41555, 73588 41666',
    '0422 - 2494333, 73588 41555, 73588 41666',
    '0422 4316000',
    '8:00 am to 6:00 pm',
    '8056391682',
    '@kongunad_kidney_centre',
    TRUE,
    '{
        "prescription": "kkc",
        "receipt": "kkc",
        "show_religious_header": true,
        "religious_header_text": "~~~ Om Muruga ~~~",
        "enable_bilingual_prescription": true,
        "doctor_sort_order": ["prabhakar", "divakar"]
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    display_name      = EXCLUDED.display_name,
    phone             = EXCLUDED.phone,
    emergency_phone   = EXCLUDED.emergency_phone,
    working_hours     = EXCLUDED.working_hours,
    footer_phone      = EXCLUDED.footer_phone,
    footer_instagram  = EXCLUDED.footer_instagram,
    setup_completed   = EXCLUDED.setup_completed,
    config            = EXCLUDED.config;
-- NOTE: hospital_name and contact_number are NOT in the DO UPDATE list
-- so the existing live data for KKC is never touched

-- STEP 4: RLS policies (only if not already created — check first)
-- Run these one by one if they don't exist yet.
-- If you get "policy already exists" error, skip that line.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'hospital_profiles'
        AND policyname = 'Hospital can view own profile'
    ) THEN
        CREATE POLICY "Hospital can view own profile"
            ON public.hospital_profiles FOR SELECT
            USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'hospital_profiles'
        AND policyname = 'Hospital can update own profile'
    ) THEN
        CREATE POLICY "Hospital can update own profile"
            ON public.hospital_profiles FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'hospital_profiles'
        AND policyname = 'Admin full access to hospital_profiles'
    ) THEN
        CREATE POLICY "Admin full access to hospital_profiles"
            ON public.hospital_profiles FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;
END $$;
```

**Verification queries — run after migration:**
```sql
-- 1. Check new columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hospital_profiles'
ORDER BY column_name;

-- 2. Check KKC's row was seeded correctly
SELECT id, hospital_name, display_name, setup_completed,
       config->>'prescription' AS prescription_template
FROM public.hospital_profiles
WHERE id = '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1';
-- Expected: display_name = 'KONGUNAD KIDNEY CENTRE', prescription_template = 'kkc'

-- 3. Check existing live data is untouched
SELECT hospital_name, address, contact_number FROM public.hospital_profiles;
-- Should show original KKC data intact
```

---

## PHASE 1 — TenantContext
> **Deploy:** New file + one route change. No visible UI change.  
> **KKC Impact:** Login gains one extra DB call (~200ms). Imperceptible.

### Create file: `contexts/TenantContext.tsx`

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────
export interface HospitalConfig {
    prescription: 'kkc' | 'standard' | string;
    receipt: 'kkc' | 'standard' | string;
    show_religious_header: boolean;
    religious_header_text?: string | null;
    enable_bilingual_prescription: boolean;
    doctor_sort_order: string[];
}

export interface HospitalProfile {
    id: string;
    display_name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    emergency_phone: string | null;
    working_hours: string | null;
    logo_url: string | null;
    primary_color: string;
    footer_phone: string | null;
    footer_instagram: string | null;
    setup_completed: boolean;
    config: HospitalConfig;
}

// Default config — used only if DB row somehow has missing fields
const DEFAULT_CONFIG: HospitalConfig = {
    prescription: 'standard',
    receipt: 'standard',
    show_religious_header: false,
    religious_header_text: null,
    enable_bilingual_prescription: false,
    doctor_sort_order: [],
};

interface TenantContextType {
    tenant: HospitalProfile | null;
    loading: boolean;
    refetch: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────
const TenantContext = createContext<TenantContextType>({
    tenant: null,
    loading: true,
    refetch: async () => {},
});

export const useTenant = () => useContext(TenantContext);

// ── Provider ───────────────────────────────────────────────────────
interface TenantProviderProps {
    hospitalId: string;
    children: React.ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ hospitalId, children }) => {
    const [tenant, setTenant] = useState<HospitalProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async () => {
        if (!hospitalId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('hospital_profiles')
                .select('*')
                .eq('id', hospitalId)
                .single();

            if (error) {
                console.error('[TenantContext] Failed to load hospital profile:', error.message);
                setLoading(false);
                return;
            }

            // Merge fetched config with defaults to fill any missing fields
            const mergedProfile: HospitalProfile = {
                ...data,
                config: { ...DEFAULT_CONFIG, ...data.config },
            };

            setTenant(mergedProfile);
        } catch (err) {
            console.error('[TenantContext] Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [hospitalId]);

    return (
        <TenantContext.Provider value={{ tenant, loading, refetch: fetchProfile }}>
            {children}
        </TenantContext.Provider>
    );
};
```

### Modify file: `routes/index.tsx`

Find the enterprise dashboard route section and wrap it with `TenantProvider`.

**Find this block** (around line 200 in routes/index.tsx):
```tsx
{/* Enterprise Dashboard */}
<Route
    path="/enterprise-dashboard/*"
    element={
        <ProtectedRoute requiredRole="enterprise">
            ...
        </ProtectedRoute>
    }
/>
```

**Change it to:**
```tsx
// Add this import at the top of routes/index.tsx:
import { TenantProvider } from '../contexts/TenantContext';

// Then wrap the enterprise dashboard route:
{/* Enterprise Dashboard */}
<Route
    path="/enterprise-dashboard/*"
    element={
        <ProtectedRoute requiredRole="enterprise">
            <TenantProvider hospitalId={profile?.id ?? ''}>
                {/* ... existing enterprise routes unchanged ... */}
            </TenantProvider>
        </ProtectedRoute>
    }
/>
```

**Verification:** Open enterprise dashboard in browser. No visible change. Check browser console — should see no errors. ✅

---

## PHASE 2 — Receipt Generator Selector
> **Deploy:** New folder + 3 new files. Existing `tokenReceiptGenerator.ts` is NOT touched.  
> **KKC Impact:** Receipts print identically. Deploy after 8 PM on day of release.

### Create file: `utils/receipts/kkcReceiptGenerator.ts`

```typescript
/**
 * KKC Receipt Generator
 * This is the original KKC receipt code, moved here unchanged.
 * Do NOT modify this file — it is the preserved KKC implementation.
 */

import { TokenData } from '../tokenReceiptGenerator';

const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40],
    CENTER: [ESC, 0x61, 0x01],
    LEFT: [ESC, 0x61, 0x00],
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    DOUBLE_SIZE: [GS, 0x21, 0x11],
    QUADRUPLE_SIZE: [GS, 0x21, 0x33],
    NORMAL_SIZE: [GS, 0x21, 0x00],
    FEED_LINES_3: [ESC, 0x64, 0x03],
    PAPER_CUT: [GS, 0x56, 0x00],
};

function generateDivider(char: string = '-', width: number = 32): string {
    return char.repeat(width);
}

export function generateKKCReceipt(data: TokenData): Uint8Array {
    const encoder = new TextEncoder();
    const parts: number[] = [];

    const addCommand = (cmd: number[]) => parts.push(...cmd);
    const addText = (text: string) => parts.push(...encoder.encode(text));

    const tokenNumberOnly = data.tokenNumber.replace(/^[A-Za-z-]+/, '');

    addCommand(COMMANDS.INIT);
    addCommand(COMMANDS.CENTER);
    addText('~~~ Om Muruga ~~~\n');
    addCommand(COMMANDS.BOLD_ON);
    addText('KONGUNAD KIDNEY CENTRE\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText(generateDivider('=') + '\n');

    addCommand(COMMANDS.CENTER);
    addCommand(COMMANDS.QUADRUPLE_SIZE);
    addCommand(COMMANDS.BOLD_ON);
    addText(tokenNumberOnly + '\n');
    addCommand(COMMANDS.NORMAL_SIZE);
    addCommand(COMMANDS.BOLD_OFF);

    addCommand(COMMANDS.LEFT);
    addText(generateDivider('-') + '\n');

    addCommand(COMMANDS.BOLD_ON);
    addText('Patient: ');
    addCommand(COMMANDS.BOLD_OFF);
    addText(data.patientName + '\n');

    if (data.mrNumber) {
        addCommand(COMMANDS.BOLD_ON);
        addText('MR. NO: ');
        addCommand(COMMANDS.BOLD_OFF);
        addText(data.mrNumber + '\n');
    }

    addCommand(COMMANDS.BOLD_ON);
    addText('Doctor: ');
    addCommand(COMMANDS.BOLD_OFF);
    const doctorName = data.doctorName.toLowerCase().startsWith('dr.')
        ? data.doctorName
        : 'Dr. ' + data.doctorName;
    addText(doctorName + '\n');

    addText(generateDivider('-') + '\n');

    addCommand(COMMANDS.CENTER);
    addText(data.date + '  ' + data.time + '\n');

    addText(generateDivider('=') + '\n');
    addText('For feedback & queries\n');
    addCommand(COMMANDS.BOLD_ON);
    addText('Ph: 8056391682\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText('IG: @kongunad_kidney_centre\n');
    addText(generateDivider('=') + '\n');

    addCommand(COMMANDS.CENTER);
    addText('BeanHealth\n');

    addCommand(COMMANDS.FEED_LINES_3);
    addCommand(COMMANDS.PAPER_CUT);

    return new Uint8Array(parts);
}
```

### Create file: `utils/receipts/standardReceiptGenerator.ts`

```typescript
/**
 * Standard Receipt Generator
 * Generic receipt for non-KKC hospitals.
 * Uses dynamic hospital name and contact from TenantContext.
 */

import { TokenData } from '../tokenReceiptGenerator';
import { HospitalProfile } from '../../contexts/TenantContext';

const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40],
    CENTER: [ESC, 0x61, 0x01],
    LEFT: [ESC, 0x61, 0x00],
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    QUADRUPLE_SIZE: [GS, 0x21, 0x33],
    NORMAL_SIZE: [GS, 0x21, 0x00],
    FEED_LINES_3: [ESC, 0x64, 0x03],
    PAPER_CUT: [GS, 0x56, 0x00],
};

function generateDivider(char: string = '-', width: number = 32): string {
    return char.repeat(width);
}

export function generateStandardReceipt(data: TokenData, tenant: HospitalProfile): Uint8Array {
    const encoder = new TextEncoder();
    const parts: number[] = [];

    const addCommand = (cmd: number[]) => parts.push(...cmd);
    const addText = (text: string) => parts.push(...encoder.encode(text));

    const tokenNumberOnly = data.tokenNumber.replace(/^[A-Za-z-]+/, '');

    addCommand(COMMANDS.INIT);
    addCommand(COMMANDS.CENTER);

    // Religious header — only if configured in DB
    if (tenant.config.show_religious_header && tenant.config.religious_header_text) {
        addText(tenant.config.religious_header_text + '\n');
    }

    addCommand(COMMANDS.BOLD_ON);
    addText(tenant.display_name.toUpperCase() + '\n');
    addCommand(COMMANDS.BOLD_OFF);
    addText(generateDivider('=') + '\n');

    addCommand(COMMANDS.CENTER);
    addCommand(COMMANDS.QUADRUPLE_SIZE);
    addCommand(COMMANDS.BOLD_ON);
    addText(tokenNumberOnly + '\n');
    addCommand(COMMANDS.NORMAL_SIZE);
    addCommand(COMMANDS.BOLD_OFF);

    addCommand(COMMANDS.LEFT);
    addText(generateDivider('-') + '\n');

    addCommand(COMMANDS.BOLD_ON);
    addText('Patient: ');
    addCommand(COMMANDS.BOLD_OFF);
    addText(data.patientName + '\n');

    if (data.mrNumber) {
        addCommand(COMMANDS.BOLD_ON);
        addText('MR. NO: ');
        addCommand(COMMANDS.BOLD_OFF);
        addText(data.mrNumber + '\n');
    }

    addCommand(COMMANDS.BOLD_ON);
    addText('Doctor: ');
    addCommand(COMMANDS.BOLD_OFF);
    const doctorName = data.doctorName.toLowerCase().startsWith('dr.')
        ? data.doctorName
        : 'Dr. ' + data.doctorName;
    addText(doctorName + '\n');

    addText(generateDivider('-') + '\n');

    addCommand(COMMANDS.CENTER);
    addText(data.date + '  ' + data.time + '\n');

    // Footer — only if configured in DB
    if (tenant.footer_phone || tenant.footer_instagram) {
        addText(generateDivider('=') + '\n');
        addText('For feedback & queries\n');
        if (tenant.footer_phone) {
            addCommand(COMMANDS.BOLD_ON);
            addText('Ph: ' + tenant.footer_phone + '\n');
            addCommand(COMMANDS.BOLD_OFF);
        }
        if (tenant.footer_instagram) {
            addText('IG: ' + tenant.footer_instagram + '\n');
        }
    }

    addText(generateDivider('=') + '\n');
    addCommand(COMMANDS.CENTER);
    addText('Powered by BeanHealth\n');

    addCommand(COMMANDS.FEED_LINES_3);
    addCommand(COMMANDS.PAPER_CUT);

    return new Uint8Array(parts);
}
```

### Create file: `utils/receipts/receiptGeneratorSelector.ts`

```typescript
/**
 * Receipt Generator Selector — The Traffic Cop
 *
 * Reads tenant.config.receipt and returns the correct generator function.
 * To add a new hospital receipt: create a new generator file and add one case here.
 */

import { HospitalProfile } from '../../contexts/TenantContext';
import { TokenData } from '../tokenReceiptGenerator';
import { generateKKCReceipt } from './kkcReceiptGenerator';
import { generateStandardReceipt } from './standardReceiptGenerator';

export function getReceiptBytes(data: TokenData, tenant: HospitalProfile | null): Uint8Array {
    const template = tenant?.config?.receipt ?? 'standard';

    switch (template) {
        case 'kkc':
            return generateKKCReceipt(data);

        // ── ADD NEW HOSPITALS HERE ──────────────────────────────────
        // case 'hospital_xyz':
        //     return generateHospitalXYZReceipt(data, tenant!);
        // ────────────────────────────────────────────────────────────

        case 'standard':
        default:
            return generateStandardReceipt(data, tenant!);
    }
}
```

### How to use it — Update the call site

Search for `generateTokenReceipt(` in the codebase. Every place it is called, replace as follows:

**Before:**
```typescript
import { generateTokenReceipt, createTokenData } from '../utils/tokenReceiptGenerator';

// ...
const bytes = generateTokenReceipt(tokenData);
printer.print(bytes);
```

**After:**
```typescript
import { createTokenData } from '../utils/tokenReceiptGenerator';
import { getReceiptBytes } from '../utils/receipts/receiptGeneratorSelector';
import { useTenant } from '../contexts/TenantContext';

// Inside the component:
const { tenant } = useTenant();

// ...
const bytes = getReceiptBytes(tokenData, tenant);
printer.print(bytes);
```

---

## PHASE 3 — Prescription Modal Selector
> **Deploy:** New folder + files. `PrescriptionModal.tsx` is NOT deleted — it becomes the KKC template.  
> **KKC Impact:** Prescriptions render identically. Deploy after 8 PM on day of release.

### Step 3.1 — Copy the existing KKC modal

Create the folder `components/prescriptions/templates/` and copy the existing `components/PrescriptionModal.tsx` into it as `KKCPrescriptionModal.tsx`.

```
cp components/PrescriptionModal.tsx components/prescriptions/templates/KKCPrescriptionModal.tsx
```

Then inside `KKCPrescriptionModal.tsx`:
- Change the component name from `PrescriptionModal` to `KKCPrescriptionModal`
- Change the export at the bottom from `export default PrescriptionModal` to `export default KKCPrescriptionModal`
- Everything else stays **100% identical**

### Step 3.2 — Create file: `components/prescriptions/templates/StandardPrescriptionModal.tsx`

This is a new clean modal for non-KKC hospitals. You (the designer) will build the full layout. The minimum structure is:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useTenant } from '../../../contexts/TenantContext';

interface StandardPrescriptionModalProps {
    doctor: any;
    patient: any;
    onClose: () => void;
    onSendToPharmacy?: (medications: any[], notes: string) => void;
    readOnly?: boolean;
    existingData?: any;
}

const StandardPrescriptionModal: React.FC<StandardPrescriptionModalProps> = ({
    doctor,
    patient,
    onClose,
    onSendToPharmacy,
    readOnly = false,
    existingData = null,
}) => {
    const { tenant } = useTenant();
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Prescription-${patient?.name || 'Patient'}-${new Date().toLocaleDateString()}`,
    } as any);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                <div ref={componentRef} className="p-6">

                    {/* ── DYNAMIC HEADER — reads from tenant context ── */}
                    <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-4">
                        {tenant?.logo_url && (
                            <img src={tenant.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
                        )}
                        <div className="text-center flex-1">
                            <h1 className="text-xl font-bold text-gray-900">{tenant?.display_name}</h1>
                            <p className="text-sm text-gray-600">{tenant?.address}, {tenant?.city}</p>
                            {tenant?.phone && <p className="text-sm text-gray-600">Ph: {tenant.phone}</p>}
                        </div>
                    </div>

                    {/* Patient details, medication table, etc. — design as needed */}

                </div>

                {/* Footer buttons */}
                <div className="flex gap-3 p-4 border-t">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200">
                        Close
                    </button>
                    <button onClick={() => handlePrint()} className="flex-1 py-3 rounded-xl bg-blue-600 text-white">
                        Print
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StandardPrescriptionModal;
```

### Step 3.3 — Create file: `components/prescriptions/PrescriptionModalSelector.tsx`

```tsx
/**
 * PrescriptionModalSelector — The Traffic Cop
 *
 * Reads tenant.config.prescription and renders the correct modal.
 * To add a new hospital modal: create a template file and add one case here.
 */

import React from 'react';
import { useTenant } from '../../contexts/TenantContext';
import KKCPrescriptionModal from './templates/KKCPrescriptionModal';
import StandardPrescriptionModal from './templates/StandardPrescriptionModal';

interface PrescriptionModalSelectorProps {
    doctor: any;
    patient: any;
    onClose: () => void;
    onSendToPharmacy?: (medications: any[], notes: string) => void;
    readOnly?: boolean;
    existingData?: any;
    clinicLogo?: string;
}

const PrescriptionModalSelector: React.FC<PrescriptionModalSelectorProps> = (props) => {
    const { tenant, loading } = useTenant();

    // While loading, show nothing (prevents wrong modal flash)
    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
            </div>
        );
    }

    const template = tenant?.config?.prescription ?? 'standard';

    switch (template) {
        case 'kkc':
            return <KKCPrescriptionModal {...props} />;

        // ── ADD NEW HOSPITALS HERE ──────────────────────────────────
        // case 'apollo':
        //     return <ApolloPrescriptionModal {...props} />;
        // ────────────────────────────────────────────────────────────

        case 'standard':
        default:
            return <StandardPrescriptionModal {...props} />;
    }
};

export default PrescriptionModalSelector;
```

### Step 3.4 — Create file: `components/prescriptions/index.ts`

```typescript
export { default as PrescriptionModalSelector } from './PrescriptionModalSelector';
```

### Step 3.5 — Update all call sites

Search for every import of `PrescriptionModal` in the codebase:
```
grep -r "import PrescriptionModal" src/
grep -r "import PrescriptionModal" components/
```

**Before (in every file that opens a prescription):**
```tsx
import PrescriptionModal from '../components/PrescriptionModal';

// ...
{showPrescription && (
    <PrescriptionModal
        doctor={doctor}
        patient={patient}
        onClose={() => setShowPrescription(false)}
    />
)}
```

**After:**
```tsx
import { PrescriptionModalSelector } from '../components/prescriptions';

// ...
{showPrescription && (
    <PrescriptionModalSelector
        doctor={doctor}
        patient={patient}
        onClose={() => setShowPrescription(false)}
    />
)}
```

The props are **identical** — no other changes needed.

---

## PHASE 4 — Doctor Sort Strategy
> **Deploy:** New utility file + small change in DoctorLogin.tsx.  
> **KKC Impact:** Doctor order stays Prabhakar → Divakar → others. Identical.

### Create file: `utils/doctorSortStrategy.ts`

```typescript
/**
 * Doctor Sort Strategy
 *
 * sortOrder = [] → alphabetical (default for new hospitals)
 * sortOrder = ['prabhakar', 'divakar'] → those names are pinned to top in that order
 * Works for any hospital — just store their preferred order in hospital_profiles.config
 */

interface Doctor {
    id: string;
    name: string;
    [key: string]: any;
}

export function sortDoctors(doctors: Doctor[], sortOrder: string[]): Doctor[] {
    if (!sortOrder || sortOrder.length === 0) {
        // No preference — alphabetical
        return [...doctors].sort((a, b) => a.name.localeCompare(b.name));
    }

    return [...doctors].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // Find priority index — lower index = higher priority
        const rankA = sortOrder.findIndex(s => nameA.includes(s.toLowerCase()));
        const rankB = sortOrder.findIndex(s => nameB.includes(s.toLowerCase()));

        const priorityA = rankA === -1 ? Infinity : rankA;
        const priorityB = rankB === -1 ? Infinity : rankB;

        if (priorityA !== priorityB) return priorityA - priorityB;

        // Same priority tier → alphabetical as tiebreaker
        return nameA.localeCompare(nameB);
    });
}
```

### Modify file: `components/enterprise/DoctorLogin.tsx`

**Find this block** (around line 205):
```typescript
// Custom sort: Prabhakar first, Divakar second, others after
const sortedDoctors = doctorsList.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    const isPrabhakarA = nameA.includes('prabhakar');
    const isPrabhakarB = nameB.includes('prabhakar');
    if (isPrabhakarA && !isPrabhakarB) return -1;
    if (!isPrabhakarA && isPrabhakarB) return 1;
    const isDivakarA = nameA.includes('divakar');
    const isDivakarB = nameB.includes('divakar');
    if (isDivakarA && !isDivakarB) return -1;
    if (!isDivakarA && isDivakarB) return 1;
    return nameA.localeCompare(nameB);
});
```

**Replace with:**
```typescript
// DB-driven sort — reads priority order from hospital_profiles.config
import { sortDoctors } from '../../utils/doctorSortStrategy';
import { useTenant } from '../../contexts/TenantContext';

// Inside the component, add:
const { tenant } = useTenant();

// Then replace the sort:
const sortedDoctors = sortDoctors(
    doctorsList,
    tenant?.config?.doctor_sort_order ?? []
);
```

**For KKC:** `doctor_sort_order` in DB is `["prabhakar", "divakar"]` → identical sort result. ✅

---

## PHASE 5 — First Login Setup Wizard (New Hospitals Only)
> **Deploy:** New component + one check in the enterprise route.  
> **KKC Impact:** `setup_completed = TRUE` in DB, so KKC never sees this wizard.

### Create file: `components/enterprise/HospitalSetupWizard.tsx`

```tsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface SetupFormData {
    display_name: string;
    address: string;
    city: string;
    phone: string;
    footer_phone: string;
    footer_instagram: string;
    prescription_template: 'standard' | 'kkc';
    receipt_template: 'standard' | 'kkc';
}

interface HospitalSetupWizardProps {
    onComplete: () => void;
}

const HospitalSetupWizard: React.FC<HospitalSetupWizardProps> = ({ onComplete }) => {
    const { profile } = useAuth();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<SetupFormData>({
        display_name: '',
        address: '',
        city: '',
        phone: '',
        footer_phone: '',
        footer_instagram: '',
        prescription_template: 'standard',
        receipt_template: 'standard',
    });

    const handleSave = async () => {
        if (!formData.display_name.trim()) {
            toast.error('Hospital name is required');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('hospital_profiles')
                .upsert({
                    id: profile!.id,
                    display_name: formData.display_name.trim().toUpperCase(),
                    address: formData.address.trim(),
                    city: formData.city.trim(),
                    phone: formData.phone.trim(),
                    footer_phone: formData.footer_phone.trim() || null,
                    footer_instagram: formData.footer_instagram.trim() || null,
                    setup_completed: true,
                    config: {
                        prescription: formData.prescription_template,
                        receipt: formData.receipt_template,
                        show_religious_header: false,
                        enable_bilingual_prescription: false,
                        doctor_sort_order: [],
                    },
                });

            if (error) throw error;

            toast.success('Hospital profile saved!');
            onComplete();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const update = (field: keyof SetupFormData, value: string) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Welcome to BeanHealth</h1>
                <p className="text-gray-500 mb-8">Set up your hospital profile to get started. You can update these details anytime.</p>

                <div className="space-y-4">
                    {/* Hospital Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                            Hospital Name *
                        </label>
                        <input
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                            placeholder="e.g. CITY GENERAL HOSPITAL"
                            value={formData.display_name}
                            onChange={e => update('display_name', e.target.value)}
                        />
                    </div>

                    {/* Address */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Address</label>
                            <input
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                                placeholder="Street / Area"
                                value={formData.address}
                                onChange={e => update('address', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">City</label>
                            <input
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                                placeholder="e.g. Chennai"
                                value={formData.city}
                                onChange={e => update('city', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Hospital Phone</label>
                        <input
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                            placeholder="e.g. 044-24001234"
                            value={formData.phone}
                            onChange={e => update('phone', e.target.value)}
                        />
                    </div>

                    {/* Receipt Footer */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Receipt Footer Phone</label>
                            <input
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                                placeholder="Optional"
                                value={formData.footer_phone}
                                onChange={e => update('footer_phone', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Instagram Handle</label>
                            <input
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                                placeholder="@your_hospital (optional)"
                                value={formData.footer_instagram}
                                onChange={e => update('footer_instagram', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-8 w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Saving...' : 'Save & Continue →'}
                </button>
            </div>
        </div>
    );
};

export default HospitalSetupWizard;
```

### Modify file: `components/enterprise/EnterpriseDashboardHome.tsx`

Add a setup check at the top of the component:

```tsx
import { useTenant } from '../../contexts/TenantContext';
import HospitalSetupWizard from './HospitalSetupWizard';

const EnterpriseDashboardHome: React.FC = () => {
    const { tenant, loading, refetch } = useTenant();

    // Show setup wizard if hospital hasn't completed setup
    if (!loading && tenant && !tenant.setup_completed) {
        return <HospitalSetupWizard onComplete={refetch} />;
    }

    // ... rest of existing dashboard code unchanged
};
```

**For KKC:** `setup_completed = TRUE` in Phase 0 SQL seed → wizard never shows. ✅

---

## PHASE 6 — Hospital Settings Panel (Edit / Update)
> **Deploy:** New admin component. Accessible only to BeanHealth admin role.  
> **KKC Impact:** Zero. Admin-only page.

### Create file: `components/admin/HospitalSettingsPanel.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const HospitalSettingsPanel: React.FC = () => {
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [selected, setSelected] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        supabase
            .from('hospital_profiles')
            .select('*')
            .order('display_name')
            .then(({ data }) => setHospitals(data || []));
    }, []);

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('hospital_profiles')
                .update({
                    display_name: selected.display_name,
                    address: selected.address,
                    city: selected.city,
                    phone: selected.phone,
                    footer_phone: selected.footer_phone,
                    footer_instagram: selected.footer_instagram,
                    config: selected.config,
                })
                .eq('id', selected.id);

            if (error) throw error;
            toast.success('Hospital profile updated');

            // Refresh list
            const { data } = await supabase.from('hospital_profiles').select('*').order('display_name');
            setHospitals(data || []);
        } catch (err: any) {
            toast.error(err.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const update = (field: string, value: any) =>
        setSelected((prev: any) => ({ ...prev, [field]: value }));

    const updateConfig = (key: string, value: any) =>
        setSelected((prev: any) => ({
            ...prev,
            config: { ...prev.config, [key]: value },
        }));

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Hospital Settings</h2>
            <div className="grid grid-cols-3 gap-6">

                {/* Hospital List */}
                <div className="col-span-1 space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Select Hospital</p>
                    {hospitals.map(h => (
                        <button
                            key={h.id}
                            onClick={() => setSelected({ ...h })}
                            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                                selected?.id === h.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-100 hover:border-gray-300'
                            }`}
                        >
                            <p className="font-bold text-sm text-gray-900">{h.display_name}</p>
                            <p className="text-xs text-gray-400">{h.city}</p>
                        </button>
                    ))}
                </div>

                {/* Edit Form */}
                {selected && (
                    <div className="col-span-2 bg-white rounded-2xl border-2 border-gray-100 p-6 space-y-4">
                        <h3 className="font-black text-gray-900">{selected.display_name}</h3>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Display Name</label>
                            <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                value={selected.display_name || ''}
                                onChange={e => update('display_name', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Address</label>
                                <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                    value={selected.address || ''}
                                    onChange={e => update('address', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">City</label>
                                <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                    value={selected.city || ''}
                                    onChange={e => update('city', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone</label>
                            <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                value={selected.phone || ''}
                                onChange={e => update('phone', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Footer Phone</label>
                                <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                    value={selected.footer_phone || ''}
                                    onChange={e => update('footer_phone', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Instagram Handle</label>
                                <input className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                    value={selected.footer_instagram || ''}
                                    onChange={e => update('footer_instagram', e.target.value)} />
                            </div>
                        </div>

                        {/* Config Flags */}
                        <div className="border-t pt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Templates & Features</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Prescription Template</label>
                                    <select className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                        value={selected.config?.prescription || 'standard'}
                                        onChange={e => updateConfig('prescription', e.target.value)}>
                                        <option value="standard">Standard</option>
                                        <option value="kkc">KKC (Bilingual)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Receipt Template</label>
                                    <select className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                        value={selected.config?.receipt || 'standard'}
                                        onChange={e => updateConfig('receipt', e.target.value)}>
                                        <option value="standard">Standard</option>
                                        <option value="kkc">KKC Style</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HospitalSettingsPanel;
```

---

## Adding a New Hospital in the Future

Once all phases are complete, onboarding Hospital 2, 3, N follows this exact checklist:

### Step 1 — Create auth user in Supabase
Go to Supabase → Authentication → Users → Add User. Note the UUID.

### Step 2 — Create enterprise user row
```sql
INSERT INTO public.users (id, email, name, role)
VALUES ('<new-uuid>', 'hospital@email.com', 'Hospital Name', 'enterprise');
```

### Step 3 — They log in → Setup Wizard runs → Profile saved automatically

### Step 4 — Design their prescription modal
```
components/prescriptions/templates/HospitalXYZPrescriptionModal.tsx
```

### Step 5 — Register in selector (one line)
```tsx
// In PrescriptionModalSelector.tsx
case 'hospital_xyz':
    return <HospitalXYZPrescriptionModal {...props} />;
```

### Step 6 — Design their receipt function (if custom layout needed)
```
utils/receipts/hospitalXYZReceiptGenerator.ts
```

### Step 7 — Register in receipt selector (one line)
```typescript
// In receiptGeneratorSelector.ts
case 'hospital_xyz':
    return generateHospitalXYZReceipt(data, tenant!);
```

### Step 8 — Update their config in Admin Panel
Set `prescription: 'hospital_xyz'` and `receipt: 'hospital_xyz'` in the Hospital Settings Panel.

**Done.** KKC is untouched. Every other hospital is untouched.

---

## Final Checklist Before Each Phase Deployment

- [ ] Phase 0 SQL run on staging → verify KKC row exists with `setup_completed = true`
- [ ] Phase 0 SQL run on production → verify same
- [ ] Phase 1 — test enterprise login on staging → no errors in console
- [ ] Phase 2 — print a test receipt on staging → verify KKC output is identical
- [ ] Phase 3 — open and print a prescription on staging → verify KKC output is identical
- [ ] Phase 4 — open doctor list on staging → verify Prabhakar is first, Divakar is second
- [ ] Phase 5 — log in as a NEW test enterprise user → wizard appears, fill it, verify saved
- [ ] Phase 5 — log in as KKC → wizard does NOT appear
- [ ] Phase 6 — log in as admin → Hospital Settings Panel accessible, edit and save works
- [ ] All Phase 2/3/4/5 production deployments done after 8 PM (KKC closes at 6 PM)

---

*BeanHealth Engineering — Implementation Blueprint v1.0*  
*Generated: February 26, 2026*
