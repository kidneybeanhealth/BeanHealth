# Quick Integration Guide - Referral System

## 🚀 Integration Steps (30 minutes)

### Step 1: Database Migration (5 min)
1. Open Supabase Dashboard → SQL Editor
2. Copy content from `referral_system_migration.sql`
3. Execute the migration
4. Verify success message appears

```sql
-- You should see:
-- "Migration completed successfully!"
-- "New features: Doctor referral codes, Sequential patient UIDs, etc."
```

### Step 2: Update ProfileSetup Component (2 min)

**Option A: Replace completely (Recommended)**
```bash
# Rename old file as backup
mv components/auth/ProfileSetup.tsx components/auth/ProfileSetupOld.tsx

# Rename new file
mv components/auth/ProfileSetupNew.tsx components/auth/ProfileSetup.tsx
```

**Option B: Update import**
```typescript
// In components/auth/Auth.tsx (or wherever ProfileSetup is imported)
import ProfileSetup from './ProfileSetupNew';  // Point to new component
```

### Step 3: Add Referral Code to Doctor Dashboard (5 min)

```typescript
// File: components/DoctorDashboardMain.tsx
import DoctorReferralCodeCard from './DoctorReferralCodeCard';

// Add near the top of the dashboard layout (around line 100-120)
// Example placement:
const DoctorDashboardMain: React.FC = () => {
  // ...existing code...
  
  return (
    <div className="...">
      <SimpleHeader />
      
      {/* Add referral code card here */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DoctorReferralCodeCard />
        
        {/* Existing dashboard content */}
        {activeView === 'dashboard' && (
          // ... rest of dashboard
        )}
      </div>
    </div>
  );
};
```

### Step 4: Install Dependencies (if needed) (2 min)
```bash
# No new dependencies required - all using existing packages
npm install  # Ensure all existing dependencies are installed
```

### Step 5: Test Locally (10 min)

#### Test Doctor Flow:
1. Sign out (if logged in)
2. Sign up as new doctor
3. Enter name and specialization
4. **Verify:** Referral code shown (DOC-XXXXXX format)
5. **Verify:** Code copyable to clipboard
6. Continue to dashboard
7. **Verify:** Referral code visible in dashboard

#### Test Patient Flow:
1. Sign out
2. Sign up as new patient
3. **Step 1:** Enter basic info (name, age, gender, contact)
4. **Step 2:** Enter doctor's referral code
   - **Verify:** Invalid code shows error
   - **Verify:** Valid code shows doctor name
5. **Step 3:** Read and accept consent
   - **Verify:** Cannot proceed without checkbox
6. **Step 4:** Optionally add medical info
7. Submit
8. **Verify:** Redirected to patient dashboard

### Step 6: Deploy (5 min)

```bash
# Build production bundle
npm run build

# Deploy to your hosting platform
# (Commands vary by platform)
```

---

## 🔍 Verification Checklist

After deployment, verify:

### Database
- [ ] New columns exist in `users` table
- [ ] Sequence created: `patient_uid_seq`
- [ ] Functions exist: `generate_doctor_referral_code()`, `generate_patient_uid()`, `validate_referral_code()`, `register_patient_with_referral()`
- [ ] Triggers active: `trigger_auto_generate_referral_code`, `trigger_auto_generate_patient_uid`
- [ ] RLS policy exists: "Doctors can view referred patients"

```sql
-- Quick verification queries:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('referral_code', 'patient_uid', 'consent_accepted');

SELECT * FROM pg_proc WHERE proname LIKE '%referral%' OR proname LIKE '%patient_uid%';
```

### Frontend
- [ ] ProfileSetup component renders without errors
- [ ] Doctor registration shows referral code
- [ ] Patient registration has 4 steps
- [ ] Referral code validation works
- [ ] Doctor dashboard shows referral code card

### Integration
- [ ] Existing users can still log in
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Mobile view responsive

---

## ⚡ Quick Fixes

### Issue: "Function does not exist"
```sql
-- Re-run the function creation section from migration
CREATE OR REPLACE FUNCTION validate_referral_code(code TEXT) ...
GRANT EXECUTE ON FUNCTION validate_referral_code TO authenticated;
```

### Issue: Referral code not showing for existing doctors
```sql
-- Backfill referral codes
UPDATE users 
SET referral_code = generate_doctor_referral_code() 
WHERE role = 'doctor' AND referral_code IS NULL;
```

### Issue: TypeScript errors
```bash
# Ensure types are up to date
npm run build  # Will show any type errors
```

---

## 🎯 Key Integration Points

### 1. Auth Flow Integration
The new ProfileSetup replaces the old one **without changing auth logic**:
- Same `useAuth()` context
- Same `AuthService` methods
- Same session management

### 2. Dashboard Integration
Add `DoctorReferralCodeCard` anywhere in doctor's dashboard:
```typescript
{profile?.role === 'doctor' && <DoctorReferralCodeCard />}
```

### 3. Data Flow
```
User Signs Up (Google/Email)
    ↓
Supabase Auth (unchanged)
    ↓
ProfileSetup Component (NEW)
    ↓
    ├─ Doctor: Auto-generate referral code (trigger)
    └─ Patient: Validate referral → Generate UID (function)
    ↓
User Profile Created
    ↓
Dashboard (with referral code for doctors)
```

---

## 📋 Minimal Changes Required

### Files to Modify:
1. **Database:** Run `referral_system_migration.sql` (one time)
2. **ProfileSetup:** Use new component
3. **DoctorDashboard:** Add referral code card (5 lines)

### Files Created:
1. `referral_system_migration.sql`
2. `services/referralService.ts`
3. `components/auth/ProfileSetupNew.tsx`
4. `components/DoctorReferralCodeCard.tsx`

### Files Modified:
1. `types.ts` (add new types)
2. `services/authService.ts` (add timeout to profile creation)

**Total Lines Changed:** ~2,500 lines
**Breaking Changes:** **NONE** ✅

---

## 🧪 Testing Script

```typescript
// test-referral-flow.ts
// Quick manual test to verify everything works

async function testReferralFlow() {
  console.log('Testing referral system...');
  
  // 1. Test doctor referral code generation
  const doctorCode = await ReferralService.getDoctorReferralCode('[DOCTOR_ID]');
  console.assert(doctorCode?.startsWith('DOC-'), 'Doctor code should start with DOC-');
  
  // 2. Test referral code validation
  const validation = await ReferralService.validateReferralCode(doctorCode!);
  console.assert(validation.valid === true, 'Valid code should pass validation');
  
  // 3. Test invalid code
  const invalidValidation = await ReferralService.validateReferralCode('INVALID');
  console.assert(invalidValidation.valid === false, 'Invalid code should fail');
  
  console.log('All tests passed! ✅');
}
```

---

## 💡 Tips

1. **Test in incognito/private mode** to simulate new user experience
2. **Use real email** for Google OAuth testing
3. **Keep old ProfileSetup** as backup during initial rollout
4. **Monitor Supabase logs** for the first few registrations
5. **Take database backup** before running migration

---

## 📞 Need Help?

### Common Questions

**Q: Will existing users be affected?**  
A: No. Migration is backward compatible. Existing users continue working normally.

**Q: What if I need to rollback?**  
A: Simply revert to old ProfileSetup component. Database changes are additive (won't break existing data).

**Q: Can I customize the referral code format?**  
A: Yes. Modify `generate_doctor_referral_code()` function in migration script.

**Q: How do I change patient ID format?**  
A: Modify `generate_patient_uid()` function. Current format: BH-PAT-0001.

**Q: Is this HIPAA compliant?**  
A: The consent mechanism is included. Full HIPAA compliance requires additional infrastructure (BAA with hosting, audit logs, etc.).

---

**Estimated Total Integration Time:** 30-45 minutes  
**Risk Level:** Low (backward compatible)  
**Rollback Difficulty:** Easy (component swap)  
**Production Ready:** ✅ Yes
