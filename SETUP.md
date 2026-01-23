# 🏥 BeanHealth - Setup Guide

## 📋 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Database Setup

Run these SQL files in your Supabase SQL Editor (in order):

1. **`supabase_schema.sql`** - Main database schema
2. **`realtime_chat_setup.sql`** - Real-time chat functionality
3. **`prescriptions_schema.sql`** - Prescription feature
4. **`supabase_storage_setup.sql`** - File storage buckets

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:5173`

---

## 🚀 Deployment

See `docs/DEPLOYMENT.md` for detailed deployment instructions.

---

## 📚 Feature Documentation

### Core Features
- **Chat System** - Real-time messaging with file uploads
- **Prescriptions** - Generate and manage prescriptions (see `docs/PRESCRIPTION_README.md`)
- **Medical Records** - Upload and manage patient records
- **Vitals Tracking** - Monitor patient health metrics
- **AI Assistant** - Gemini-powered health insights

### Setup Guides
- **Deployment** - `docs/DEPLOYMENT.md`
- **Chat & Storage** - `docs/REALTIME_CHAT_SETUP.md`, `docs/STORAGE_SETUP.md`
- **Prescriptions** - `docs/PRESCRIPTION_README.md`

---

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Authentication required for all operations
- Role-based access control (doctor/patient)
- Secure file storage with access policies

---

## 📱 Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **PDF Generation**: jsPDF
- **AI**: Google Gemini
- **Build**: Vite

---

## 🐛 Troubleshooting

### Database Connection Issues
- Verify Supabase credentials in `.env`
- Check if all SQL migrations have been run

### PDF Generation Issues
- Ensure jsPDF dependencies are installed
- Check browser console for errors

### File Upload Issues
- Verify storage buckets are created
- Check RLS policies on storage buckets

---

## 📞 Support

Check the `docs/` folder for detailed documentation on specific features.
