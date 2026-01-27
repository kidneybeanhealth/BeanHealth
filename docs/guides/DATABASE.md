# 🗄️ Database Migration Guide

## Required SQL Files (Run in Order)

### 1. Main Schema
**File**: `supabase_schema.sql`
**Description**: Core database tables (users, vitals, medications, medical_records, chat_messages, patient-doctor relationships)
**Required**: ✅ Yes

### 2. Real-time Chat
**File**: `realtime_chat_setup.sql`
**Description**: Real-time chat subscriptions, typing indicators, and presence
**Required**: ✅ Yes

### 3. Storage Buckets
**File**: `supabase_storage_setup.sql`
**Description**: File storage buckets for medical records, chat files, avatars, and audio
**Required**: ✅ Yes

### 4. Prescriptions
**File**: `prescriptions_schema.sql`
**Description**: Prescription management system
**Required**: ✅ Yes

---

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project
2. Click **SQL Editor** in the sidebar
3. Click **New Query**
4. Copy content from SQL file
5. Paste and click **Run** (or Cmd/Ctrl + Enter)
6. Verify success message
7. Repeat for each file in order

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

---

## Verification Checklist

After running all migrations, verify:

- [ ] All tables created in **Table Editor**
- [ ] RLS policies enabled (green shield icon)
- [ ] Storage buckets created in **Storage**
- [ ] No error messages in SQL Editor

---

## Troubleshooting

### "relation already exists" error
- Table already exists, safe to ignore or drop table first

### RLS policy errors
- Check if policies with same name exist
- Drop old policies before recreating

### Permission errors
- Ensure you're project owner
- Check Supabase project permissions

---

## Archive Files

Old migration and fix files are in `sql/archive/` - these are not needed for fresh setups.
