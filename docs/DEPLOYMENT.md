# BeanHealth - Netlify Deployment Guide

## 🚀 Quick Deploy to Netlify

### Option 1: Deploy from GitHub (Recommended)

1. **Connect GitHub Repository**
   ```
   - Go to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Choose GitHub and select your BeanHealth repository
   ```

2. **Build Settings**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

3. **Environment Variables**
   Set these in Netlify Dashboard > Site settings > Environment variables:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key (optional)
   ```

### Option 2: Manual Deploy

1. **Build locally**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy dist folder**
   ```
   - Go to Netlify Dashboard
   - Drag and drop the 'dist' folder
   ```

## 🔧 Configuration Files Included

- ✅ `netlify.toml` - Minimal build configuration (fixed parsing issues)
- ✅ `public/_redirects` - Client-side routing support  
- ✅ Security headers managed by Netlify defaults
- ✅ HTTPS enforcement (automatic)
- ✅ SPA routing handled

## 🔐 Required Environment Variables

### Supabase Setup
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project or use existing
3. Go to Settings > API
4. Copy your Project URL and anon/public key
5. Add these to Netlify environment variables

### Google Gemini API (Optional)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to Netlify as `VITE_GEMINI_API_KEY`

### OAuth Configuration
Update your Supabase Auth settings:
```
Site URL: https://your-netlify-domain.netlify.app
Redirect URLs: https://your-netlify-domain.netlify.app
```

## 🎯 Post-Deployment Checklist

- [ ] Site loads correctly at your Netlify URL
- [ ] Authentication works (sign up/sign in)
- [ ] Supabase connection established
- [ ] All routes navigate properly (SPA routing)
- [ ] Mobile responsive design working
- [ ] Dark/light theme toggle functional
- [ ] Environment variables configured
- [ ] File upload functionality works
- [ ] AI analysis works (if Gemini API key provided)
- [ ] Storage bucket permissions configured
- [ ] Medical records can be uploaded and viewed

## 🔗 Example Netlify Site

Your site will be available at: `https://your-site-name.netlify.app`

## 🚨 Troubleshooting

### Common Issues:
1. **Build fails**: Check Node.js version (should be 18+)
2. **Routes don't work**: Ensure `_redirects` file is in public folder
3. **Auth fails**: Check Supabase redirect URLs
4. **Environment variables**: Must start with `VITE_` prefix
5. **Secrets scanning error**: Ensure no API keys are hardcoded in source files

### Secrets Scanning:
Netlify automatically scans for exposed secrets. To avoid issues:
- ✅ Never commit `.env` files with real API keys
- ✅ Use only `import.meta.env.VITE_*` variables in Vite projects
- ✅ Avoid hardcoding secrets in source code
- ✅ Set environment variables in Netlify dashboard, not in code
- ✅ Use `.env.example` as a template for required variables

### Support
- Check Netlify build logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure Supabase project is properly configured