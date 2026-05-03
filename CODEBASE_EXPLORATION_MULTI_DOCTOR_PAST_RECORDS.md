# Multi-Doctor Past Records Analysis

## 1. DATABASE SCHEMA: hospital_patient_reviews

**Location:** `supabase/migrations/20260213_enterprise_review_tracking.sql` (lines 19-39)

### Structure
```sql
CREATE TABLE public.hospital_patient_reviews (
    id UUID PRIMARY KEY,
    hospital_id UUID NOT NULL,
    patient_id UUID NOT NULL,           -- FOREIGN KEY → hospital_patients.id
    doctor_id UUID NULL,                 -- FOREIGN KEY → hospital_doctors.id
    source_prescription_id UUID UNIQUE,  -- FK → hospital_prescriptions.id
    source_queue_id UUID NULL,           -- FK → hospital_queues.id
    next_review_date DATE NULL,
    tests_to_review TEXT NULL,
    specialists_to_review TEXT NULL,
    status VARCHAR ('pending', 'rescheduled', 'completed', 'cancelled'),
    checked_in_queue_id UUID NULL,
    checked_in_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

### Key Observations
- **`doctor_id` is stored** — Each review row has a doctor_id field (NOT UNIQUE, can be NULL)
- **No unique constraint on (patient_id, doctor_id)** — A patient can have multiple review rows, one per doctor
- **`source_prescription_id` is UNIQUE** — Only one review row per prescription
- **Trigger syncs prescriptions → reviews** — When a prescription is created/updated with a next_review_date, the trigger auto-creates/updates a corresponding review row

### Indexes
```sql
idx_hospital_patient_reviews_hospital_status_date
  ON hospital_patient_reviews(hospital_id, status, next_review_date)

idx_hospital_patient_reviews_patient
  ON hospital_patient_reviews(patient_id, next_review_date DESC)
```

---

## 2. CURRENT DATA FETCHING LOGIC: enterpriseReviewService.ts

**File:** `src/services/enterpriseReviewService.ts`

### Data Types

#### ReceptionVisitRecord (Prescription)
```typescript
interface ReceptionVisitRecord {
    id: string;
    patient_id: string;
    token_number: string;
    status: string;
    created_at: string;
    next_review_date: string | null;
    tests_to_review?: string | null;
    specialists_to_review?: string | null;
    medications?: any[];
    notes?: string;
    metadata?: any;
    dispensed_at?: string | null;
    doctor?: {              // ✅ DOCTOR INFO IS AVAILABLE
        id?: string;
        name?: string;
        specialty?: string;
        signature_url?: string;
    };
}
```

#### ReceptionPastRecordPatient (Patient with Reviews)
```typescript
interface ReceptionPastRecordPatient {
    id: string;
    name: string;
    age: number;
    // ... other patient fields ...
    latestReviewDate: string | null;
    reviewCategory: ReceptionReviewFilter;
    lastVisitAt: string | null;
    prescriptions: ReceptionVisitRecord[];     // ✅ INCLUDES DOCTOR INFO
    callHistory: ReceptionCallHistoryEntry[];
}
```

**IMPORTANT:** The patient data model does NOT have a `doctor` field — only `prescriptions[].doctor` has doctor info.

### Fetching Flow (lines ~300-400)

#### Step 1: Fetch prescriptions with doctor joins
```typescript
const prescriptionsChunkResult = await withTimeout(
    supabase
        .from('hospital_prescriptions')
        .select(`
            id, patient_id, token_number, status, created_at, next_review_date,
            tests_to_review, specialists_to_review, medications, notes, metadata, dispensed_at,
            doctor:hospital_doctors(id, name, specialty, signature_url)  // ✅ DOCTOR JOIN
        `)
        .eq('hospital_id', hospitalId)
        .in('patient_id', idChunk)
        .order('created_at', { ascending: false })
);
```

**Result:** Each prescription has the doctor who wrote it.

#### Step 2: Fetch reviews (WITHOUT doctor)
```typescript
const reviewsChunkResult = await withTimeout(
    supabase
        .from('hospital_patient_reviews')
        .select('id, patient_id, status, next_review_date, source_prescription_id, completed_at, created_at, updated_at')
        // ⚠️ NOTE: doctor_id is NOT selected from hospital_patient_reviews
        .eq('hospital_id', hospitalId)
        .in('patient_id', idChunk)
        .order('updated_at', { ascending: false })
);
```

**Result:** Review rows are fetched, but doctor_id is NOT included in the selection.

#### Step 3: Pick primary review (lines ~200-220)
```typescript
const pickPrimaryReview = (patientReviews: ReviewRow[]): ReviewRow | null => {
    // Prioritize active (pending/rescheduled) reviews
    const active = patientReviews
        .filter((review) => review.status === 'pending' || review.status === 'rescheduled')
        .sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a));
    if (active.length > 0) return active[0];

    // Then dated reviews with next_review_date
    const dated = patientReviews
        .filter((review) => Boolean(normalizeDateOnly(review.next_review_date || null)))
        .sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a));
    if (dated.length > 0) return dated[0];

    // Then completed reviews
    const completed = patientReviews
        .filter((review) => review.status === 'completed')
        .sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a));
    if (completed.length > 0) return completed[0];

    // Fallback: most recent by update time
    return patientReviews.sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a))[0];
};
```

**KEY FINDING:** The selection picks ONE review row per patient, ignoring doctor_id entirely. If a patient has:
- Review 1: doctor_id = A, next_review_date = 2026-05-10
- Review 2: doctor_id = B, next_review_date = 2026-05-15

Only the most recent **active** or **dated** review is selected (line 1 in this example), and the other doctor's review is discarded.

#### Step 4: Display uses the primary review date
```typescript
const latestReviewDate = (isDeceased || isFollowupStopped)
    ? null
    : (reviewDateFromReview || fallbackReviewDate);  // Uses the ONE selected review

const reviewCategory = deriveReviewCategory(
    latestReviewDate,  // From the primary review only
    latestReview?.status || null,
    // ...
);
```

---

## 3. COMPONENT DISPLAY LOGIC

### ReceptionDashboard.tsx

**Location:** Lines 3119, 3154

When displaying a prescription in the View Rx modal, the doctor info is shown:
```typescript
<p className="text-xs text-gray-500 mt-1">{formatDoctorName(rx.doctor.name)}</p>
```

**And when opening the PrescriptionModal:**
```typescript
doctor={rxViewPrescription.doctor || {}}
```

### DoctorPastRecordsPanel.tsx

**Location:** Lines 750

When showing prescription history in the expanded card:
```typescript
{rx.doctor?.name && (
    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
        Rx by {rx.doctor.name}
    </span>
)}
```

---

## 4. KEY FINDINGS & GAPS

### ✅ What IS Being Done
1. **Doctor info is fetched** with each prescription from `hospital_doctors`
2. **hospital_patient_reviews table HAS doctor_id** field for each review
3. **Prescriptions display doctor name** in UI (when viewing individual Rx)
4. **The trigger DOES sync doctor_id** from prescription to review row

### ❌ What IS NOT Being Done
1. **Doctor_id is not selected from reviews** in the Supabase query (line ~315)
2. **Only ONE review is picked per patient** — no per-doctor separation
3. **Review dates are not split by doctor** — patient shows ONE "Due Date" in card
4. **No doctor-specific review filtering** — all reviews treated equally when picking primary
5. **Past Records card shows no doctor info** — only generic "Review Date"
6. **Call logs don't track which doctor** the review is for

### Multi-Doctor Scenario Example
Patient: **Vishnu (KNH/17/017575)**

| Doctor | Specialty | Review Status | Due Date |
|--------|-----------|---|----------|
| Dr. A  | Cardiology | pending | 2026-05-10 |
| Dr. B  | Nephrology | pending | 2026-05-15 |

**Current behavior:**
- System fetches both review rows
- `pickPrimaryReview()` picks **Dr. A's review** (earliest date)
- Past Records card shows: **"Due: May 10"** only
- Dr. B's review (May 15) is **completely hidden**
- If user views prescriptions, they see both doctors' Rx with their names, but call logs don't indicate which review they're logging

---

## 5. IMPLICATIONS FOR MULTI-DOCTOR PATIENTS

### Past Records Card Accuracy
- **CORRECT for single-doctor patients** — Shows their one due date
- **INCOMPLETE for multi-doctor patients** — Only shows earliest due date, hides other doctors' reviews

### Call Logging
- When logging a call (openCallLog → handleSubmitCallLog), the system:
  - Gets the active review (pending/rescheduled)
  - Updates its status and next_review_date
  - Does NOT track which doctor's review is being updated
  - Creates a `hospital_patient_followups` entry with NO doctor_id reference

### Review Date Filters
- Past Records filters (due_today, overdue, etc.) use `latestReviewDate` 
- For multi-doctor patients, this might miss secondary doctor's upcoming reviews

### Prescription to Review Linkage
- Each prescription creates/updates ONE review row via the trigger
- The review row gets the doctor_id from the prescription
- This works correctly for tracking **which doctor prescribed what**
- BUT `pickPrimaryReview()` ignores this when choosing which review to show

---

## 6. DATA MODEL SUMMARY

```
Hospital_Patient
    ├─ hospital_queues (one per visit)
    │   └─ doctor_id → hospital_doctors (who is seeing them)
    │
    ├─ hospital_prescriptions (one per visit)
    │   ├─ doctor_id → hospital_doctors (who prescribed)
    │   ├─ next_review_date (when to follow up)
    │   └─ [TRIGGER] → Creates/updates hospital_patient_reviews
    │
    ├─ hospital_patient_reviews (one per review cycle)
    │   ├─ doctor_id → hospital_doctors (doctor whose Rx set the review)
    │   ├─ source_prescription_id → hospital_prescriptions
    │   ├─ next_review_date
    │   └─ status (pending/rescheduled/completed/cancelled)
    │
    └─ hospital_patient_followups (one per call attempt)
        └─ [NO doctor_id] ⚠️ Can't tell which doctor the call is for

Display Layer:
    ReceptionPastRecordPatient
    ├─ latestReviewDate (single date, from pickPrimaryReview)
    ├─ prescriptions[] (all Rx with doctor.name for each)
    └─ callHistory (calls without doctor context)
```

---

## 7. CALL LOG ISSUE IN MULTI-DOCTOR SCENARIO

**File:** `src/components/enterprise/ReceptionDashboard.tsx` (lines ~3200)

```typescript
const handleSubmitCallLog = async (e: React.FormEvent) => {
    // ... validation ...
    
    const existingReview = await supabase
        .from('hospital_patient_reviews')
        .select('id, patient_id')
        .eq('hospital_id', profile.id)
        .eq('patient_id', callLogTarget.patientId)
        .in('status', ['pending', 'rescheduled'])
        .order('next_review_date', { ascending: false })
        .limit(1)
        .maybeSingle();  // ⚠️ GETS FIRST ACTIVE REVIEW, NO DOCTOR FILTERING

    // Updates the review row without knowing which doctor it belongs to
    const reviewPatch = {
        status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
        next_review_date: effectiveReviewDate,
        // ...
    };
    
    // Creates followup log WITHOUT doctor_id context
    await supabase
        .from('hospital_patient_followups')
        .insert({
            hospital_id: profile.id,
            review_id: existingReview?.id || null,
            patient_id: callLogTarget.patientId,
            called_at: new Date().toISOString(),
            call_status: callLogStatus,
            patient_response: callLogNotes.trim() || null,
            // NO doctor_id field
        });
};
```

**Problem:** If Vishnu has reviews with both Dr. A and Dr. B, and the PA logs a call saying "Patient will come on May 12 to see Dr. A", the system might actually update Dr. B's review instead (whichever was fetched first).

---

## 8. MISSING PIECES FOR FULL MULTI-DOCTOR SUPPORT

### In Database
- ✅ `hospital_patient_reviews.doctor_id` exists
- ❌ `hospital_patient_followups` should have `doctor_id` field for context
- ❌ No RLS policy to prevent doctors from seeing other doctors' reviews

### In Services (enterpriseReviewService.ts)
- ❌ Need to select `doctor_id` from review rows
- ❌ Need to return per-doctor review groupings, not just one
- ❌ Call log methods should accept/filter by doctor_id

### In Components (ReceptionDashboard.tsx, DoctorPastRecordsPanel.tsx)
- ❌ Past Records card should show multiple "Due Dates" (one per doctor)
- ❌ Call log modal should show which doctor the review is for
- ❌ When updating a review, should specify which doctor's review to update
- ❌ UI should indicate "Dr. A - Due May 10" vs "Dr. B - Due May 15"

### In Display
- ❌ DoctorPastRecordsPanel should only show reviews for that specific doctor (currently shows all)
- ❌ Past records print list doesn't show doctor info

---

## 9. CURRENT DOCTOR-FILTERING BEHAVIOR

### ReceptionDashboard: Queue tabs have doctor filtering
Lines ~2700-2720:
```typescript
{(activeTab === 'queue' || activeTab === 'patients') && doctors.length > 1 && (
    <div className="px-6 py-3 border-b border-gray-100">
        <button onClick={() => setQueueDoctorFilter('all')} ...>All</button>
        {doctors.map(doc => (
            <button onClick={() => setQueueDoctorFilter(doc.id)} ...>
                {formatDoctorName(doc.name)}
            </button>
        ))}
    </div>
)}
```
**This filters live queue by doctor_id** — works correctly.

### DoctorPastRecordsPanel: NO DOCTOR FILTERING
The panel receives a `doctor` prop and should only show that doctor's reviews, but:
- `fetchReceptionPastRecords()` is called WITHOUT a doctor_id filter
- Returns ALL patients and ALL their prescriptions (all doctors)
- The past records shown are hospital-wide, not doctor-specific

This is likely intentional for **reception staff** (need to see all patients coming that day), but it means:
- **Reception sees all reviews** (correct — they manage all doctors' patients)
- **Doctor sees all reviews** (potentially incorrect — they might only want their own reviews)

---

## Summary Table

| Aspect | Current | Multi-Doctor Aware? |
|--------|---------|-------------------|
| Review data storage | `hospital_patient_reviews` with `doctor_id` | ✅ Schema supports it |
| Review fetching | Doesn't select `doctor_id` | ❌ Missing from query |
| Review selection | Picks one review per patient | ❌ No per-doctor grouping |
| Past Records display | Shows one due date | ❌ Hides extra doctors' dates |
| Prescription display | Shows doctor for each Rx | ✅ Working |
| Call log creation | No doctor context | ❌ Can't track which doctor |
| Doctor filtering | Live queue yes, past records no | ⚠️ Mixed |
| DoctorPastRecordsPanel | Receives doctor, but not used | ❌ Shows all reviews |

---

## Files to Modify (for full multi-doctor support)

1. **src/services/enterpriseReviewService.ts**
   - Add `doctor_id` to review row selection
   - Create new method: `fetchPastRecordsByDoctor(doctorId)`
   - Update call log methods to accept `doctor_id`

2. **supabase/migrations/*.sql**
   - Add `doctor_id` field to `hospital_patient_followups`
   - Create index on `(hospital_id, doctor_id, patient_id)`

3. **src/components/enterprise/ReceptionDashboard.tsx**
   - Modify past records card to show per-doctor review dates
   - Update call log to show and track which doctor

4. **src/components/enterprise/DoctorPastRecordsPanel.tsx**
   - Filter `fetchReceptionPastRecords` by doctor_id
   - Show only that doctor's prescriptions and reviews
   - Filter call logs by doctor

5. **Database schema**
   - Add RLS policy: doctors can only see/update their own reviews
