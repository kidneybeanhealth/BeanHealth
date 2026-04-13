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
| Email | @emailjs/browser |
| Image Cropping | react-easy-crop |
| Printing | react-to-print |

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
│   │   ├── enterprise/             # 12 enterprise modules
│   │   ├── icons/                  # 54 custom SVG icon components
│   │   ├── layout/                 # 6 layout components (Sidebar, Header, BottomNav)
│   │   ├── landing/                # LandingPage.tsx + mock.ts
│   │   ├── modals/                 # 13 modal components
│   │   ├── prescriptions/          # Hospital-specific prescription modal selector + templates
│   │   ├── ui/                     # 9 shadcn/custom UI primitives
│   │   └── common/                 # TwoStepConfirmModal
│   │
│   ├── contexts/                   # 6 context providers
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
| `TenantContext` | `contexts/TenantContext.tsx` | Multi-tenant hospital config — used by `PrescriptionModalSelector` to route to hospital-specific prescription modal |

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

### Prescription Modals (`components/prescriptions/`)
Multi-tenant prescription modal routing — selects the right prescription UI per hospital config.
- `PrescriptionModalSelector.tsx` — Traffic cop; reads `TenantContext` to render the correct modal
- `templates/StandardPrescriptionModal.tsx` — Generic (hospital-agnostic) prescription template
- `templates/KKCPrescriptionModal.tsx` — KKC clinic-specific prescription template

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

### Other Root-Level Components
- `PrinterSetupModal.tsx` — Bluetooth printer configuration modal with live ESC/POS preview (includes dummy MR number for layout testing)
- `ProfilePhotoUploader.tsx` — Profile photo upload with image cropping (react-easy-crop)

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

- **Canonical schema:** `supabase_schema.sql` / `supabase/migrations/supabase_schema.sql`
- **Rule engine schema:** `rule_engine_schema.sql`
- **65+ SQL files** at root and in `supabase/migrations/` covering migrations, fixes, schema extensions
- RLS (Row-Level Security) enabled on all tables
- **Supabase project:** `https://ektevcxubbtuxnaapyam.supabase.co`

See `DATABASE.md` for setup details.

### Table Inventory

#### Core (supabase_schema.sql)
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | `id`, `email`, `name`, `role` (patient/doctor/admin/enterprise), `specialty`, `date_of_birth`, `condition`, `subscription_tier`, `urgent_credits`, `beanhealth_id` | Extended by CKD extension: `age`, `ckd_stage`, `comorbidities`, `baseline_weight`, `daily_fluid_target` |
| `vitals` | `patient_id`, `blood_pressure_value`, `heart_rate_value`, `temperature_value`, `glucose_value`, `weight_value`, `spo2_value`, `recorded_at` | Extended by CKD extension with weight & SpO2 |
| `medications` | `patient_id`, `name`, `dosage`, `frequency` | Basic patient medications |
| `medical_records` | `patient_id`, `date`, `type`, `summary`, `doctor`, `category`, `file_url` | Uploaded records |
| `patient_doctor_relationships` | `patient_id`, `doctor_id` | M:M link table |
| `chat_messages` | `sender_id`, `recipient_id`, `text`, `audio_url`, `is_urgent`, `timestamp` | Realtime enabled via pg_notify |

#### CKD Extension (ckd_schema_extension.sql)
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `fluid_intake` | `patient_id`, `amount_ml`, `fluid_type`, `recorded_at` | Daily fluid tracking |
| `lab_results` | `patient_id`, `test_type` (creatinine/egfr/bun/potassium/hemoglobin/bicarbonate/acr), `value`, `unit`, `status`, `test_date` | Trigger `trigger_auto_update_ckd_stage` auto-updates `users.ckd_stage` on eGFR insert |
| `upcoming_tests` | `patient_id`, `test_name`, `scheduled_date`, `completed` | Scheduled lab tests |

#### Prescriptions (prescriptions_schema.sql)
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `prescriptions` | `doctor_id`, `patient_id`, `medications` (JSONB array), `notes`, `status` | JSONB format: `[{name, dosage, frequency, duration, instructions, timing}]` |

#### Enterprise / Hospital
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `hospital_patients` | `hospital_id`, `name`, `age`, `token_number`, `linked_user_id`, `phone`, `mr_number` | Walk-in patients; `linked_user_id → users.id` for BeanHealth ID cross-linking |
| `hospital_queues` | `hospital_id`, `patient_id`, `doctor_id`, `queue_number`, `status` (pending/in_progress/completed/cancelled) | Reception → doctor queue |
| `hospital_doctors` | `hospital_id`, `name`, `specialty` | Enterprise doctors (not in `users` table) |
| `hospital_doctor_drugs` | `doctor_id`, `name`, `dosages[]`, `default_timing` | Per-doctor saved drug list for prescription autocomplete |
| `hospital_prescriptions` | `hospital_id`, `doctor_id`, `patient_id`, `medications` (JSONB), `queue_id` | Enterprise prescriptions (separate from standalone `prescriptions`) |
| `hospital_pharmacy_queue` | `hospital_id`, `prescription_id`, `patient_name`, `token_number`, `status` (waiting/calling/dispensed/skipped) | Pharmacy calling system; realtime enabled |
| `hospital_patient_reviews` | `hospital_id`, `patient_id`, `review_date`, `status` | Follow-up review tracking |
| `hospital_patient_followups` | `hospital_id`, `review_id`, `patient_id`, `called_at`, `call_status` (picked/not_picked/busy/not_reachable), `attended` | Call attempt log for review patients |

#### CDS / Clinical Decision Support (cds_alerts_schema.sql)
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `cds_alert_definitions` | `rule_id`, `name`, `category` (renal/electrolyte/fluid/adherence/ops), `severity` (INFO/REVIEW/URGENT), `trigger_conditions` (JSONB), `is_preset` | Admin-configurable rules; 6 built-in presets |
| `cds_alert_instances` | `rule_id`, `patient_id`, `doctor_id`, `severity`, `rationale`, `acknowledged_at`, `cooldown_expiry` | Fired alerts per patient |
| `cds_alert_audit_log` | `alert_instance_id`, `action` (fired/acknowledged/suppressed/escalated/dismissed/modified/created/disabled), `actor_id` | Immutable audit trail |
| `cds_patient_alert_overrides` | `patient_id`, `rule_id`, `enabled`, `threshold_overrides` (JSONB) | Per-patient rule customization |

#### Rule Engine (rule_engine_schema.sql)
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `rule_versions` | `alert_id`, `version`, `rule_json` (JSONB), `severity` (info/review/high/critical), `enabled`, `effective_from/to`, `approved_by` | Version-controlled; governance fields for high/critical approval |
| `snapshot_rule_set` | `rule_version_ids[]` | Immutable record of which rules were active during evaluation |
| `patient_snapshot` | `patient_id`, `ckd_stage`, `risk_tier` (Stable/Watch/High-risk), `action_state` (no-action/review/immediate), `abnormal_trends` (JSONB) | Append-only; never update, always insert new row |
| `alert_events` | `patient_id`, `rule_version_id`, `fired_at`, `matched_value` (JSONB), `acknowledged_at` | Immutable alert event log |
| `current_patient_snapshot` | — | Materialized view: latest snapshot per patient (refresh via `refresh_current_snapshot()`) |

#### Identity
| Feature | Details |
|---------|---------|
| `users.beanhealth_id` | Universal patient ID (format: `BH-XXXXXX`), unique across hospitals. Function: `generate_beanhealth_id()`. Links app patients to walk-in hospital patients via `hospital_patients.linked_user_id`. |

### Key Schema Extensions (file list)
- `ckd_schema_extension.sql` — CKD features, `fluid_intake`, `lab_results`, `upcoming_tests`
- `prescriptions_schema.sql` — Standalone prescription system
- `cds_alerts_schema.sql` — Clinical Decision Support alerts
- `rule_engine_schema.sql` — Versioned rule engine + patient snapshots
- `beanhealth_id_schema.sql` — Universal patient identity across hospitals
- `enterprise_reception.sql` / `enterprise_recreate_reception_v2.sql` — Hospital walk-in queue
- `004_pharmacy_queue.sql` — Pharmacy calling queue (realtime)
- `hospital_doctor_drugs_schema.sql` — Per-doctor drug library
- `realtime_chat_setup.sql` — Chat pg_notify triggers
- `visit_medications_schema.sql` — Visit-specific medications
- `custom_lab_types_schema.sql` — Admin-defined custom lab types
- `20260308_patient_followup_calls.sql` — Reception follow-up call tracking
- `scratchpad_schema.sql` — Nephrology scratchpad

### DB Functions
| Function | Purpose |
|----------|---------|
| `calculate_ckd_stage(egfr)` | Returns CKD stage string from eGFR value |
| `auto_update_ckd_stage()` | Trigger: auto-updates `users.ckd_stage` on eGFR lab insert |
| `generate_beanhealth_id()` | Generates unique `BH-XXXXXX` ID |
| `get_active_rule_versions()` | Returns all currently enabled, non-deprecated rule versions |
| `refresh_current_snapshot()` | Refreshes `current_patient_snapshot` materialized view |
| `update_updated_at_column()` | Generic trigger function for `updated_at` timestamps |

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
5. **Multi-tenant Clinic Isolation** — Each enterprise clinic isolated at DB level via RLS policies. `TenantContext` also drives hospital-specific UI variants (e.g., prescription modal templates via `PrescriptionModalSelector`).
6. **Real-time** — Live chat, patient list updates, notification toasts via Supabase Realtime subscriptions.
7. **Multi-format PDF Generation** — Standard prescriptions, KKC clinic format, and queue token receipts.
8. **Referral System** — Doctor referral codes and patient invitation flows.
9. **Admin Impersonation** — Admins can view patient data as that patient via `impersonationService`.
10. **Tamil Language Support** — `tamilFontHelper.ts` for Tamil text in PDFs.

---

## Changelog
<!-- Append entries below aft er each significant change -->

| Date | Change | Files Affected |
|------|--------|---------------|
| 2026-03-11 | Initial full architecture documentation | CLAUDE.md |
| 2026-03-12 | Deleted stale root-level duplicates (components/, App.tsx) — src/ is the only source | components/, App.tsx |
| 2026-03-12 | MR number dropdown search + autofill in reception new registration | src/components/enterprise/ReceptionDashboard.tsx |
| 2026-03-12 | Drug default food timing (nil/A/F/B/F/E/S/S/C B/F) per drug in ManageDrugsModal; auto-applied in PrescriptionModal on drug select | src/components/modals/ManageDrugsModal.tsx, PrescriptionModal.tsx |
| 2026-03-12 | Past Rx button in live queue — load previous prescription pre-filled into modal, send as new queue prescription | src/components/EnterpriseDoctorDashboard.tsx |
| 2026-03-12 | Department field autocomplete in reception new registration (18 departments, 1 suggestion at a time) | src/components/enterprise/ReceptionDashboard.tsx |
| 2026-03-12 | Pushed all local changes to new branch v8 on GitHub (unrelated history to remote main) | — |
| 2026-03-16 | Fix diagnosis duplication in mobile send preview — flush `diagnosisSearchQuery` in `handleSend()` before showing preview | `src/components/modals/PrescriptionModal.tsx` |
| 2026-03-16 | Increase prescription frequency font size `text-[9px]` → `text-[11px]` for better print legibility | `src/components/modals/PrescriptionModal.tsx` |
| 2026-03-16 | Remove phone number and Instagram footer from token receipt (ESC/POS output and visual preview) | `src/utils/tokenReceiptGenerator.ts`, `src/components/PrinterPreview.tsx` |
| 2026-03-16 | Fix duplicate `=====` divider in token print preview after footer removal | `src/components/PrinterPreview.tsx` |
| 2026-03-16 | Fix MR number not printed on queue reprint — was hardcoded `undefined`, now reads `queueItem.patient.mr_number` | `src/components/enterprise/ReceptionDashboard.tsx` |
| 2026-03-16 | Add dummy MR number to printer setup sandbox preview so MR row is always visible during layout testing | `src/components/PrinterSetupModal.tsx` |
| 2026-03-17 | Add multi-dosage support for saved drugs: dosage list input in Manage Saved Drugs, persisted `dosages` array, and per-row dosage suggestion dropdown on drug selection while still allowing manual typing | `src/components/modals/PrescriptionModal.tsx`, `src/components/modals/ManageDrugsModal.tsx`, `ADD_DOSAGES_TO_DRUGS.sql` |
| 2026-03-17 | Redesign PrescriptionModal Manage Saved Drugs with explicit Type/Drug/Dosages/Default Timing fields, persist `default_timing`, and hydrate dosage suggestions even when saved drug is typed manually before clicking dosage | `src/components/modals/PrescriptionModal.tsx` |
| 2026-03-30 | Reception delete flow only removes the patient record when explicitly deleting from Past Records, keeping single-visit queue deletes intact | `src/components/enterprise/ReceptionDashboard.tsx` |
| 2026-04-03 | Add TenantContext for multi-tenant hospital config; add prescriptions/ directory with PrescriptionModalSelector + StandardPrescriptionModal + KKCPrescriptionModal templates | `src/contexts/TenantContext.tsx`, `src/components/prescriptions/` |
| 2026-04-03 | CLAUDE.md audit: corrected icon count (56→54), enterprise count (13→12), documented prescriptions/ dir, TenantContext, PrinterSetupModal, ProfilePhotoUploader, and added @emailjs/browser / react-easy-crop / react-to-print to tech stack | `CLAUDE.md` |
| 2026-04-06 | Added scalable enterprise review workflow foundation: new shared `enterpriseReviewService` for normalized past-record retrieval with review category/date filters, wired Reception Past Records to use shared service + filter chips + calendar filter, and synced review updates from pharmacy dispense using the shared review sync helper | `src/services/enterpriseReviewService.ts`, `src/components/enterprise/ReceptionDashboard.tsx`, `src/components/EnterprisePharmacyDashboard.tsx`, `CLAUDE.md` |
| 2026-04-07 | Added Past Records New Registration workflow with no token number, optional review date, MR duplicate guard, and a time-limited review_completed bucket that falls back to review-date categorization after two days | `src/components/enterprise/ReceptionDashboard.tsx`, `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-07 | Fixed review filter bucketing for legacy completed rows without `completed_at`: now uses `updated_at` fallback and re-enters date-based buckets (due_today/upcoming/not_completed) instead of sticking in review_completed | `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-07 | Refined review bucketing again for unresolved filter gaps: review table `next_review_date` now takes precedence over prescription date, and legacy completed rows without `completed_at` use `created_at` fallback (then `updated_at`) before aging out to date-based buckets | `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-07 | Root-cause fix for Past Records filter mismatches: per-patient review selection now prioritizes active (`pending`/`rescheduled`) review rows before deriving category, instead of taking first row by `updated_at` which could select stale completed/cancelled rows | `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-07 | Fixed Supabase 400 patient-load failures in Past Records filters by chunking large `patient_id in (...)` lookups for prescriptions/reviews, preventing oversized REST query URLs | `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-09 | Redesigned Past Records cards to non-collapsible stacked patient detail format (name/review date, age, S/o/W/o, bold MR), removed phone/BH ID from card display, changed View Rx to open a prescription list popup before opening individual Rx, and added Call History section inside Call Log popup showing call date/status/response | `src/components/enterprise/ReceptionDashboard.tsx`, `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-09 | Fixed Past Records UX regressions: opening an individual Rx now closes the intermediate View Rx popup, and search input no longer refetches on every keystroke (prevents lag and focus loss while typing) | `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-09 | Added `Over Due` and `Followup Needed` filters in Past Records; overdue now maps to past review dates, and patients with latest follow-up call status `not_picked` are prioritized into `followup_needed` category | `src/services/enterpriseReviewService.ts`, `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-09 | Added call history preview directly on Past Records patient cards (outside popup) using latest follow-up logs with date/status/response | `src/services/enterpriseReviewService.ts`, `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-09 | Refined Past Records UX: moved call history preview into card right-side action space, added strict `Due Tomorrow` filter bucket (distinct from upcoming), and added `Print List` to print filtered patient rows (name, age, S/o/W/o, MR ID, due date, last visit date) in document-friendly table format | `src/components/enterprise/ReceptionDashboard.tsx`, `src/services/enterpriseReviewService.ts`, `CLAUDE.md` |
| 2026-04-09 | Refined Past Records card ergonomics: call history now sits close to patient details in right-side panel with latest-first preview and collapsible overflow after 2 entries; Print List moved into filter context and limited to `Due Today` / `Due Tomorrow`; call log reschedule date input no longer prefilled by latest review date | `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-09 | Polished Past Records card visual layout to reduce tightness: upgraded to breathable two-panel card with clearer hierarchy, larger action targets, improved spacing, and cleaner call-history card styling while preserving existing workflow | `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-09 | Fixed Vite/Babel JSX parse break after Past Records layout refactor by rewriting the patient-card render block with clean balanced JSX structure | `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-09 | Enabled debounced Past Records search (350ms) so typing auto-fetches results without pressing Enter, while keeping manual Enter search support | `src/components/enterprise/ReceptionDashboard.tsx`, `CLAUDE.md` |
| 2026-04-12 | Imported Patient-app beta from `origin/Patient-app` onto isolated integration branch: added patient app module (components/contexts/i18n/service/styles), wired `/patient-app` route and auth chooser entry, and gated hospital phone-login records by `app_access_enabled` while preserving enterprise flow and patient-identity safeguards | `src/components/patient/`, `src/contexts/LanguageContext.tsx`, `src/contexts/PatientAppContext.tsx`, `src/i18n/patientTranslations.ts`, `src/services/patientAppService.ts`, `src/styles/patient.css`, `src/routes/index.tsx`, `src/components/auth/AuthChooser.tsx`, `src/components/auth/HospitalPatientLogin.tsx`, `src/services/authService.ts`, `sql/patient_app_schema.sql`, `sql/20260331_patient_app_access.sql`, `CLAUDE.md` |
| 2026-04-12 | Added Patient App access-control toggle in Past Records for both reception and enterprise doctor dashboards, backed by shared `updatePatientAppAccess` service and surfaced in shared past-records data model (`app_access_enabled`) | `src/services/enterpriseReviewService.ts`, `src/components/enterprise/ReceptionDashboard.tsx`, `src/components/enterprise/DoctorPastRecordsPanel.tsx`, `CLAUDE.md` |
| 2026-04-12 | Enforced Patient App access gate in MR login flow: `lookupByMRID` now fails closed unless `app_access_enabled === true`, and persisted patient-app sessions are revalidated on app load so toggled-off users are logged out | `src/services/patientAppService.ts`, `src/contexts/PatientAppContext.tsx`, `CLAUDE.md` |
| 2026-04-12 | Hardened Patient App access control for scale: added DB migration to make `patient_app_lookup_mr` authoritative with server-side `app_access_enabled` gating (`access_denied` payload), and updated frontend guard for backward-compatible rollout with legacy RPC payloads | `sql/20260412_patient_app_lookup_access_gate.sql`, `src/services/patientAppService.ts`, `CLAUDE.md` |
| 2026-04-12 | Fixed Patient App Vitals BP value box scaling on small and large screens by replacing fixed inline sizing with responsive pill styles (clamped font/padding, adaptive min-width, and compact fallback spacing) | `src/components/patient/VitalsCard.tsx`, `src/styles/patient.css`, `CLAUDE.md` |
| 2026-04-12 | Updated Auth Chooser flow: removed legacy `I'm a Patient` and `I Visited a Hospital` cards, promoted Patient App card as the patient entry path, and preserved existing Doctor + Enterprise login flows | `src/components/auth/AuthChooser.tsx`, `CLAUDE.md` |
| 2026-04-13 | Added scalable department-isolated Active Queue patient metrics architecture: new adapter-style service for queue metrics (`nephrology` profile active, non-nephrology safely unconfigured), plus collapsible SaaS-style Patient Metrics panel in doctor queue showing vitals/consumption freshness and today's values without blocking queue actions | `src/services/departmentPatientMetricsService.ts`, `src/components/EnterpriseDoctorDashboard.tsx`, `CLAUDE.md` |
| 2026-04-13 | Upgraded doctor queue metrics from single-day snapshot to date-wise timeline from each patient's last visit to today, with tablet-optimized scrollable metric table (BP/glucose/weight/fluid/salt/urine) while preserving department-isolated adapter architecture | `src/services/departmentPatientMetricsService.ts`, `src/components/EnterpriseDoctorDashboard.tsx`, `CLAUDE.md` |
| 2026-04-13 | Adjusted queue timeline behavior for testing and visibility: removed last-visit boundary and now render all stored patient-app metric dates in descending order (latest → oldest), with header copy aligned to stored-history range | `src/services/departmentPatientMetricsService.ts`, `src/components/EnterpriseDoctorDashboard.tsx`, `CLAUDE.md` |
| 2026-04-13 | Fixed Active Queue tablet misalignment by switching queue rows to a stable two-column grid with a consistent action-button matrix, and added explicit Patient App access-disabled messaging inside the metrics panel when `app_access_enabled` is false | `src/components/EnterpriseDoctorDashboard.tsx`, `CLAUDE.md` |


## Known Issues (To Be Fixed)

### [OPEN] Wrong patient on prescription — mismatched patient identity in PA prescription flow
**Reported:** 2026-03-12 | **File:** `src/components/EnterpriseDoctorDashboard.tsx`

A prescription typed for patient **Vishnu Patel (KNH/17/017575)** was sent and recorded under **Prabati (KNH/25/024744)**. Root cause is likely one of:

1. **Queue reorder misclick (most probable):** Live queue reorders during use; PA clicked Prescribe on Prabati's row thinking it was Vishnu's after the list shifted.
2. **Race condition in `handlePastRxForQueueItem`:** `selectedPatient` and `selectedQueueId` are set synchronously at the start, but the async Supabase fetch completes later. If the PA clicks "Past Rx" on two different patients in quick succession, the state can end up with Patient A's identity but Patient B's prescription content (or vice versa).
3. **Prescription picker misclick:** The picker modal is non-blocking — the queue behind it stays clickable. Clicking a second patient's "Past Rx" while the picker is open overwrites `selectedPatient` before the PA selects from the picker.

**Fixes applied (2026-03-12):**
- `pastRxQueueItem` cleared at the start of `handlePastRxForQueueItem` — prevents stale modal flash
- `pastRxQueueItem` cleared in both success paths of `handleSendToPharmacy` — prevents stale state persisting after send

**Still to consider:**
- Prominent patient name/MR banner inside PrescriptionModal so mismatch is obvious before sending
- Make the prescription picker overlay block queue interaction while open
- Add a send-confirmation step showing patient name + MR number

**Delete this entry once resolved.**

---

| 2026-04-10 | Wired the enterprise doctor dashboard past-records tab to the shared reception review service so it now uses the current reception past-records data model instead of the legacy doctor-only prescription query | `src/components/EnterpriseDoctorDashboard.tsx`, `CLAUDE.md` |
| 2026-04-10 | Added reception-style past-records panel to enterprise doctor dashboard with review filters, review-date filter, print list, call log modal, call history preview, and expandable Rx history | `src/components/enterprise/DoctorPastRecordsPanel.tsx`, `src/components/EnterpriseDoctorDashboard.tsx`, `CLAUDE.md` |

## Git / Branch Notes

### This repo has two unrelated git histories
The local V7 codebase and the remote `main` branch on GitHub have **no common ancestor** (`git merge-base` returns nothing). They are separate lineages. The local snapshot was taken as a full copy — not cloned from the remote.

- **Remote `main`** — older divergent line with its own commit history
- **Local / v8** — V7 snapshot (already contains all the same fixes as remote main) + new features built here

**Do NOT assume remote `main` has features missing from local just because `git log` shows different commits. Always verify by checking the actual file contents before concluding anything is missing.**

### Lesson learned (2026-03-12)
When `git pull` showed "no common ancestor" and listed ~10 remote commits not in local history, the assumption was made that those 10 fixes were absent from the local codebase. This was **wrong** — the fixes were already present in the V7 snapshot (the code was taken after those fixes). The git history divergence does not mean the code is behind. **Always grep/read the actual files to confirm whether a fix is present before warning the user.**
