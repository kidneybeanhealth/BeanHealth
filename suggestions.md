# Suggestions — security and fixes to work on later

The running list of vulnerabilities and fixes that have been found but not done yet.
**Every new security suggestion goes here**, with the date it was verified and how.
When one is done, move it to **Done** at the bottom with the commit, rather than
deleting it.

Last reviewed: **15 Oct 2026**, against the live Supabase project (`ektevcxubbtuxnaapyam`),
with read-only queries. Row counts are as of that day.

**Severity**
- **Critical**: patient data is open to anyone on the internet, no login needed.
- **High**: open to anyone with a little knowledge, or to any signed-in account.
- **Medium**: needs a hospital login, or an ID that is hard to get.
- **Low**: hygiene or process.

> **Why so much is open: three root causes**
> 1. **Every hospital login is one account underneath.** Reception, pharmacy, PAs, juniors
>    and the chief doctors all sit on the same Supabase auth user (the hospital). The
>    database therefore cannot tell them apart, and anything "only for doctors" is enforced
>    by the screens alone. Only Team & Audit is enforced on the server, through the chief
>    session check (`_doctor_require_chief_session`).
> 2. **The Patient App has no login.** A patient gets in with only an MR number, so the
>    tables and functions it uses were opened to anonymous visitors to make it work.
> 3. **The public key is public by design.** The Supabase "anon" key is in the website's
>    code. Any rule that allows `anon`, or `public` with no condition, is open to the
>    whole internet.

---

## Summary

| # | Severity | What | Effort |
|---|---|---|---|
| S1 | **Critical** | `medical-records` storage: anyone can list, download, overwrite and delete patient uploads | M |
| S2 | **Critical** | Patient vitals / intake / urine tables: anyone can read, edit and delete every hospital's rows | L |
| S3 | **Critical** | `debug_doctor_login`: unlimited, unlogged doctor-passcode guessing, open to anyone | XS |
| S4 | High | `find_patient_by_phone`: anyone gets a patient's name, email and BeanHealth ID from a phone number | XS |
| S5 | High | `get_pharmacy_queue`: anyone reads open legacy prescriptions (names, medicines, diagnosis) | XS |
| S6 | High | Patient App: an MR number alone opens a patient's prescriptions | L (with S2) |
| S7 | High | `doctor-signatures`: any signed-in account can replace a doctor's signature | S |
| S8 | High | Patient feedback is hidden from reception and PAs only in the app, not in the database | M |
| S9 | Medium | Doctor login codes: 9 of 14 stored in plain text; hashes readable by the hospital login | S |
| S10 | Medium | `hospital_pharmacy_queue` readable by anyone (patient names at every hospital) | S |
| S11 | Medium | `chat-files`: public bucket, and any signed-in account can read every chat attachment | S |
| S12 | Medium | `pharmacy_mark_dispensed` / `create_hospital_queue_entry` callable without login | XS |
| S13 | Medium | Rotate the Sarvam API key | XS |
| S14 | Low | Audit the remaining `{public}` INSERT rules | S |
| S15 | Low | Doctors must not share chief codes with PAs | process |

Effort: XS = minutes, S = an hour or two, M = half a day, L = a day or more.

---

## Security

### S1 — `medical-records` bucket is fully open · Critical
- **Evidence (15 Oct):** the storage rule `Allow all operations on medical-records` applies
  to role `public` (that includes not signed in) for **ALL** operations, with only
  `bucket_id = 'medical-records'` as its condition. The bucket is also marked public. It
  holds **24 patient uploads** (`uploads/…`) and 8 hospital logos (`hospital-logos/…`).
- **Who can do what:** anyone with the anon key can **list** every file, download it,
  upload, overwrite or **delete** it.
- **Fix:**
  1. Move the hospital logos into the existing public `hospital-logos` bucket and update
     `hospital_profiles.hospital_logo` / `avatar_url` to match.
  2. Make `medical-records` private, and drop the "Allow all" rule.
  3. Add rules: the owning patient (or their hospital) can read and write their own folder.
  4. Show files through signed URLs (`createSignedUrl`) instead of public URLs.
- **Breaks if done naively:** logos on posters, prescriptions and the Patient App, since
  their URLs are in `medical-records/hospital-logos/…`. Move the logos first.

### S2 — Patient vitals, intake and urine tables are open to anyone · Critical
- **Evidence:** `hospital_patient_vitals`, `hospital_patient_intakes` and
  `hospital_patient_urine_outputs` each have a rule `Allow all for anon`: **ALL**, role
  `public`, `USING true` / `WITH CHECK true`. Rows: **1,359 vitals, 39 intakes, 0 urine**.
- **Who can do what:** anyone can read every hospital's patient vitals, and change or delete them.
- **Why it is like this:** the Patient App writes vitals without a Supabase login (root cause 2).
  Used by `patientAppService.ts`, `PatientTrends.tsx` and `departmentPatientMetricsService.ts`.
- **Fix:** give the Patient App a real session, modelled on the doctor actor sessions:
  1. Verify the patient once (MR plus a second factor, see S6).
  2. Issue a session token stored hashed in a table.
  3. Route all patient reads and writes through SECURITY DEFINER RPCs that check the token.

  Then replace the anon rules with hospital-scoped ones (`auth.uid() = hospital_id`), so the
  doctor and reception screens keep working.

### S3 — `debug_doctor_login` lets anyone guess doctor passcodes · Critical
- **Evidence:** SECURITY DEFINER, executable by `anon`, no permission check. It takes
  `(hospital_id, doctor_id, passcode)` and reports whether the passcode matches, using the
  same check as the real login (`_doctor_passcode_matches`). Unlike `doctor_actor_login`,
  it writes **no audit entry** and has no attempt limit.
- **Why it is reachable:** doctor IDs are not secret. They are in dashboard URLs, and since
  8 Oct `feedback_resolve_location` returns the hospital's doctor IDs to anyone holding a
  poster code (that is how the "Which doctor did you see?" picker works). KKC's chief codes
  are hashed, but short codes can still be guessed one by one through this function.
- **Fix:** `DROP FUNCTION public.debug_doctor_login(uuid, uuid, text);` It is a leftover
  debugging tool and the app does not use it (verified by search, 15 Oct). Also consider
  limiting failed attempts in `doctor_actor_login`.

### S4 — `find_patient_by_phone` reveals patients by phone number · High
- **Evidence:** executable by `anon`, no permission check. It returns `id, name, email,
  beanhealth_id` for patient accounts whose linked hospital record has that phone.
- **Fix:** revoke from `anon` (and from `authenticated`, unless something needs it). It is
  not used by the current app. `find_patients_by_phone` and `verify_hospital_patient` check
  `app_access_enabled` but still need a review, since phone plus name is guessable.

### S5 — `get_pharmacy_queue` reveals legacy prescriptions · High
- **Evidence:** executable by `anon`, no permission check. With no clinic given it returns
  every open legacy prescription (`public.prescriptions`): patient name and details,
  medicines, diagnosis. **16 open rows** today.
- **Fix:** revoke from `anon`, or drop it. It belongs to the older standalone app and the
  current code does not use it.

### S6 — Patient App: an MR number alone opens a patient's records · High
- **Evidence:** `patient_app_lookup_mr(p_mr_number)` needs nothing but the MR number, and
  MR numbers are sequential (`KNH/YY/NNNNNN`). It is gated by `app_access_enabled`, which
  only **8 of 3,775** patients have today. `patient_app_get_prescriptions(p_patient_id)`
  then returns all of that patient's prescriptions to anyone, with no check at all (not
  even `app_access_enabled`).
- **Fix:** add a second factor at sign-in (date of birth, or an OTP to the registered phone),
  then the session token from S2; `patient_app_get_prescriptions` must require that token.
  **Do this before enabling the Patient App for more patients.**

### S7 — Any signed-in account can replace a doctor's signature · High
- **Evidence:** `doctor-signatures` has `Allow Authenticated Uploads` (INSERT) and
  `Allow Authenticated Updates` (UPDATE) for every authenticated user, with no owner or
  path check. 19 signature images. Signed-in accounts include the **20 patient accounts**.
  The signature prints on prescriptions.
- **Fix:** restrict INSERT/UPDATE to paths under the uploading hospital's own folder
  (`(storage.foldername(name))[1] = auth.uid()::text`), and move existing files into that
  layout. Public read can stay, because printing needs it.

### S8 — Patient feedback: lock it to the chief doctors in the database · High
- **Context:** on 15 Oct the register was hidden from reception and from PA/junior logins
  (commit `85952cc`). That is a screen-level rule. Because of root cause 1, anyone signed in
  as the hospital can still read `hospital_feedback`, including comments, named responses
  and voice-note paths, straight from the API using browser developer tools.
- **Fix (follow the Team & Audit pattern):**
  1. `doctor_feedback_register(p_hospital_id, p_chief_doctor_id, p_session_token, p_from, p_to, p_limit)`:
     SECURITY DEFINER; `PERFORM _doctor_require_chief_session(...)`; returns the same
     fields the panel reads now (response, location label, named patient, rated doctor).
  2. `doctor_feedback_delete(…, p_id)`: same check. Keep the current order (delete the
     voice note first, then the row).
  3. Drop the direct `SELECT`/`DELETE` rules for `authenticated` on `hospital_feedback`.
  4. **Voice notes:** the `feedback-audio` storage rules check ownership by reading
     `hospital_feedback`. Once direct reads are gone, that check would always fail. Move it
     into a SECURITY DEFINER helper (for example `feedback_audio_belongs_to(name, uid)`)
     used by the storage rules, or serve audio through an Edge Function that checks the
     chief session.
  5. `feedbackService.fetchFeedbackRegister` / `deleteFeedback` call the RPCs and fall back
     to the direct read on `PGRST202`, so the app keeps working if it ships before the SQL.
  6. Test with a `pg_temp` copy inside a rolled-back transaction, as was done for the
     8 Oct submit fix.
- **Note:** a hospital without PA logins (`enable_pa_actor_auth` off) has no chief session
  token, so it would lose the register. Today only KKC uses feedback, and it has PA logins on.

### S9 — Doctor login codes · Medium
- **Evidence:** `hospital_doctors.access_code` holds the chief code. **9 of 14** are plain
  text; they belong to other hospitals, and KKC's two are bcrypt-hashed. The table's rule
  (`auth.uid() = hospital_id`, ALL) lets the shared hospital login read the column.
  `DoctorDashboardWrapper.tsx` runs `select('*')`, which pulls the code or hash into every
  browser that opens a doctor dashboard. A bcrypt hash of a short numeric code can be
  reversed offline by trying every value.
- **Fix:** hash the remaining 9; `REVOKE SELECT (access_code) ON hospital_doctors FROM
  authenticated, anon`; replace `select('*')` with explicit columns; require longer codes.

### S10 — Pharmacy queue readable by anyone · Medium
- **Evidence:** `hospital_pharmacy_queue` rule `Public can view pharmacy queue`: SELECT,
  role `public`, `USING true`. That covers every hospital's queue: patient names and tokens
  (49 rows in the last day).
- **Probably exists for:** the pharmacy TV display (`PharmacyQueueDisplay`).
- **Fix:** give the display its own read path scoped to one hospital and today (a
  SECURITY DEFINER RPC with a display code), returning only token, first name and status.
  Then drop the open rule.

### S11 — Chat attachments · Medium
- **Evidence:** `chat-files` is a public bucket (35 files, mostly voice messages between
  patients and doctors). The rule `Authenticated users can view chat files` lets **any**
  signed-in account list and read all of them.
- **Fix:** make it private; allow reading only by the two people in the conversation (the
  folder is `<uuid>-<uuid>`, so check that `auth.uid()` is one of them); use signed URLs.

### S12 — Functions callable without login that change data · Medium
- `pharmacy_mark_dispensed(prescription_id)` marks any prescription dispensed and completes
  reviews. `create_hospital_queue_entry(hospital, patient, doctor)` adds queue entries.
  Neither checks who is calling. The IDs are hard to guess, but hospital and doctor IDs are
  not secret (S3).
- **Fix:** add `IF auth.uid() IS DISTINCT FROM <row's hospital_id> THEN RAISE …` at the top
  of each, and revoke from `anon`.
- Also review the rest of the 45 anon-executable SECURITY DEFINER functions listed on 15 Oct
  (`claim_review_notification_jobs`, `queue_manual_review_reminder`,
  `cleanup_old_hospital_activity_audit_logs`, …). Most should be `authenticated`-only or
  internal.

### S13 — Rotate the Sarvam API key · Medium
- The key may have been exposed during setup on 27 Sep. Generate a new key in the Sarvam
  console, update the `SARVAM_API_KEY` Supabase secret, and revoke the old one.

### S14 — Audit `{public}` INSERT rules · Low
- Several tables allow INSERT for role `public` (for example `hospital_profiles`, `clinics`,
  `hospitals`, `chat_messages`, `hospital_patient_reviews`, `hospital_notification_*`).
  Their `WITH CHECK` conditions were not reviewed on 15 Oct. Confirm each one ties the new
  row to `auth.uid()`.

### S15 — Shared chief codes · Low (process)
- The screens treat whoever signs in with a chief code as the doctor. If a PA uses
  Dr. Prabhakar's or Dr. Divakar's code, they see patient feedback and Team & Audit, and
  their actions are logged as the doctor's. Tell KKC that PAs and juniors must use their
  own logins.

---

## Reliability and data integrity

| # | What | Notes |
|---|---|---|
| R1 | **Send to Pharmacy feels unresponsive** | After "Confirm & Send" the modal returns to the editable form while ~7 database round trips run (1–1.5 s, worst seen 5.7 s), so doctors tap again. Fixes: keep a locked "Sending…" state until the save finishes; fold the review sync and supersede steps into `doctor_save_prescription_and_send` (one round trip); stop the full modal redraw on every keyboard open/close (`setLayoutState` creates a new object each time); render the confirm pop-ups as stable components (`<ConfirmSendModal />` is defined inside the modal, so it is rebuilt on every redraw and can swallow a tap). |
| R2 | **Missing indexes on `hospital_queues`** | No index on hospital/doctor/patient/date: 337k full scans against 70k index scans. Add `(hospital_id, created_at)`, `(doctor_id, created_at)` and `(patient_id)`. |
| R3 | **Security rules re-evaluate `auth.uid()` per row** | About 40 rules call `auth.uid()` directly instead of `(select auth.uid())`. This is a Supabase performance pattern, harmless at today's size. |
| R4 | **Deploy the `place-review-call` date guard** | Committed 28 Sep (`1a5e759`), not deployed. It stops the "you missed your appointment" script being read to patients whose review has not passed yet. Needs approval to deploy. |
| R5 | **Edit & Resend cancels a dispensed original** | Routine dialysis now uses Load previous Rx, so this is rarer. 306 dispensed prescriptions (11 dialysis) were marked cancelled by it before. Repair is optional and needs care: the review-sync trigger fires on any UPDATE of `hospital_prescriptions` and could bring back old review dates. |
| R6 | **The live queue's Past Rx carries old review dates** | Dialysis Load previous Rx clears past dates (`asRxTemplate`); the queue's Past Rx does not. |
| R7 | **Review Assignment Map hazards** | See CLAUDE.md: the Track Patients bulk re-sync stamps the other doctor's reviews; the reception call-log lookup is not doctor-scoped; walk-in auto-complete closes the earliest review of any doctor. |
| R8 | **Known issue: wrong patient on prescription** | From CLAUDE.md, 12 Mar: identity banner in the modal, block the queue while the picker is open, confirm-with-MR step. |

## Code health

| # | What |
|---|---|
| C1 | 311 TypeScript errors (9 in KKC screens); the generated DB types have **no** hospital tables, so 385 `as any` casts bypass checking. Regenerate types (`supabase gen types`). |
| C2 | No automated tests for the KKC screens (queue, prescribing, pharmacy, Past Records). 28 old login tests fail on a missing `localStorage` stub. Vitest also picks up `.claude/worktrees/**`; exclude it in config. |
| C3 | 99 database calls in the three hospital dashboards without `withTimeout` (project rule 1); 15 components call Supabase directly (rule 5). |
| C4 | Very large files (8 over 1,500 lines; doctor dashboard 3,149 lines with 65 pieces of state); main JS bundle 1.96 MB (528 KB gzip). No linter configured. |

## Product and operations follow-ups

- Have someone at KKC read the machine-written **Tamil** on the feedback form and posters.
- A nephrologist should sign off Connect's default **lab intervals**.
- Build the Sarvam agents for **review reminder**, **missed dialysis session** and **lab due**, then turn each on (`purposesReady`).
- Fix the Sarvam call summary that prints the literal text "patient_name".
- Bring KKC's AI calling into v11 (v12's AI Call Campaign, usage and statement), Missed Followup only, behind `VITE_VOICE_CALLS_ENABLED`.
- Optional: a transparent BeanHealth mark for posters; a neutral WhatsApp link preview for feedback links.

---

## Done

| Date | Item | Commit |
|---|---|---|
| 15 Oct 2026 | Patient feedback hidden from reception and PA/junior logins (screen level; S8 is the database half) | `85952cc` |
| 13 Oct 2026 | Edit & Resend opens the exact prescription; Visit History reports load failures; dialysis register search covers all time | `fdbd0a8` |
| 8 Oct 2026 | Anonymous feedback could not be saved (RECORD bug in `submit_hospital_feedback`) | `b1f42cd` |
