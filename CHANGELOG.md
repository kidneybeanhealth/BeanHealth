# Changelog

All notable changes to this project will be documented in this file.

## [2.6.0] - 2024-12-22

### Added

#### Terms and Conditions System
- **TermsAndConditionsModal** - Professional, healthcare-compliant T&C modal
  - Scrollable terms content with industry-standard sections
  - Medical disclaimer with prominent warning styling
  - Must scroll to bottom before accepting (scroll tracking)
  - Checkbox confirmation required before proceeding
  - Matches app's dark/light theme styling
- **TermsService** - Backend service for managing terms acceptance
  - Check if user has accepted current terms version
  - Store acceptance timestamp and version
  - Support for future terms version updates
- **Database Schema** - New fields for terms tracking
  - `terms_accepted` - Boolean flag for acceptance status
  - `terms_accepted_at` - Timestamp of acceptance
  - `terms_version` - Version string for tracking updates
- **Integration with Auth Flow**
  - New patients must accept terms after profile creation
  - Existing patients prompted on first login after feature deployment
  - Once accepted, never shown again (unless new version is released)
  - Terms check integrated into AuthContext

### Files Added
- `components/TermsAndConditionsModal.tsx` - Modal component
- `services/termsService.ts` - Terms acceptance service
- `terms_conditions_schema.sql` - Database migration

### Changed
- Updated `AuthContext.tsx` - Added needsTermsAcceptance state and acceptTerms function
- Updated `App.tsx` - Added terms modal gate before PatientDashboard
- Updated `types.ts` - Added terms fields to User interface

---

## [2.5.0] - 2024-12-19

### Added

#### Real-time Notifications System
- **NotificationContext** - Global context for managing message notifications
- **Toast Notifications** - Airbnb-style minimal popups for new messages
  - Clean white cards with subtle shadows
  - Color-coded indicators (green for regular, pulsing red for urgent)
  - Web Audio API for notification sounds (no external files needed)
  - Dark mode support
- **Sidebar Badges** - Unread count and urgent message indicators
- **Real-time Updates** - Supabase subscription for live notification updates

#### Urgent Credits System
- **UrgentCreditsContext** - Real-time urgent credit tracking
- **Credit Deduction** - Automatic deduction when sending urgent messages
- **Live UI Updates** - Credits update instantly in:
  - Messages chat bar (badge next to urgent toggle)
  - Billing page (urgent credits card)
- **Supabase Real-time** - Database subscription for credit changes

#### Messaging Enhancements
- **Inline Audio Recorder** - WhatsApp-style voice recording with:
  - Real-time waveform visualization (Web Audio API)
  - Recording timer
  - Play/pause preview
  - One-click send
- **Message Previews** - Contact list shows:
  - Last message text (or 🎤 for voice, 📎 for attachments)
  - "You:" prefix for sent messages
  - Smart timestamps (Time, Yesterday, Day, Date)
- **Unread Indicators** - Chats with unread messages show:
  - Light green background tint
  - Bold contact name and preview
  - Green timestamp
  - Count badge

### Changed
- Updated PatientDashboard to include notification and credits providers
- Improved Messages component with context integration
- Enhanced Billing page with real-time credit display
- Refined chat UI with better spacing and visual hierarchy

### Technical
- Created `/contexts/NotificationContext.tsx`
- Created `/contexts/UrgentCreditsContext.tsx`
- Created `/components/InlineAudioRecorder.tsx`
- Updated ChatService to deduct urgent credits on urgent message send
- Added type assertions for Supabase type safety

---

## [2.4.0] - Previous Release

### Features
- Prescription system with PDF generation
- AI-powered medical record analysis
- Real-time chat with file sharing
- Doctor-patient relationship management
