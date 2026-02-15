# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

BeanHealth is a healthcare management platform connecting patients and doctors. It supports four user roles: **patient**, **doctor**, **admin**, and **enterprise** (hospital system with reception, pharmacy, and doctors departments).

**Tech Stack:** React 19, TypeScript, Vite, Supabase (PostgreSQL, Auth, Storage, Realtime), Tailwind CSS, Capacitor (mobile), Google Gemini (AI analysis)

## Build and Development Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run mobile    # Start with --host for mobile device testing
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build
```

Testing infrastructure uses vitest but tests are not yet implemented.

## Environment Setup

Required environment variables (see `.env.example`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `VITE_GEMINI_API_KEY` - (Optional) Google Gemini API for AI features

Database setup requires running SQL migrations in order:
1. `supabase_schema.sql`
2. `realtime_chat_setup.sql`
3. `prescriptions_schema.sql`
4. `supabase_storage_setup.sql`

## Architecture

### Core Application Structure

**Entry Point:** `src/App.tsx` → `src/routes/index.tsx`

The app uses React Router with lazy-loaded route components for performance. Routes are protected by role using `ProtectedRoute` and enterprise department routes use `DepartmentProtectedRoute`.

### Context Providers (src/contexts/)

- **AuthContext** - Authentication state, session management, profile loading. Uses singleton Supabase client from `lib/supabase.ts`. Handles OAuth flow, token refresh, and tab isolation for multi-tab support.
- **DataContext** - Patient/doctor data (vitals, medications, records, messages). Subscribes to real-time chat via Supabase.
- **ThemeContext** - Dark/light mode
- **NotificationContext** - Real-time message notifications
- **UrgentCreditsContext** - Urgent message credit tracking

### Service Layer (src/services/)

Services encapsulate all Supabase interactions and business logic. Key patterns:
- Services are static classes with async methods
- Each service handles a specific domain (auth, chat, vitals, medications, etc.)
- Use `supabase` singleton from `lib/supabase.ts`

**Important Services:**
- `authService.ts` - User auth, profiles, sign in/up/out, OAuth
- `chatService.ts` - Real-time messaging, file uploads, read receipts
- `dataService.ts` - Exports VitalsService, MedicationService, MedicalRecordService
- `geminiService.ts` - AI medical analysis, vitals extraction
- `prescriptionService.ts` - Create/manage prescriptions with PDF generation

### Type System (src/types/index.ts)

All TypeScript types are centralized. Types often include both camelCase (frontend) and snake_case (database) field variants for mapping flexibility.

Key types: `User`, `Patient`, `Doctor`, `Vitals`, `Medication`, `MedicalRecord`, `ChatMessage`, `Prescription`, `LabResult`

CKD (Chronic Kidney Disease) specific types: `CKDStage`, `LabTestType`, `FluidIntake`, `UpcomingTest`

### Components (src/components/)

~70 React components organized by feature. Dashboards are role-specific:
- `PatientDashboard.tsx` - Patient portal
- `DoctorDashboardMain.tsx` - Doctor portal
- `AdminDashboardMain.tsx` - Admin portal
- `enterprise/` - Enterprise hospital system (reception, pharmacy, doctors)

### Supabase Client (src/lib/supabase.ts)

Singleton pattern with:
- PKCE auth flow
- Capacitor storage adapter for mobile
- Realtime with exponential backoff reconnection
- 30s global fetch timeout

Database types are defined inline in this file via the `Database` interface.

## Key Patterns

### Authentication Flow

1. `AuthContext` initializes via `supabase.auth.onAuthStateChange` listener
2. On session, fetches user profile via `AuthService.getUserProfileById`
3. Checks onboarding status and terms acceptance
4. OAuth for mobile uses deep links (`com.beanhealth.app://oauth-callback`)

### Real-time Subscriptions

Chat messages subscribe via `ChatService.subscribeToMessages`. Components should unsubscribe on cleanup.

### File Uploads

Use `StorageService` for medical records and chat attachments. Files go to Supabase Storage buckets with RLS policies.

### PDF Generation

Prescriptions use jsPDF + jspdf-autotable. See `utils/prescriptionPdf.ts`.

## Enterprise Mode

Enterprise users manage hospitals with sub-departments:
- **Reception** - Patient registration, queue management
- **Pharmacy** - Prescription fulfillment, queue display
- **Doctors** - Access code protected doctor sessions

Each department has PIN-based authentication stored in sessionStorage.

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json and vite.config.ts)

## Important Files

- `src/lib/supabase.ts` - Supabase client singleton and Database types
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/routes/index.tsx` - All route definitions
- `src/types/index.ts` - TypeScript type definitions
- `*.sql` files in root - Database migrations (run in Supabase SQL Editor)
