# New Unified Onboarding System

## Overview

The onboarding system has been completely redesigned to provide a unified, centralized experience for ALL user types (patients, doctors, and admins). 

**IMPORTANT:** ALL existing users will be required to go through the new onboarding flow. This ensures:
- Fresh, clean data for all users
- Consistent data structure across all accounts
- All required fields are properly populated

## Quick Start - Deploy the New Onboarding

### Step 1: Run the Database Migration

Run this SQL in your **Supabase SQL Editor**:

```sql
-- File: migrate_existing_users_onboarding.sql

-- 1. Add required columns
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- 2. RESET ALL USERS - forces everyone through new onboarding
UPDATE public.users
SET onboarding_completed = false
WHERE onboarding_completed IS NULL OR onboarding_completed = true;

-- 3. Verify
SELECT role, COUNT(*) as users_needing_onboarding 
FROM public.users 
WHERE onboarding_completed = false OR onboarding_completed IS NULL
GROUP BY role;
```

### Step 2: Deploy the Application

The new onboarding flow will automatically show for all users.

## What Happens to Existing Users

When existing users log in, they will see the onboarding flow:

1. **Welcome Screen** - Role-specific introduction
2. **Profile Completion** - Update their name, date of birth (patients), gender
3. **Role-Specific Step**:
   - Patients: Enter doctor referral code (optional)
   - Doctors: Enter specialty
4. **Success Screen** - Shows Patient ID or Doctor Referral Code

Their existing data (name, condition, etc.) will be pre-filled in the forms, but they can update it.

## Files Changed

### Modified
- `App.tsx` - Integrated new OnboardingFlow component
- `contexts/AuthContext.tsx` - Added `needsOnboarding` state
- `components/PatientDashboard.tsx` - Removed old onboarding code
- `services/onboardingService.ts` - Complete rewrite for all user types

### Created
- `components/OnboardingFlow.tsx` - New unified onboarding component
- `migrate_existing_users_onboarding.sql` - Database migration script

### Deleted
- `components/OnboardingModal.tsx` - Old onboarding modal (replaced)

## Flow Diagram

```
User logs in
    ↓
Has profile with role? (needsProfileSetup check)
    NO → Show ProfileSetup (select role: patient/doctor)
    ↓ YES
onboarding_completed === true?
    NO → Show OnboardingFlow
    ↓ YES
Role is patient & needs terms acceptance?
    YES → Show TermsAndConditionsModal
    ↓ NO
Show appropriate dashboard
```

## Key Features

### For Patients
- ✅ Full name and date of birth collection
- ✅ Gender selection
- ✅ Primary health condition (optional)
- ✅ Doctor referral code linking
- ✅ Patient ID generation and display

### For Doctors
- ✅ Full name and gender collection
- ✅ Medical specialty selection
- ✅ Auto-generated referral code display
- ✅ Referral code for sharing with patients

### For Admins
- ✅ Full name and gender collection
- ✅ Streamlined admin-specific flow

## Database Fields Updated

During onboarding, these fields are updated:

| Field | Patient | Doctor | Admin |
|-------|---------|--------|-------|
| `name` | ✅ | ✅ | ✅ |
| `full_name` | ✅ | ✅ | ✅ |
| `gender` | ✅ | ✅ | ✅ |
| `date_of_birth` | ✅ | - | - |
| `condition` | ✅ (optional) | - | - |
| `specialty` | - | ✅ | - |
| `patient_id` | ✅ (generated) | - | - |
| `referral_code` | - | ✅ (auto-generated) | - |
| `onboarding_completed` | ✅ | ✅ | ✅ |
| `updated_at` | ✅ | ✅ | ✅ |

## Troubleshooting

### Users Not Seeing Onboarding
1. Check if `onboarding_completed` is `false` in database
2. Run the migration script again
3. Clear browser cache and refresh

### Onboarding Not Completing
1. Check browser console for errors
2. Verify RLS policies allow user updates
3. Check all required database columns exist

### Pre-filled Data Not Showing
1. Profile data is loaded from AuthContext
2. Check if profile has the expected fields
3. May need to refresh profile data

## Testing the Flow

1. Run the migration script to reset all users
2. Log in with any account
3. Verify the welcome screen shows
4. Complete all steps
5. Verify data is saved in database
6. Log out and back in - should go directly to dashboard
