# Queue Cleanup Guide

## Problem
The live hospital displays are showing yesterday's patients instead of only today's active patients in:
- **Reception Queue** (hospital_queues table)
- **Pharmacy Queue** (hospital_pharmacy_queue table)

## Root Cause
The date filters in the queries are working, but old records with status `pending` or `in_progress` from previous days are still being displayed because they haven't been marked as `completed` or removed.

## Solutions Provided

### 🚀 Quick Fix (Immediate - Use This One!)
Run the comprehensive cleanup script to clear old data from **BOTH queues** right now:

1. **Open Supabase SQL Editor**
   - Go to https://ektevcxubbtuxnaapyam.supabase.co
   - Navigate to SQL Editor

2. **Run the comprehensive cleanup script**
   - Open file: `CLEAR_ALL_QUEUES.sql` ⭐ **RECOMMENDED - Cleans both queues at once**
   - Copy the contents
   - Paste into Supabase SQL Editor
   - Execute the query

**Alternative: Individual Queue Cleanup**
- For Reception Queue only: Use `QUICK_FIX_QUEUE.sql`
- For Pharmacy Queue only: Use `CLEAR_PHARMACY_QUEUE.sql`

This will:
- ✅ Mark all yesterday's pending/in_progress records as `completed` in BOTH queues
- ✅ Keep historical data intact
- ✅ Immediately clear both live queue displays

### 🔄 Permanent Solution (Recommended)
Set up automatic daily cleanup to prevent this from happening again:

1. **Create the cleanup function**
   - Open file: `automated_queue_cleanup.sql`
   - Copy and run in Supabase SQL Editor

2. **Test the function**
   ```sql
   SELECT cleanup_old_queue_records();
   ```

3. **Optional: Enable automatic daily cleanup**
   - Uncomment the pg_cron section in `automated_queue_cleanup.sql`
   - This will automatically clean up old records at midnight every day

## Files Created

### 1. `clear_old_queue_data.sql`
One-time cleanup script with multiple options:
- **Option 1**: Delete all old queue records (permanent)
- **Option 2**: Mark old records as completed (recommended)
- **Option 3**: Delete only pending/in_progress from yesterday

### 2. `automated_queue_cleanup.sql`
Creates a PostgreSQL function that can be:
- Run manually whenever needed
- Scheduled to run automatically at midnight (requires pg_cron)

## How to Execute

### Method 1: Supabase Dashboard (Easiest)
1. Login to Supabase: https://app.supabase.com
2. Select your project: `ektevcxubbtuxnaapyam`
3. Go to **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy content from `clear_old_queue_data.sql`
6. Click **Run** or press Ctrl/Cmd + Enter

### Method 2: Supabase CLI (Advanced)
```bash
# Navigate to project directory
cd /Users/harish/Desktop/BeanHealth-main

# Run the cleanup script
supabase db execute -f clear_old_queue_data.sql

# Set up automated cleanup
supabase db execute -f automated_queue_cleanup.sql
```

## Verification

After running the cleanup, verify in Supabase SQL Editor:

```sql
-- Check today's queue
SELECT 
    COUNT(*) as today_total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM public.hospital_queues
WHERE created_at >= CURRENT_DATE;
```

Expected result: Only today's records should show.

## Understanding the Code

### Current Date Filter (ReceptionDashboard.tsx, line 123)
```typescript
.gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
```

This correctly filters for records created today (from midnight onwards).

### The Issue
Old records from yesterday with status `pending` or `in_progress` remain in the database and are being counted in the stats and displayed in the queue.

### The Fix
The cleanup scripts mark these old records as `completed`, so they:
- ✅ Won't appear in the "Live Queue" tab (filters for pending/in_progress only)
- ✅ Will still be visible in "History Log" tab for record-keeping
- ✅ Won't inflate your "Waiting" count

## Prevention Tips

1. **Run manual cleanup** weekly or when you notice old data
2. **Enable automatic cleanup** using the pg_cron method
3. **Monitor the queue** regularly to ensure it's showing only today's patients

## Troubleshooting

### If old records still appear after cleanup:
1. Check your browser cache - do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Verify the SQL executed successfully in Supabase
3. Check the verification query to confirm data was updated

### If you need to completely wipe all queue data:
```sql
-- USE WITH CAUTION - This deletes ALL queue history
DELETE FROM public.hospital_queues;
```

### If you need to keep only today's data:
```sql
-- Delete everything except today's records
DELETE FROM public.hospital_queues 
WHERE created_at < CURRENT_DATE;
```

## Next Steps

1. **Immediate**: Run `clear_old_queue_data.sql` to fix the current issue
2. **Optional**: Set up `automated_queue_cleanup.sql` for daily automatic cleanup
3. **Monitor**: Check the queue tomorrow morning to ensure it's clean

## Support

If you encounter any issues:
- Check Supabase logs for error messages
- Verify RLS policies are correctly set
- Ensure your user has proper permissions to modify queue records
