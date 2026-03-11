# CLAUDE.md

This file is the source of truth for Claude Code when working in this repository.
**Update this file after every significant change, feature addition, or architectural decision.**

---

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:5173
npm run mobile       # Start dev server with host binding (for mobile device testing)
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build locally

# Android (after npm run build)
npx cap sync android   # Sync web assets to Android project
# Then open android/ in Android Studio to build the APK
```

There are no automated tests (`npm test` exits with an error).

---

## Environment Variables

Copy `.env.example` to `.env`:
- `VITE_SUPABASE_URL` — Supabase project URL (required)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (required)
- `VITE_GEMINI_API_KEY` — Google Gemini API key (optional, enables AI medical record analysis)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite (SPA) |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Mobile | Capacitor 7 (Android, `com.beanhealth.app`) |
| AI | Google Gemini (medical record analysis, vitals extraction) |
| PDFs | jsPDF + @react-pdf/renderer |
| Charts | Recharts |
| Routing | React Router v7 |
| Styling | Tailwind CSS (dark/light mode via ThemeContext) |
| Notifications | react-hot-toast |
| Icons | Lucide React + custom SVG icon components |

---

## User Roles & Routing

Four roles with separate dashboards:

| Role | Route | Dashboard Component | Auth Guard |
|------|-------|-------------------|-----------|
| `patient` | `/patient/*` | `PatientDashboard.tsx` | `ProtectedRoute` |
| `doctor` | `/doctor/*` | `DoctorDashboardMain.tsx` | `ProtectedRoute` |
| `admin` | `/admin-dashboard/*` | `AdminDashboardMain.tsx` | `ProtectedRoute` |
| `enterprise` | `/enterprise-dashboard*` | `EnterpriseDashboardHome.tsx` | `ProtectedRoute` |

- Dashboard components are **lazy-loaded**; auth components are eager.
- After login, `AuthContext` auto-routes users to their role dashboard.
- Enterprise role has 3 sub-dashboards, each behind department-specific auth:
  - **Reception** — `ReceptionDashboard.tsx` + `ReceptionLogin.tsx` + `DepartmentProtectedRoute`
  - **Pharmacy** — `PharmacyDashboard.tsx` + `PharmacyLogin.tsx` + `DepartmentProtectedRoute`
  - **Doctor** — `DoctorDashboardWrapper.tsx` + `DoctorLogin.tsx` + `DoctorProtectedRoute`

---

## Project Structure

```
BeanHealth-V7/
├── src/
│   ├── App.tsx                     # Root component, router setup, deep link handler
│   ├── index.tsx                   # React entry point (loaded by index.html)
│   ├── types.ts                    # Root-level shared types
│   │
│   ├── components/                 # All component files (single source of truth)
│   │   ├── (root)                  # Core components
│   │   ├── auth/                   # 9 auth components
│   │   ├── enterprise/             # 13 enterprise modules
│   │   ├── icons/                  # 56 custom SVG icon components
│   │   ├── layout/                 # 6 layout components (Sidebar, Header, BottomNav)
│   │   ├── landing/                # LandingPage.tsx + mock.ts
│   │   ├── modals/                 # 13 modal components
│   │   ├── ui/                     # 9 shadcn/custom UI primitives
│   │   └── common/                 # TwoStepConfirmModal
│   │
│   ├── contexts/                   # 5 context providers
│   ├── services/                   # 33 service modules (all Supabase logic)
│   ├── hooks/                      # 4 custom React hooks
│   ├── utils/                      # 11 utility modules
│   ├── lib/                        # Supabase client, types, storage
│   ├── routes/                     # index.tsx — full routing config
│   └── types/                      # 4 TypeScript type definition files
│
├── android/                        # Capacitor Android native wrapper
├── public/                         # Static assets (logos, fonts, audio, images)
├── supabase/                       # Supabase project config
├── supabase_schema.sql             # Canonical DB schema
├── sql/                            # Additional SQL migration files
├── *.sql                           # 65+ schema/migration/fix SQL files (root level)
└── docs/                           # Developer documentation
```

**Important:** `index.html` loads `src/index.tsx` → `src/App.tsx`. All components live exclusively under `src/components/`. There is no root-level `components/` or `App.tsx` — those were stale duplicates and have been deleted.

---

## Context Providers

Provider nesting order:
```
AuthProvider → DataProvider → ThemeContext → NotificationContext → UrgentCreditsContext → App UI
```

| Context | File | Responsibility |
|---------|------|---------------|
| `AuthContext` | `contexts/AuthContext.tsx` (26 KB) | Supabase session, user profile, role, loading/isInitialized flags, onboarding & terms state |
| `DataContext` | `contexts/DataContext.tsx` (10 KB) | Patient vitals, medications, records, chat messages — loads on auth |
| `ThemeContext` | `contexts/ThemeContext.tsx` | Dark/light mode toggle |
| `NotificationContext` | `contexts/NotificationContext.tsx` (13 KB) | Real-time toast notifications for new messages |
| `UrgentCreditsContext` | `contexts/UrgentCreditsContext.tsx` (3.4 KB) | Live urgent message credit balance |

---

## Services Layer (`services/`)

All Supabase interactions go through service modules (never call Supabase directly from components).

### Core Services
| Service | Size | Responsibility |
|---------|------|---------------|
| `authService.ts` | 14 KB | User auth, profile CRUD |
| `dataService.ts` | 8 KB | Patient vitals, medications, medical records CRUD |
| `chatService.ts` | 11 KB | Messaging functionality |
| `geminiService.ts` | 30 KB | Google Gemini AI — vitals extraction, health summaries, record analysis |

### Clinical Services
| Service | Size | Responsibility |
|---------|------|---------------|
| `medicationService.ts` | 20 KB | Medication CRUD and management |
| `visitHistoryService.ts` | 18 KB | Visit records |
| `labResultsService.ts` | 14 KB | Lab test results |
| `caseDetailsService.ts` | 7 KB | Patient case details |
| `prescriptionService.ts` | 8 KB | Prescription creation and delivery |
| `visitMedicationService.ts` | 9 KB | Visit-specific medications |
| `fluidIntakeService.ts` | 6 KB | Fluid intake tracking |
| `upcomingTestsService.ts` | 7 KB | Upcoming lab tests |
| `patientLabThresholdsService.ts` | 7 KB | Lab result threshold management |

### CDS / Alert Services
| Service | Size | Responsibility |
|---------|------|---------------|
| `alertService.ts` | 8 KB | Clinical alert notifications |
| `alertVersioningService.ts` | 14 KB | Alert versioning and tracking |
| `ruleEngineService.ts` | 22 KB | Clinical Decision Support rules management |
| `ruleEvaluator.ts` | 17 KB | Rule evaluation logic |
| `customLabTypesService.ts` | 12 KB | Custom lab type definitions |

### Enterprise / Admin Services
| Service | Size | Responsibility |
|---------|------|---------------|
| `adminApiService.ts` | 11 KB | Admin-specific API calls |
| `snapshotLogicService.ts` | 23 KB | Snapshot logic for enterprise views |
| `categorizationService.ts` | 11 KB | Patient categorization |
| `impersonationService.ts` | 8 KB | Admin impersonation of patients |
| `beanhealthIdService.ts` | — | BeanHealth ID management |
| `referralService.ts` | 7 KB | Referral system |
| `patientInvitationService.ts` | 3 KB | Patient invitations |
| `doctorNotesService.ts` | 5 KB | Doctor notes |

### Support Services
| Service | Size | Responsibility |
|---------|------|---------------|
| `onboardingService.ts` | 10 KB | User onboarding flow |
| `termsService.ts` | 6 KB | Terms and conditions |
| `storageService.ts` | 14 KB | File/image storage |
| `medicalRecordsService.ts` | 3 KB | Medical records |
| `acknowledgmentService.ts` | 5 KB | Acknowledgments |

### Hardware / Specialized Services
| Service | Size | Responsibility |
|---------|------|---------------|
| `BluetoothPrinterService.ts` | 10 KB | Bluetooth printer for enterprise queue tokens |
| `VoiceAnnouncementService.ts` | 17 KB | Voice announcements for queue system |

---

## Components Reference

### Core Patient-Facing
- `PatientDashboard.tsx` — Patient main dashboard
- `Dashboard.tsx` — Dashboard overview widget
- `Records.tsx` — Medical records display
- `Messages.tsx` — Chat/messaging
- `Notes.tsx` — Patient notes
- `Upload.tsx` — File uploads
- `MedicationCard.tsx`, `EnhancedMedicationCard.tsx`, `MedicationTimeline.tsx` — Medication display
- `FluidIntakeTracker.tsx` — Fluid intake monitoring
- `LabResultsCard.tsx`, `LabTrendGraph.tsx` — Lab results and trends
- `CKDDashboard.tsx` — Chronic Kidney Disease dashboard
- `AlertsPage.tsx`, `AlertSummaryWidget.tsx` — Clinical alerts
- `UpcomingTestsCard.tsx` — Upcoming tests

### Doctor-Facing
- `DoctorDashboardMain.tsx` — Doctor main dashboard
- `DoctorActionPanel.tsx` — Doctor actions panel
- `DoctorPatientViewRedesign.tsx` — Patient view for doctors
- `PatientProfileForDoctor.tsx` — Patient profile view
- `PatientDoctorNotes.tsx` — Doctor notes on patient
- `NephrologistScratchpad.tsx`, `NephrologistSnapshot.tsx` — Nephrology specialty views
- `NephrologistSnapshotView.tsx` — Snapshot display
- `DoctorReferralCard.tsx`, `DoctorReferralCodeCard.tsx` — Referral system

### Admin-Facing
- `AdminDashboardMain.tsx` — Admin dashboard
- `AdminLabTypesPanel.tsx` — Lab types management
- `AdminVisitEditModal.tsx` — Visit editing
- `RuleBuilder.tsx`, `RuleEngineAdmin.tsx` — CDS rule management

### Enterprise-Facing (`components/enterprise/`)
- `EnterpriseDashboardHome.tsx` — Main enterprise dashboard
- `ReceptionDashboard.tsx` (113 KB) — Reception workflow
- `TrackPatientsPage.tsx` (87 KB) — Patient tracking
- `PrescriptionPage.tsx` (58 KB) — Prescription management
- `PharmacyDashboard.tsx` — Pharmacy workflow
- `PharmacyQueueDisplay.tsx` (20 KB) — Pharmacy queue display
- `EnterpriseCKDSnapshotView.tsx` — CKD snapshots for enterprise
- `EnterpriseDoctorDashboard.tsx`, `EnterprisePharmacyDashboard.tsx` — Enterprise sub-dashboards

### Modals (`components/modals/`)
- `PrescriptionModal.tsx` (121 KB) — Main prescription modal
- `DoctorTeamAuditModal.tsx` (50 KB) — Team audit
- `MobilePrescriptionInput.tsx` (39 KB) — Mobile prescription input
- `ManageDrugsModal.tsx` (22 KB) — Drug management
- `PrescriptionListModal.tsx` (19 KB) — Prescription list
- `DoctorSettingsModal.tsx` (16 KB) — Doctor settings
- `VisitHistoryModal.tsx` (13 KB) — Visit history
- `TermsAndConditionsModal.tsx` (13 KB) — T&C
- `AddPatientModal.tsx` — Add patient
- `ManageDiagnosesModal.tsx` — Diagnosis management
- `LabDrilldownModal.tsx` — Lab details
- `MedicationDrilldownModal.tsx` — Medication details
- `ProfileModal.tsx` — Profile modal

### Layout (`components/layout/`)
- `Sidebar.tsx` — Main sidebar (patient/doctor)
- `DoctorSidebar.tsx` — Doctor-specific sidebar
- `Header.tsx` — Header component
- `SimpleHeader.tsx` — Minimal header
- `MobileBottomNav.tsx` — Mobile bottom navigation
- `DoctorMobileBottomNav.tsx` — Doctor mobile nav

### Auth (`components/auth/`)
- `Auth.tsx` — Base auth component
- `AuthChooser.tsx` — Auth type selector
- `Login.tsx` — Patient login
- `AdminLogin.tsx` — Admin login
- `EnterpriseLogin.tsx` — Enterprise login
- `HospitalPatientLogin.tsx` — Hospital patient login
- `ProfileSetup.tsx`, `ProfileSetupNew.tsx` — Profile setup
- `TrialCodeVerification.tsx` — Trial code verification

---

## Hooks (`hooks/`)

| Hook | Size | Purpose |
|------|------|---------|
| `useRealTimeChatV2.ts` | 15 KB | Real-time chat with Supabase subscriptions |
| `useRealTimePatients.ts` | 10 KB | Real-time patient list updates |
| `useHospitalName.ts` | 1.1 KB | Hospital name retrieval |
| `useDocumentTitle.ts` | 496 B | Document title management |

---

## Utilities (`utils/`)

| Utility | Size | Purpose |
|---------|------|---------|
| `requestUtils.ts` | 7.1 KB | `withTimeout` — **all Supabase calls must use this** |
| `pdfGenerator.ts` | 8.2 KB | Standard prescription PDFs (jsPDF) |
| `kkcPdfGenerator.ts` | 18 KB | KKC clinic-specific PDF format |
| `tokenReceiptGenerator.ts` | 5.7 KB | Patient token receipts for enterprise queue |
| `ckdUtils.ts` | 11 KB | CKD calculations (GFR, staging, etc.) |
| `presetMedications.ts` | 14 KB | Preset medication list |
| `toastUtils.ts` | — | `showSuccessToast` / `showErrorToast` wrappers |
| `avatarUtils.ts` | — | Avatar generation |
| `tamilFontHelper.ts` | — | Tamil language font support for PDFs |
| `doctorActorSession.ts` | 2.2 KB | Doctor actor session management |
| `enterpriseCacheUtils.ts` | 4.3 KB | Enterprise caching utilities |

---

## Lib (`lib/`)

| File | Purpose |
|------|---------|
| `supabase.ts` (22 KB) | Supabase singleton client — PKCE auth, CapacitorStorage on native, 30s fetch timeout |
| `supabase.types.ts` (6.7 KB) | Database Row/Insert/Update TypeScript types |
| `CapacitorStorage.ts` | Session storage for native (Capacitor) instead of localStorage |
| `canvasUtils.ts` | Canvas/drawing utilities |
| `utils.ts` | General utilities |

---

## Types

- `types.ts` (root) — Shared app-level TypeScript types
- `src/types/index.ts` (11,706 lines) — Main type definitions including all DB types
- `src/types/alerts.ts` — Alert-related types
- `src/types/prescription.ts` — Prescription types
- `src/types/visitHistory.ts` — Visit history types

**Important:** The `User` type has both camelCase fields (app convention) and snake_case aliases (DB field names). When reading from Supabase, use snake_case; map to camelCase for app state.

---

## Database

- **Canonical schema:** `supabase_schema.sql`
- **Rule engine schema:** `rule_engine_schema.sql`
- **65+ SQL files** at root and in `sql/` covering migrations, fixes, schema extensions
- RLS (Row-Level Security) enabled on all tables
- Key schema extensions:
  - `ckd_schema_extension.sql` — CKD features
  - `prescriptions_schema.sql` — Prescription system
  - `cds_alerts_schema.sql` — Clinical Decision Support alerts
  - `clinic_isolation_schema.sql` — Multi-tenant clinic isolation
  - `clinic_roles_schema.sql` — Clinic-specific roles
  - `custom_lab_types_schema.sql` — Custom lab type definitions
  - `realtime_chat_setup.sql` — Chat system
  - `referral_system_migration.sql` — Referral system
  - `visit_medications_schema.sql` — Visit medications
  - `scratchpad_schema.sql` — Nephrology scratchpad

See `DATABASE.md` for setup details.

---

## Mobile (Android/Capacitor)

- App ID: `com.beanhealth.app`
- App Name: `BeanHealth`
- Web directory: `dist/`
- Android scheme: HTTPS
- Splash screen: 2-second duration, color `#881337`
- OAuth deep link scheme: `com.beanhealth.app://oauth-callback`
- Handled in `App.tsx` via `DeepLinkHandler` (cold start + running app)
- `npm run mobile` — serves with host binding for LAN device access
- After web changes: `npx cap sync android` → build in Android Studio

---

## Key Coding Patterns

### 1. All Supabase calls must use `withTimeout`
```typescript
import { withTimeout } from '../utils/requestUtils';
const { data, error } = await withTimeout(
  supabase.from('table').select('*'),
  10000,
  'Descriptive timeout message'
);
```

### 2. Auth-gated components check `isInitialized` first
```typescript
const { user, profile, loading, isInitialized } = useAuth();
if (!isInitialized || loading) return <Spinner />;
```

### 3. Async effects track mount state
```typescript
const isMountedRef = useRef(true);
useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);
```

### 4. Toasts
```typescript
import { showSuccessToast, showErrorToast } from '../utils/toastUtils';
showSuccessToast('Saved successfully');
showErrorToast('Something went wrong');
```

### 5. Never call Supabase directly from components
All DB interactions go through `services/`. Components call services; services call Supabase.

### 6. Dark mode
Use Tailwind `dark:` classes. Theme state comes from `ThemeContext`.

---

## Notable Features

1. **Clinical Decision Support (CDS)** — Admin-configurable rule engine (`ruleEngineService` + `ruleEvaluator`) triggers clinical alerts based on patient vitals and lab values.
2. **AI Analysis** — Gemini integration for extracting vitals and generating health summaries from uploaded medical records (`geminiService.ts`).
3. **CKD Specialization** — Dedicated CKD dashboard, GFR/staging calculations (`ckdUtils.ts`), schema, and enterprise snapshot views.
4. **Enterprise Queue System** — Reception → token generation → Pharmacy queue flow with Bluetooth printer (`BluetoothPrinterService`) and voice announcements (`VoiceAnnouncementService`).
5. **Multi-tenant Clinic Isolation** — Each enterprise clinic isolated at DB level via RLS policies.
6. **Real-time** — Live chat, patient list updates, notification toasts via Supabase Realtime subscriptions.
7. **Multi-format PDF Generation** — Standard prescriptions, KKC clinic format, and queue token receipts.
8. **Referral System** — Doctor referral codes and patient invitation flows.
9. **Admin Impersonation** — Admins can view patient data as that patient via `impersonationService`.
10. **Tamil Language Support** — `tamilFontHelper.ts` for Tamil text in PDFs.

---

## Changelog
<!-- Append entries below after each significant change -->

| Date | Change | Files Affected |
|------|--------|---------------|
| 2026-03-11 | Initial full architecture documentation | CLAUDE.md |
| 2026-03-12 | Deleted stale root-level duplicates (components/, App.tsx) — src/ is the only source | components/, App.tsx |
| 2026-03-12 | MR number dropdown search + autofill in reception new registration | src/components/enterprise/ReceptionDashboard.tsx |
