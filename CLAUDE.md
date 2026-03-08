# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:5173
npm run mobile       # Start dev server with host binding (for mobile device testing)
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build locally

# Android (after npm run build)
# Sync web assets to Android: npx cap sync android
# Then open android/ in Android Studio to build the APK
```

There are no automated tests (`npm test` exits with an error).

## Environment Variables

Copy `.env.example` to `.env`:
- `VITE_SUPABASE_URL` — Supabase project URL (required)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (required)
- `VITE_GEMINI_API_KEY` — Google Gemini API key (optional, enables AI medical record analysis)

## Architecture Overview

### Tech Stack
- **React 19** + **TypeScript** + **Vite** (SPA)
- **Supabase** — PostgreSQL database, auth, realtime, and storage
- **Capacitor** — Android native app wrapper (`com.beanhealth.app`)
- **Tailwind CSS** — dark/light mode via `ThemeContext`
- **jsPDF** / `@react-pdf/renderer` — PDF generation for prescriptions
- **Google Gemini** — AI analysis of medical records

### User Roles & Routing

There are four roles with separate dashboards:

| Role | Dashboard Route | Component |
|------|----------------|-----------|
| `patient` | `/patient/*` | `PatientDashboard` |
| `doctor` | `/doctor/*` | `DoctorDashboardMain` |
| `admin` | `/admin-dashboard/*` | `AdminDashboardMain` |
| `enterprise` | `/enterprise-dashboard` | `EnterpriseDashboardHome` |

Dashboard components are **lazy-loaded**. Auth components are eager. Route protection is via `ProtectedRoute` (role-based). After login, `AuthContext` routes users to their dashboard automatically.

The `enterprise` role has sub-dashboards for Reception, Pharmacy, and individual Doctors — each behind department-specific auth (`DepartmentProtectedRoute`, `DoctorProtectedRoute`).

### Context Providers (in order of nesting)

```
AuthProvider → DataProvider → (app UI)
```

- **`AuthContext`** (`contexts/AuthContext.tsx`) — Supabase session, user profile, loading/isInitialized flags, onboarding/terms state. Always check both `loading` and `isInitialized` before rendering auth-dependent UI.
- **`DataContext`** (`contexts/DataContext.tsx`) — Patient vitals, medications, medical records, and chat messages. Loads on auth.
- **`ThemeContext`** — Dark/light mode toggle.
- **`NotificationContext`** — Real-time new message toast notifications.
- **`UrgentCreditsContext`** — Live urgent message credit balance.

### Services Layer (`services/`)

All Supabase interactions go through service modules. Key services:
- `authService.ts` — User auth, profile CRUD
- `dataService.ts` — Vitals, medications, medical records CRUD
- `chatService.ts` — Messaging
- `geminiService.ts` — AI vitals extraction, health summaries
- `prescriptionService.ts` — Prescription creation and delivery
- `visitHistoryService.ts`, `labResultsService.ts`, `caseDetailsService.ts` — Clinical records
- `ruleEngineService.ts` / `ruleEvaluator.ts` — CDS (clinical decision support) alert rules

### Supabase Client

Single singleton at `lib/supabase.ts`. Uses PKCE auth flow. On native (Capacitor), sessions are stored via `CapacitorStorage` instead of `localStorage`. The client has a built-in 30-second fetch timeout.

### Types

- `types.ts` — Shared app-level TypeScript types
- `lib/supabase.ts` — Inline `Database` interface with full table Row/Insert/Update types

**Important:** The `User` type has both camelCase fields (app convention) and snake_case aliases (database field names). When reading from Supabase, use snake_case fields; map to camelCase for app state.

### PDF Generation

- `utils/pdfGenerator.ts` — Standard prescription PDFs (jsPDF)
- `utils/kkcPdfGenerator.ts` — KKC clinic-specific PDF format
- `utils/tokenReceiptGenerator.ts` — Patient token receipts for the enterprise queue system

### Key Patterns

**All Supabase calls must use `withTimeout`** from `utils/requestUtils.ts`:
```typescript
import { withTimeout } from '../utils/requestUtils';
const { data, error } = await withTimeout(
  supabase.from('table').select('*'),
  10000,
  'Descriptive timeout message'
);
```

**Auth-gated components** must check `isInitialized` before `user`:
```typescript
const { user, profile, loading, isInitialized } = useAuth();
if (!isInitialized || loading) return <Spinner />;
```

**Async effects** must track mount state to avoid setState-after-unmount:
```typescript
const isMountedRef = useRef(true);
useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);
```

**Toasts** use `showSuccessToast` / `showErrorToast` from `utils/toastUtils.ts` (wraps `react-hot-toast`).

### Mobile (Android/Capacitor)

- `npm run mobile` serves with host binding for LAN device access
- OAuth deep link scheme: `com.beanhealth.app://oauth-callback`
- After web build changes: `npx cap sync android` then build in Android Studio
- App ID: `com.beanhealth.app`

### Database

All schema migrations are SQL files in the root and `sql/` directory. The canonical schema is `supabase_schema.sql`. Row-Level Security (RLS) is enabled on all tables. See `DATABASE.md` for setup details.
