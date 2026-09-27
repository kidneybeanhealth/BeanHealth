# BeanHealth Connect

Follow-up calls for dialysis and kidney-care centres that keep their own
hospital system. A separate front end at **connect.beanhealth.in**, one login per
centre.

```
patient list in        CSV · Excel · pasted from WhatsApp          Patients tab
      ↓
protocol engine        missed sessions · labs due · reviews        Today tab
      ↓                (src/connect/protocol/engine.ts)
voice agent            Sarvam, in the patient's language           Today tab → Call
      ↓
response captured      red flag? callback asked?                   Alerts tab
      ↓                (DB trigger on hospital_voice_call_attempts)
dashboard + report     monthly outcomes, printable                 Reports tab
```

Connect is its own entry (`connect.html` → `src/connect/main.tsx`). It shares
the design system and the Supabase client with the main app and nothing else:
no AuthProvider, no role routing, no service worker. A Connect centre is an
ordinary hospital account (`users.role = 'enterprise'`) whose
`hospital_profiles.product = 'connect'`, on the same patient tables KKC uses.

---

## Going live — in this order

### 1. Run the migration
`sql/20260927d_connect.sql` in the Supabase SQL editor. Safe to re-run. Adds the
`connect` product, per-centre settings, patient programme fields, session / lab /
alert tables, the call `purpose` column, and the trigger that raises alerts.

Until it runs, Connect shows "not set up on this database yet" instead of data.

### 2. Point the subdomain at the app
`vercel.json` already sends `connect.beanhealth.in` to `connect.html`. The domain
itself has to be added once:

- Vercel → project **bean-health** → Settings → Domains → add `connect.beanhealth.in`
- If beanhealth.in's DNS is managed by Vercel, that is all. Otherwise add a
  `CNAME connect → cname.vercel-dns.com` at the DNS provider.
- Then promote a production build that contains Connect.

Before the subdomain exists, any deployment serves Connect at `/connect`
(`https://<preview>.vercel.app/connect`).

### 3. Create a centre
There is no self sign-up — a centre is a paying customer set up with them.

1. Supabase → Authentication → Users → **Add user**: the centre's email and a
   password, auto-confirm. Copy the user's UUID.
2. SQL, with that UUID:
   ```sql
   INSERT INTO public.users (id, email, name, role)
   VALUES ('<uuid>', '<email>', '<Centre name>', 'enterprise')
   ON CONFLICT (id) DO UPDATE SET role = 'enterprise', name = EXCLUDED.name;

   INSERT INTO public.hospital_profiles (id, hospital_name, product, default_call_language, voice_front_desk_number)
   VALUES ('<uuid>', '<Centre name>', 'connect', 'Tamil', '<front desk number>')
   ON CONFLICT (id) DO UPDATE SET product = 'connect';
   ```
3. The front-desk number is **required**: the agent reads it out when a patient
   reports a red flag, and calls are refused while it is empty. The centre can
   change it later in Settings.

### 4. Review calls work immediately
Review reminders use the existing Sarvam agent (v9) and the live
`place-review-call` function unchanged. Nothing else is needed for them.

### 5. Missed-session and lab calls need their own agents
They are **off** until you switch them on, and the centre cannot switch them on
itself. That is deliberate: see "Why a call type is not a setting" below.

1. Build two agents in the Sarvam console (spec below) and commit each.
2. Set the secrets:
   ```
   supabase secrets set SARVAM_APP_ID_MISSED_SESSION=<app id> SARVAM_APP_VERSION_MISSED_SESSION=<n>
   supabase secrets set SARVAM_APP_ID_LAB_DUE=<app id>        SARVAM_APP_VERSION_LAB_DUE=<n>
   ```
3. Deploy the purpose-aware function (this branch's version):
   `supabase functions deploy place-review-call`
4. Switch the type on for a centre:
   ```sql
   UPDATE public.hospital_profiles
   SET connect_settings = jsonb_set(coalesce(connect_settings, '{}'::jsonb),
                                    '{calls,purposesReady}', '["review","missed_session","lab_due"]'::jsonb, true)
   WHERE id = '<centre uuid>';
   ```

The function refuses a missed-session or lab call with a 503 until step 2 is
done — it never falls back to the review agent.

---

## Agent spec — missed session and lab reminder

Build each by copying the v9 review agent, so identity checking, language
mirroring, red-flag handling and the end-of-call webhook are identical.

**Variables — exactly these ten.** Sarvam rejects a call carrying an undeclared
variable, and `place-review-call` sends all ten for these purposes:

`patient_name` · `mr_number` · `doctor_name` · `last_visit_date` ·
`review_date` · `days_overdue` · `hospital_name` · `hospital_address` ·
`front_desk_number` · **`purpose_detail`**

`purpose_detail` is written for speech by Connect's engine, e.g.
*"Last missed Fri 25 Sep · next scheduled Mon 28 Sep"* or
*"CBC (due since Thu 17 Sep) · Kidney function (RFT) (due Tue 29 Sep)"*. The
review-specific variables may be empty and must be skipped when blank, as in v9.

**Script, missed session:** confirm identity → "you were due for dialysis on …
and we did not see you" → ask if they are well and when they can come → offer the
next scheduled session → red-flag screen (breathlessness, chest pain, very little
urine, swelling, drowsiness, fits): tell them to come now or go to the nearest
emergency, read `front_desk_number` digit by digit, set
`disposition = RED_FLAG_REPORTED`.

**Script, lab reminder:** confirm identity → which tests are due, from
`purpose_detail` → ask them to get them done / book → same red-flag screen.

**Neither script gives clinical advice.** They remind, ask, and escalate.

**Output variables, unchanged from v9** so the webhook and the alert trigger read
them without any change: `disposition` (incl. `RED_FLAG_REPORTED`,
`DO_NOT_CALL`, `PATIENT_DECEASED`), `reason_text`, `call_summary`, `spoke_to`,
`callback_requested` (lowercase yes/no), `preferred_day`. Keep the
`post_call_outcome_webhook` on_end tool and `callback_token`.

---

## How the engine decides (and what it never does)

`src/connect/protocol/engine.ts`, covered by `engine.test.ts`. Its rule is that a
wrong call is worse than no call:

- A session is **missed only when someone marked it missed**. An unmarked
  session is listed on Today and Attendance for a person to settle — never
  assumed missed. Forgetting to mark costs a call; it never causes a wrong one.
- A missed session followed by an attended one is recovered — no call.
- Two misses in a row (configurable) → urgent, top of the list.
- A lab never recorded has no baseline — counted, not called about.
- A review more than 30 days overdue (configurable) is past what a reminder can
  fix — no call.
- **One call per patient per day**, given to the most important reason that can
  actually be dialled.
- Never: do-not-call, on hold, deceased, left the programme, no dialable number,
  already reached about this, a call in progress, retried inside the wait
  window, or past the attempt limit (then "ring by hand").

Lab intervals in Settings are **starting points, not clinical guidance**. Each
centre's nephrologist confirms them.

## Why a call type is not a setting

`connect_settings.calls.purposesReady` is shown read-only in Settings and is
preserved on every save. If a centre could tick "missed session" before that
agent existed, the live function would dial with the review script — a patient
who missed dialysis would be reminded about a review. The purpose-aware function
also refuses such a call outright, so this is two independent locks.

## Alerts

Raised by a database trigger when the agent's final variables arrive on
`hospital_voice_call_attempts`: `RED_FLAG_REPORTED` → red flag,
`callback_requested = yes` → callback. The live webhook needed no change.

**WhatsApp:** each alert has one-tap forwarding to the coordinator and doctor
numbers in Settings. It opens WhatsApp with the message written; it does not
send by itself. Automatic sending needs a WhatsApp Business API account and an
approved message template — Meta calendar time, not code.

## Monthly report

`src/connect/protocol/report.ts`, covered by `report.test.ts`. "Came back within
7 days" is shown for patients **reached by a call** and patients **not called**,
side by side, and the report says plainly that this is a comparison, not proof
the call caused the return. Misses whose 7-day window has not closed are "too
recent to judge", not "did not come back". A causal number needs a holdout.

## Imports

Preview first; nothing is written until the operator presses Import. Updates
never blank a field the list left empty. A WhatsApp paste without patient IDs
uses the phone as the ID (`PH-9876543210`) so the same list pasted again updates
rather than duplicates — the preview says so on every such row. Dialysis days are
read as `MWF`, `TTS`, `Mon/Wed/Fri`, `1,3,5`; anything else (for example
"alternate days") is flagged, never guessed.

## Tests

```bash
npx vitest run src/connect
```
