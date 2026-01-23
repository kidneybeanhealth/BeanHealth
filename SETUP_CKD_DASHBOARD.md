# Quick Setup Guide - CKD Dashboard

## 🎯 2-Step Setup

### Step 1: Run Database Schema (5 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `ektevcxubbtuxnaapyam`

2. **Run SQL Migration**
   - Click **SQL Editor** in left sidebar
   - Click **New Query**
   - Open this file: [`ckd_schema_extension.sql`](file:///c:/Users/nithi/OneDrive/Desktop/beanhealth%20app/BeanHealth-main/BeanHealth-main/ckd_schema_extension.sql)
   - Copy ALL contents (340 lines)
   - Paste into Supabase SQL Editor
   - Click **RUN** button

3. **Verify Success**
   - You should see: "Success. No rows returned"
   - No errors displayed

### Step 2: Log In & Test (2 minutes)

1. **Navigate to app**
   ```
   http://localhost:5173
   ```

2. **Log in**
   - Click "Patient"
   - Use existing credentials OR create new account

3. **You should see:**
   - ✅ CKD Monitoring Dashboard header
   - ✅ Patient Information card
   - ✅ Fluid Intake Tracker
   - ✅ Lab Results card
   - ✅ Upcoming Tests card

---

## 🧪 Quick Test

**Add your first data**:

1. **Patient Info**: Click "Edit" → Enter age 58 → Select "Hypertension" → Save
2. **Fluid Intake**: Click "+500 ml" button → See progress bar update
3. **Lab Results**: Click "+ Add Result" → Select "eGFR" → Enter 65 → Save
   - Watch CKD Stage auto-calculate to "Stage 2"
4. **Upcoming Tests**: Click "+ Schedule Test" → Select "Kidney Ultrasound" → Pick date → Save

---

## ❓ Troubleshooting

### Database Issues
- **Error: relation "fluid_intake" does not exist**
  → Go back to Step 1, run the SQL schema

- **Error: column "ckd_stage" does not exist**
  → The SQL didn't run completely. Clear the SQL editor and try again

### Login Issues
- **Can't log in**
  → Create a new account (Sign Up button)

- **Dashboard not showing**
  → Clear browser cache and refresh

### Component Errors
- **Components not loading**
  → Check browser console (F12) for errors
  → Try: `npm install` then restart dev server

---

## 📞 Need Help?

Check the complete walkthrough for detailed information:
[`walkthrough.md`](file:///C:/Users/nithi/.gemini/antigravity/brain/32983405-17da-4585-ae33-40c9c2decfed/walkthrough.md)
