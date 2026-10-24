# Sarvam voice agent — review reminder calls

Outbound AI calls to patients due for review. Started from the **AI Call** button on
a Past Records card; the outcome lands in Call History alongside calls typed in by
reception.

## Shape

```
Browser  ──▶  place-review-call (Edge Fn)  ──▶  Sarvam
                    │                              │
              writes attempt row              places the call
                                                   │
Call History  ◀──  sarvam-call-webhook  ◀──────────┘  outcome, minutes later
```

The browser never sees the Sarvam key. Everything from `.env` here is a **server
secret**, because the key can place billable calls to any number.

## Design rules (do not quietly change these)

**The agent never moves an appointment.** The webhook writes a followup row and a
transcript; it does not touch `next_review_date`, even when the patient says
"I'll come tomorrow". A caller cannot know whether a doctor saw the patient that
afternoon — that is exactly how KNH/25/028475 lost her 13 Aug review to a 14 Jul
call log. A human reads the transcript and reschedules deliberately.

**The webhook is authenticated by a single-use token,** not a signature. Sarvam
documents no request signing, so the endpoint is public. Each attempt mints a
random `webhook_token`, echoed back in the query string and metadata, and only
matches a row still awaiting an outcome. If Sarvam adds signing later, verify it
*as well* — don't replace this.

**`phone_e164` is the gate.** A null means the patient cannot be dialled, and the
function refuses rather than guessing. Requires `sql/20260814_phone_e164.sql`.

## Setup

### 1. Migrations

```bash
psql "$DATABASE_URL" -f sql/20260814_phone_e164.sql
psql "$DATABASE_URL" -f sql/20260817_voice_call_attempts.sql
```

### 2. Commit the agent in the Sarvam console

Committed on `app_id: Conversatio-aaae688f-7e96`. **Pin `SARVAM_APP_VERSION=10`** once version 10 below is committed; until then, 9.

Version history, because pinning the wrong one silently changes the call:

| Version | What it has |
|---|---|
| 3 | Original agent. **No `post_call_outcome_webhook` tool** — a call on this version connects and reports nothing back |
| 5 | Adds the on_end webhook tool and declares `callback_token` |
| 6 | English-only, inbound-style greeting. **Do not use** — both were mistaken: English-only strands most of a Coimbatore patient list in `LANGUAGE_BARRIER`, and "thank you for calling" is false on an outbound call |
| **7** | v5 + the `callback_token` guard line + `LANGUAGE_BARRIER`, with v6's language and greeting reverted |
| 8 | v7 + `call_summary` output variable, wired into the on_end tool payload |
| 9 | v8 + the patient-identity lock and a wider `reason_text` |
| **10** | v9 + a short opener that waits for the patient, patient nudges, and the "why did you miss" question with a `missed_reason` code. See below |

`SARVAM_APP_VERSION` is **required**, not optional. Leaving it unset does not
track the newest commit — `version_filter` defaults to `specific`, so the API
rejects the call:

```
422 app_config: app_version is required when version_filter is specific
```

`place-review-call` therefore refuses with a 503 naming the secret, rather than
round-tripping an upstream error that names a parameter we never send. After
editing the agent in the console, commit it and repin this to the new number —
otherwise production keeps running the old script.

### Version 10 — what to change in the console

Asked for by KKC on 24 Oct 2026, before the first 50 calls (25 old patients and
25 new patients from Missed Followup). Two problems with v9:

1. **The opening is lost.** The agent speaks the moment the call connects. On an
   Indian mobile call the first second or two of audio often never reaches the
   patient, so the introduction is half-heard, the patient says nothing, the agent
   nudges ("irukeengala?") and then hangs up.
2. **The reason for missing is not asked.** The agent states the review date and
   asks when they can come. The doctor most wants to know *why* they did not come,
   especially from patients who will not come back.

**There is no "wait N seconds before greeting" setting** in Sarvam's documented
agent settings, and the outbound API takes no delay either (its only per-call
overrides are `initial_bot_message`, `initial_state_name` and
`initial_language_name`). The fix is to make the first line expendable and then
wait. If Sarvam support offers a delay before the greeting, set it to 2 s as well.

**A. Call settings** (Agent → Settings → call settings)

| Setting | Value |
|---|---|
| Nudge quiet callers | On. Nudge 1 after **6 s**: "ஹலோ, கேக்குதுங்களா? கொங்குநாடு கிட்னி சென்டர்ல இருந்து பேசுறோம்." Nudge 2 after **6 s** more: "ஹலோ? நான் ஆஷா, கொங்குநாடு கிட்னி சென்டர்ல இருந்து." |
| Hang up after unanswered nudges | On, but only after both nudges (about 12 s of silence, not 3) |
| Eagerness to respond | **Patient** |
| Detect when the caller stops talking | On |
| Let callers interrupt | On |
| Sound sensitivity | Medium (Low if KKC's patients are often on noisy roads) |

**B. Greeting** (Canvas → instruction → greeting): only `ஹலோ, வணக்கம்!`

**C. Add to the instruction** (above the existing flow; keep everything else,
including the identity lock, red flags and "never move the appointment"). In the
canvas, insert each `@variable` from the `@` picker rather than typing it:

```
OPENING
- Your greeting is only "Hello, vanakkam". The first seconds of a mobile call are often
  cut off, so after the greeting say nothing more and wait for the person to reply.
- When they reply (hello, yes, who is this), introduce yourself: you are Asha from
  @hospital_name, and ask whether you are speaking with @patient_name or a family member.
- If they seem not to have heard you, repeat the introduction once, slowly.
- Do not ask "are you there?" yourself; the call settings handle silence.

WHY THEY MISSED: ask on every call
- After saying their review was due on @review_date, ask why they could not come that
  day, before asking when they can come. Say the doctor would like to know.
- Let them finish. Do not argue, judge, lecture or give medical advice.
- If the answer is vague ("busy", "later", "no time"), ask one gentle follow-up:
  "Was it the travel, the cost, your health, or something else?" Only one follow-up.
- If they say they will not come back, the reason is the most important thing to bring
  back to the doctor. Make sure you have it before the call ends, then ask:
  "Is there anything the hospital could do that would help you come?"
- If they now go to another hospital, accept it. Ask which one only if they offer it.
- Then continue as before: when can they come (no appointment needed, OP hours).

RECORDING
- reason_text: one short English sentence with the patient's reason in their own
  meaning, e.g. "Son works weekdays, no one to bring him" or "Feels fine, thinks the
  review is not needed". If they said what would help, add "Would help: ...". Fill it
  whenever they gave any reason; leave it empty only if they would not say.
- missed_reason: exactly one of TRAVEL_DISTANCE, COST, FEELING_BETTER,
  UNWELL_OR_ADMITTED, NO_ESCORT, WORK_OR_FAMILY, FORGOT, TREATED_ELSEWHERE,
  NOT_SATISFIED, OTHER, NOT_SHARED.
```

**D. Variables** (Variables tab → Output variables).
- New: `missed_reason`, data type **Enum**, values TRAVEL_DISTANCE, COST,
  FEELING_BETTER, UNWELL_OR_ADMITTED, NO_ESCORT, WORK_OR_FAMILY, FORGOT,
  TREATED_ELSEWHERE, NOT_SATISFIED, OTHER, NOT_SHARED. Extraction prompt: "Why the
  patient did not come for their review on the date given, as one category. NOT_SHARED
  if they were not asked or would not say."
- Change `reason_text`'s extraction prompt to: "The patient's reason for not coming to
  their review, in one short English sentence in their own meaning. Add 'Would help: …'
  if they said what would help them come. Empty if they gave no reason."
- Add `missed_reason` to the `post_call_outcome_webhook` on_end tool's payload next to
  `reason_text`. The
webhook stores every variable it receives in
`hospital_voice_call_attempts.final_agent_variables`, so no deploy is needed for it
to be kept; the AI Call Campaign page reads it and shows "Why they missed".

**E. Commit as version 10**, place one test call to your own phone, then repin
`SARVAM_APP_VERSION=10`. Until the repin, every call still runs v9.

### 3. Secrets

```bash
supabase secrets set \
  SARVAM_API_KEY='<generate a fresh one — never paste it into chat or commit it>' \
  SARVAM_ORG_ID='019e90c9-a385-71c1-8c7b-9af8e9f40a1e' \
  SARVAM_WORKSPACE_ID='019e90c9-a3b9-7b89-83a9-603d4e05449b' \
  SARVAM_APP_ID='Conversatio-aaae688f-7e96' \
  SARVAM_APP_VERSION='3' \
  SARVAM_CONNECTION_ID='b839c927-ef-d640a95a-d734' \
  SARVAM_AGENT_PHONE_NUMBER='+918071581310' \
  SARVAM_WEBHOOK_BASE_URL='https://<project-ref>.functions.supabase.co/sarvam-call-webhook' \
  SARVAM_FRONT_DESK_NUMBER='0422 2494333' \
  SARVAM_HOSPITAL_ADDRESS='Kongunad Kidney Centre, Coimbatore'
```

`SARVAM_FRONT_DESK_NUMBER` is **required**. The agent reads it out digit by digit
when a patient reports a red-flag symptom, so `place-review-call` refuses to dial
at all when it is unset — a call that goes silent in an emergency is worse than a
call that never happened.

`SARVAM_SEND_CALLBACK_TOKEN` is **off unless set to `true`**. It adds a tenth
agent variable, `callback_token`, which the agent's `on_end` tool echoes back so
the webhook can authenticate an outcome that arrives by that route rather than
the platform's own callback. Sarvam validates `agent_variables` against the set
the agent declares and rejects the entire call otherwise:

```
422 Agent variables '{'callback_token'}' not found in agent variables
    of app 'Conversatio-aaae688f-7e96'
```

So it is not a degradation to leave it off — sending it before the variable
exists stops every call. Declare `callback_token` on the agent, recommit, then
turn this on.

`SARVAM_CONNECTION_ID` and `SARVAM_AGENT_PHONE_NUMBER` are a **pair** — the number
only works with the connection it was bought under. Don't mix them if you add more
connections later.

`org_id` / `workspace_id` go in the **URL path**, not the body. Easy to miss: the
docs render them as `{org_id}` / `{workspace_id}` placeholders.

### 4. Deploy

```bash
supabase functions deploy place-review-call
supabase functions deploy sarvam-call-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required — Sarvam has no Supabase session.
That is what makes the token check load-bearing.

### 5. First call

Use **your own mobile**, on a test patient whose phone is set to it. Then check:

- a row in `hospital_voice_call_attempts` moves `placing → placed → completed`
- a matching row appears in `hospital_patient_followups`
- the Call History card on that patient shows `[AI call] …`
- `next_review_date` is **unchanged**

## There is no transcript, and there will not be one from the agent

Confirmed with Sarvam's agent tooling: the on_end tool can send **declared
variables only**, and no system variable exposes the conversation. Recording,
transcript retention and export are platform infrastructure, outside what agent
authoring can reach. Both are open with Sarvam support.

`call_summary` is the substitute: the agent writes 3-5 factual sentences in
English at the end of every call — attendance intent, stated reason, anything
raised about condition or medication, any request — quoting the patient's own
phrases where they matter. English regardless of call language, so reception
reads every call the same way.

It is rendered under **"Agent's account of the call"** and that label is load-
bearing. This is an LLM paraphrase. If a family reports a death, or a patient
describes a symptom, somebody will act on those words — and they must know they
are reading the agent's summary rather than a quote. A paraphrase that reads
like a record is worse than no record.

## Two outcome paths, and what each carries

| | Platform webhook (`webhook_config.url`) | Agent `post_call_outcome_webhook` (on_end) |
|---|---|---|
| Fires | Never observed — two connected calls, no delivery | On call end |
| Auth | `?token=` query string | `callback_token` in the body |
| Carries | status, duration, **transcript**, final variables | declared output variables only |

The webhook endpoint accepts both shapes. The on_end tool is what actually
works today, and it **cannot carry the transcript** — Sarvam exposes no system
variable for it, so it is not addable from the agent surface. Retrieving the
verbatim conversation needs either the platform webhook fixed or a polling
endpoint; both are open with Sarvam support.

Because shape B has no carrier status, its presence is read as `connected` — the
agent only reaches on_end if the call connected.

## Outcome mapping

| Sarvam `status` | `call_status` written |
|---|---|
| `connected` | `picked` |
| `no_answer` | `not_picked` |
| `busy` | `busy` |
| `failed` | `not_reachable` |

Unrecognised values fall back to `not_reachable`; the raw value is kept in
`hospital_voice_call_attempts.sarvam_status`.

## Agent variables sent to the script

Exactly the nine the agent declares:

`patient_name` · `mr_number` · `doctor_name` · `last_visit_date` · `review_date` ·
`days_overdue` · `hospital_name` · `hospital_address` · `front_desk_number`

Dates are pre-formatted for speech ("13 August 2026"). An empty string means "we
don't know" — the agent script skips anything blank rather than guessing, so never
substitute a placeholder. Opening language defaults to Tamil.

## Dispositions the webhook acts on

The agent sets `disposition` before every call ends. Three change the record
rather than just being logged:

| Disposition | Effect |
|---|---|
| `PATIENT_DECEASED` | Marks the patient deceased and cancels every open review |
| `DO_NOT_CALL` | Sets `do_not_call`; `place-review-call` then refuses to dial them again |
| `RED_FLAG_REPORTED` | Call History entry is prefixed `*** RED FLAG - REVIEW NOW ***` |

All others are recorded on the Call History entry as `[AI call · DISPOSITION]`
with the patient's own words. `reason_text` is preferred over the transcript
summary, since it is what the patient actually said, and the entry is suffixed
with who answered, whether a callback was asked for, and any preferred day.

**`callback_requested` is lowercase `yes` / `no`** — the single exception in an
otherwise uppercase enum set. It is compared case-insensitively, so a future
normalisation on Sarvam's side cannot silently turn every callback request into a
no. `user_name` exists on the agent but is unreferenced; we deliberately do not
send it.

There is no live transfer — Sarvam has no escalation tool here. A red flag is
handled in the conversation (come now / nearest emergency / front desk number)
and then surfaced loudly for a human to follow up.

## Before this runs unattended

Currently manual, one patient at a time, with a human pressing the button. Moving
to scheduled batch calling (Sarvam Campaigns) needs decisions that are not code:

- **DND / TRAI compliance** — Sarvam exposes a DND list API
- **Patient consent** to receive automated calls
- **What the agent must never say** — it is a reminder, not clinical advice
- **Who reads the transcripts** where a patient asked to reschedule
