# NephroTrack - Patient Portal PRD

## Problem Statement
Build a clinical app for kidney transplant patients and end-stage renal disease (ESRD) patients.
Patients log in via MR ID. The app tracks vitals, medications, and displays prescriptions.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB (local)
- **Auth**: JWT (httpOnly cookies + localStorage Bearer token fallback)
- **Design**: Outfit/IBM Plex Sans fonts, Sage green primary (#3E6150), clean clinical aesthetic

## Core Requirements (Static)
1. MR ID + Password login & registration
2. 4 vitals recording: Blood Pressure, Body Weight, Blood Glucose, Urine Output
3. Daily medication checklist with adherence tracking
4. Past vitals: list view + Recharts line graph trends (filterable by type/date range)
5. Past prescriptions view (read-only, expandable cards)
6. Patient profile: MR ID, name, father name, DOB, age, diagnosis
7. Edit / Delete for any vital record
8. Demo patient: MR001 / demo123

## Pages Implemented
- `/login` — Sign In + Register tabs
- `/` — Dashboard (vitals entry cards + medication checklist)
- `/vitals-history` — List view + Trends (4 charts)
- `/prescriptions` — Prescription history (expandable)
- `/profile` — Patient profile details

## What's Been Implemented (2026-04)
- [x] JWT auth with MR ID (httpOnly cookies + localStorage fallback)
- [x] Patient registration and login
- [x] Seed demo patient (MR001/demo123) with 14 days of vitals + 2 prescriptions
- [x] Dashboard with 4 WheelPicker vital cards (drum-roll iOS-style inertial scroll)
  - BP: dual wheel (SYS/DIA), Weight, Glucose, Urine Output
  - Confirmed state: picker goes grey, "Edit" button reactivates
- [x] Daily medication checklist with progress bar and adherence persistence
- [x] Vitals history: filtered list + 4 Recharts line charts
- [x] Vitals edit (dialog) and delete functionality
- [x] Prescriptions page with expandable medication details + doctor notes
- [x] Patient profile page with calculated age
- [x] **BeanHealth** branding throughout
- [x] **Bottom Navigation Bar** with 4 tabs (Dashboard, History, Prescriptions, Profile)
  - Floating action button active state: green pill, elevated (-6px), shadow
- [x] **Tamil / English language toggle** in header (Noto Sans Tamil font support)
  - Full UI translation for all pages
- [x] Responsive design, premium clinical design (Outfit/IBM Plex Sans + Noto Sans Tamil)

## Seed Data
- Patient MR001: Ramesh Kumar, DOB 1975-06-15, ESRD post-transplant
- 2 Prescriptions from Dr. Arvind Sharma
- 14 days of historical vitals (BP, weight, glucose, urine)
- 3 days of medication adherence history

## Prioritized Backlog

### P0 (Next Sprint)
- Connect to Supabase enterprise app (doctor assigns patient, sends prescriptions)
- Real-time prescription sync from enterprise app

### P1
- Push notifications for missed medications
- PDF export of vitals report for doctor appointments
- Offline-capable vitals entry (PWA)

### P2
- Alerts for out-of-range vitals (customizable thresholds)
- Medication reminder notifications
- Lab results section
- Multi-language support (Hindi, regional languages)

## Test Credentials
- MR ID: MR001 | Password: demo123 | Name: Ramesh Kumar
