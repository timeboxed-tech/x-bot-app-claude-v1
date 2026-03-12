# X Bot Automation Platform — Product Spec

## Overview

A web platform that allows users from approved domains to connect their X (Twitter) account and have it automated by an AI agent. The agent researches topics, drafts tweets, and publishes them on a user-defined schedule. Users retain full editorial control at all times.

Access is restricted to users with email addresses from the following domains:
- `thestartupfactory.tech`
- `ehe.ai`

---

## Data Model

### `users`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | string | Must be from an approved domain |
| `name` | string | |
| `created_at` | timestamp | |

### `bots`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | References `users` |
| `x_access_token` | string | OAuth access token |
| `x_access_secret` | string | OAuth access secret |
| `x_account_handle` | string | e.g. `@handle` |
| `prompt` | text | Topics, tone, and style instructions for the agent |
| `post_mode` | string | `auto` or `manual` |
| `posts_per_day` | int | Target number of posts per day, range 1–15 |
| `min_interval_hours` | int | Minimum gap between posts in hours, range 1–15 |
| `preferred_hours_start` | int | Start of preferred posting window, 0–23 |
| `preferred_hours_end` | int | End of preferred posting window, 1–24. Set to 0 and 24 respectively for no preference |
| `active` | bool | Whether the bot is running |
| `created_at` | timestamp | |

### `posts`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bot_id` | uuid FK | References `bots` |
| `job_id` | uuid FK | References the job that generated this post |
| `content` | text | Tweet content (editable by user) |
| `status` | string | `draft`, `scheduled`, `published`, `discarded` |
| `rating` | int | Nullable, 1–5 stars. User-assigned on any non-discarded post |
| `scheduled_at` | timestamp | When to publish (set on scheduling) |
| `published_at` | timestamp | When actually published to X |
| `created_at` | timestamp | |

**Status flow:** `draft → scheduled → published` or `draft → discarded`

In `auto` mode the worker moves the post from `draft` to `scheduled` immediately after creation. In `manual` mode the user does this explicitly via the UI. Both modes converge on the same `scheduled → published` step executed by the worker. Discarding is always a user action and is available on any post that has not yet reached `published`.

**Rating:** Users can rate any post in `draft`, `scheduled`, or `published` state with 1–5 stars. Ratings on published posts provide a feedback signal that can inform future prompt tuning.

### `jobs`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bot_id` | uuid FK | References `bots` |
| `status` | string | `pending`, `locked`, `completed`, `failed` |
| `lock_token` | uuid | Set atomically when a worker claims the job |
| `locked_at` | timestamp | Used to detect stale locks |
| `scheduled_at` | timestamp | When this job should run |
| `started_at` | timestamp | |
| `completed_at` | timestamp | |
| `created_at` | timestamp | |

---

## Scheduling Logic

All scheduling is handled in the database. No external job queue libraries are used.

### Computing the next `scheduled_at`

When a job completes, the worker computes the next job's `scheduled_at` as follows:

1. **Base interval** — divide 24 hours by `posts_per_day` to get the ideal gap (e.g. 5 posts/day → 4.8 hour base interval).
2. **Jitter** — apply a random ±10% adjustment to the base interval to avoid mechanical regularity (e.g. 4.8h base → anywhere from 4.32h to 5.28h).
3. **Minimum interval floor** — if the jittered interval is less than `min_interval_hours`, clamp it up to `min_interval_hours`.
4. **Preferred hours** — advance the candidate `scheduled_at` forward until it falls within the `[preferred_hours_start, preferred_hours_end)` window. If the window is too narrow to satisfy the minimum interval, skip to the next day's window. If `preferred_hours_start = 0` and `preferred_hours_end = 24`, no window constraint is applied.

### Job claiming

Workers poll for the next `pending` job where `scheduled_at <= now` and the associated bot is `active`. The claim is made atomically using `SELECT FOR UPDATE SKIP LOCKED` so only one worker across any number of running containers picks up each job. On claim, the worker sets `status = locked`, `lock_token = <new uuid>`, and `locked_at = now`.

### Stale lock recovery

On startup, and periodically during operation, each worker queries for jobs with `status = locked` and `locked_at < now - 10 minutes`. These are considered orphaned (e.g. the worker crashed mid-run). The worker resets them to `status = pending` so they are re-claimed on the next poll cycle.

---

## User Journeys

### Journey 1 — Registration & bot setup

1. User visits the platform and enters their work email.
2. System validates the email domain against the allowlist. Any other domain is rejected at this step.
3. A magic link is sent to the email. User clicks it and lands on the dashboard.
4. User clicks "Connect X account" and completes the X OAuth flow. The platform stores the access token and secret on the bot record.
5. User fills in their bot configuration:
   - **Prompt** — topics, tone, and posting style for the agent
   - **Post mode** — `auto` (agent publishes without intervention) or `manual` (user reviews before publishing)
   - **Posts per day** — 1 to 15
   - **Minimum interval** — 1 to 15 hours between posts
   - **Preferred posting hours** — a time range (e.g. 10–18) or 0–24 for no preference
6. User saves the bot. It is created as `active = true` and a first `pending` job is inserted into `jobs` with `scheduled_at = now`.

### Journey 2 — Automated job run (happy path)

1. A worker process polls `jobs` and finds a `pending` job with `scheduled_at <= now` for an active bot.
2. Worker atomically locks the job (`status = locked`, `lock_token`, `locked_at`).
3. Worker calls the AI agent with the bot's prompt. The agent researches relevant topics and drafts tweet content.
4. A post row is created with `status = draft`.
5. If `post_mode = auto`: the worker immediately sets the post to `status = scheduled` with `scheduled_at = now`, and the next poll cycle picks it up for publishing to X.
6. If `post_mode = manual`: the post remains as `draft` and appears in the user's review queue.
7. Job is marked `completed`. The next job row is inserted with `scheduled_at` computed per the scheduling logic above.

### Journey 3 — Publishing a scheduled post (worker)

1. Worker polls for posts with `status = scheduled` and `scheduled_at <= now`.
2. Worker calls the X API to publish the tweet using the bot's stored OAuth credentials.
3. On success: `status = published`, `published_at = now`.
4. On X API failure: post is left as `scheduled` and retried on the next cycle (or marked `failed` after N retries — implementation detail for the developer).

### Journey 4 — User reviews and acts on drafts (manual mode)

1. User logs in and navigates to their post queue. All posts with `status = draft` are shown, newest first.
2. For each post the user can:
   - **Edit** the content inline and save.
   - **Rate** the post with 1–5 stars.
   - **Schedule / publish** — sets `status = scheduled`, `scheduled_at = now` (or a future time if the user picks one). The worker picks it up and publishes it.
   - **Discard** — sets `status = discarded`. The post is removed from the active queue but retained in history.
3. Users can also discard any `scheduled` post that has not yet been published.

### Journey 5 — User rates a post

1. User views any post in `draft`, `scheduled`, or `published` state.
2. User taps a star rating (1–5). The `rating` field on the post is updated immediately.
3. Ratings can be changed at any time while the post is in a rateable state.
4. Published post ratings are retained as a feedback signal for future prompt refinement.

### Journey 6 — Server restart / stale lock recovery

1. A container running a job crashes mid-execution, leaving the job in `status = locked`.
2. On restart (or during a periodic health check), a worker queries for jobs with `status = locked` and `locked_at < now - 10 minutes`.
3. These orphaned jobs are reset to `status = pending`.
4. On the next poll cycle a worker picks them up and re-runs them from the start.

### Journey 7 — User pauses or reconfigures their bot

1. User sets `active = false` on their bot. Workers skip all `pending` jobs for inactive bots.
2. User can update `prompt`, `post_mode`, `posts_per_day`, `min_interval_hours`, or preferred posting hours at any time. Changes apply from the next scheduled job onward.
3. User can re-activate the bot at any time. Any pending jobs resume on the next poll cycle.

---

## Constraints & Business Rules

- Registration is restricted to `thestartupfactory.tech` and `ehe.ai` email domains.
- `posts_per_day` must be an integer between 1 and 15 inclusive.
- `min_interval_hours` must be an integer between 1 and 15 inclusive.
- Preferred posting hours are a range `[start, end)` within 0–24. Setting `start = 0` and `end = 24` disables the window constraint.
- Next job timing includes ±10% random jitter on the base interval, floored by `min_interval_hours`.
- Post ratings are integers 1–5, nullable. Ratings are allowed on `draft`, `scheduled`, and `published` posts. Discarded posts cannot be rated.
- A post can only be discarded while its status is `draft` or `scheduled`. Published posts cannot be modified, deleted, or discarded.
- In `manual` mode, no post is ever published without an explicit user action.
- Job locking uses `SELECT FOR UPDATE SKIP LOCKED` to guarantee a job is executed by at most one worker across all containers.
- Stale locks (older than 10 minutes) are reset to `pending` on worker startup or health check.
- Each completed job is responsible for scheduling the next job, ensuring continuous operation without a separate cron process.
