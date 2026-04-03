# Supabase Storage Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create the Storage Bucket

1. **Go to your Supabase Dashboard**

   - Visit [app.supabase.com](https://app.supabase.com)
   - Select your BeanHealth project

2. **Navigate to Storage**

   - Click on "Storage" in the left sidebar
   - Click on "Buckets" tab

3. **Create New Bucket**

   - Click the "Create Bucket" button
   - Fill in the following details:
     - **Name**: `medical-records`
     - **Public bucket**: ✅ **Check this box** (very important!)
     - **File size limit**: `10485760` (10MB)
     - **Allowed MIME types**: Add these one by one:
       - `image/jpeg`
       - `image/png`
       - `image/gif`
       - `image/webp`
       - `application/pdf`

4. **Save the Bucket**
   - Click "Save" to create the bucket

### Step 2: Set Up Storage Policies (CRITICAL)

**If you get "row-level security policy" errors, you MUST run this SQL:**

1. **Go to Supabase SQL Editor**

   - In your Supabase dashboard, click "SQL Editor"
   - Create a new query

2. **Run This SQL Command:**

   ```sql
   CREATE POLICY "Allow all operations on medical-records"
   ON storage.objects FOR ALL
   USING (bucket_id = 'medical-records');
   ```

3. **Click "Run" to execute the command**

### Step 3: Verify Setup

1. **Test in the App**
   - Go to the Upload section in your BeanHealth app
   - Use the "Storage Test" component to verify everything works
   - Try uploading a test medical record (PDF or image)
   - Verify AI analysis runs (if Gemini API key is configured)

2. **Check Console Logs**
   - Open browser developer tools (F12)
   - Look for any error messages in the console
   - All tests should show "SUCCESS"
   - Upload should complete and redirect to Records view

3. **Verify Features Work**
   - ✅ File uploads successfully
   - ✅ AI analysis extracts information
   - ✅ Vitals are automatically updated (if detected)
   - ✅ Records appear in the Records section
   - ✅ Files can be viewed and deleted

## Troubleshooting

### Common Issues:

**❌ "Bucket not found" error**

- Make sure the bucket name is exactly `medical-records`
- Ensure the bucket is marked as "public"

**❌ "Upload failed" error**

- Check that file size is under 10MB
- Verify file type is allowed (images or PDF)
- Make sure you're logged in to the app

**❌ "Permission denied" or "row-level security policy" error**

- This means you need to set up storage policies
- Go to Supabase SQL Editor and run the policy creation command above
- Ensure the bucket is set to "public"
- Check that you're authenticated in the app

### Still Having Issues?

1. **Check Environment Variables**

   ```bash
   # Make sure these are set in your .env file:
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. **Verify Database Connection**

   - Make sure you can log in to the app
   - Check that user data loads correctly

3. **Test Storage Manually**
   - Go to Storage > Buckets in Supabase dashboard
   - Try uploading a file manually through the dashboard
   - If this fails, there might be a project configuration issue

## Advanced Setup (Optional)

If you want to set up storage policies via SQL (not required for basic functionality):

1. Go to SQL Editor in your Supabase dashboard
2. Run the commands from `supabase_storage_setup.sql`
3. This adds additional security policies for file access

## ✅ Success Indicators

**You'll know it's working when:**

- ✅ Storage Test shows all green checkmarks
- ✅ You can upload files through the app (PDFs, images)
- ✅ Files appear in the Supabase Storage dashboard
- ✅ AI analysis runs on uploaded files (extracts date, type, doctor, summary)
- ✅ Medical records appear in the Records section
- ✅ Vitals are automatically extracted and updated (if present in records)
- ✅ AI health summary is generated from all records
- ✅ Files can be deleted from both app and storage

## Need Help?

If you're still having issues:

1. Check the browser console for detailed error messages
2. Verify all environment variables are set correctly
3. Make sure the Supabase project has the correct permissions
4. Try creating a new bucket with a different name to test permissions
