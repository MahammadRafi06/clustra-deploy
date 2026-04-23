# AI PM Review — Deploy Models UI + `clustra-ai-service` Backend

Reviewer: senior PM perspective
Scope:
- UI: `/home/mahammad/clustra-deploy/ui/src/app/deploy-models/`
- API: `/home/mahammad/Desktop/clustra-ai-service/`
- Includes uncommitted changes on both repos

---

## TL;DR — what to ship first

Three themes matter before this product is credible to "non-wizards":

1. **Language, not layout.** The chrome is now on-brand, but the *words* still read like an internal research tool. Jargon like ISL, OSL, TTFT, TPOT, SILICON/HYBRID/EMPIRICAL/SOL, aggregated vs. disaggregated is undefined in the UI. A new user won't complete a run without a person next to them.
2. **Job outcome story.** The backend already emits a rich audit trail (new `gitops_state.py`, `gitops_status` field, `/jobs/{id}/audit`) but the UI only *barely* starts to show it (`useJobAudit`, `JobRunConsole`, `RecentRunsPanel` are uncommitted and partially wired). Ship that loop — it's the single biggest trust uplift.
3. **Production hardening of the async pipeline.** Indefinite retries, unbounded job retention, untyped rate-limiting, no per-user quotas, `Recreate` deployment, and soft-cancel that doesn't actually stop the worker are all production-blocking if usage grows. None are visible to users today; all will bite during incident response.

Everything else below is polish or investment.

---

## Part 1 — The product story (what the user sees)

### 1.1 Information scent is weak

The user arrives at `/deploy-models` and sees Project, Application, a 5-tile task selector, then one of five deeply technical forms. There is **no "what is this page"** and **no "which task should I pick"** guidance.

| Tile today | What a non-expert hears | Suggested one-liner the tile should carry |
|---|---|---|
| Best Deployment Plan | "Something about planning?" | "Sweep configs and pick the best agg or disagg setup for this model." |
| Quick Deploy | "Deploy but fast?" | "Skip the sweep — generate manifests using a known-good shape." |
| Experiment | "Like A/B testing?" | "Re-run a saved config or an inline YAML. For developers." |
| Compatibility Check | "Yes/no support?" | "Is (model, GPU, backend) known to work? No sweep, no deploy." |
| Estimate Performance | "Benchmark?" | "Predict TTFT / throughput for a specific shape, without running it." |

**Ask:** each `TaskSelector` tile gets a two-sentence description *above* the CTA, not below. Add a 20-word eyebrow on top of the page telling the user what this page is for. Today the page is too terse for first-time use. This is the single highest-leverage copy change.

### 1.2 Tooltips on every jargon label

Required for: ISL, OSL, TTFT, TPOT, "E2E Latency Target", "Prefix Cache Length", "KV Cache Memory Fraction", "Database Mode" (+ each of its four options), "Decode EC2 Instance (disagg)", "Top-N Results", "Dynamo Version Override", "Attention DP / MoE TP / MoE EP", "GEMM/KV/FMHA/MoE/Comm Quant Mode".

These aren't niceties — many of them are *required inputs* on the Estimate page. A user who can't define TPOT cannot use the product.

**Implementation:** extend [FieldInput.tsx](src/app/deploy-models/components/FieldInput.tsx) with an optional `help?: string`; render a `HelpIcon` (already available via argo-ui — see repos-list.tsx) next to the label. Persist copy in `options.ts` so ops/PMs can edit it without touching React.

### 1.3 Deploy Mode should explain *where it deploys*

`DEPLOYMENT_MODE_HINT` currently just describes agg vs disagg. Missing: "When set, the service commits Kubernetes manifests to the Git repo associated with this Argo CD application." That is the single biggest hidden side effect of clicking Run, and it's not mentioned anywhere.

Add a clear "This will commit to `{repo.url}` on branch `{targetRevision}` at path `{path}`" notice above Run, using the ContextSelector summary data the UI already has ([ContextSelector.tsx:214-240](src/app/deploy-models/components/ContextSelector.tsx#L214-L240)).

### 1.4 Run semantics are invisible

On clicking Run in `DefaultPage` the user is in a 4-state machine (preflight → queued → running → committed). Today the status pill shows one word. The backend now exposes a `gitops_status` with values `queued | retrying | committed | noop | failed | cancelled` plus a retry clock.

**Ask:**
- Surface `gitops_status` as a second status pill next to the main status.
- When `retrying`, render "Git commit will retry at `{next_retry_at}`. You can close this page safely." (Uses backend's existing scheduling data.)
- When `noop`, say "No changes committed — the manifests were already current."
- When `failed`, surface `git_commit_error` verbatim — users debugging a broken deploy need the error, not "failed".

### 1.5 Cancel is a lie

User clicks Cancel → the DB row flips to CANCELLED, but the background thread keeps running (`clustra_ai_service/jobs.py:331-336`). The UI then shows "Cancelled" and sets the user free. If they submit again, two jobs compete for the thread pool.

Two problems:
1. **Product:** if the promise is "cancel = stop work," we're lying. The dominant user reaction when a job takes too long is "cancel and retry with different params." The second run is queued behind the first and may actually be *slower*.
2. **Confirmation:** cancel has no confirm dialog today. [JobStatusBanner.tsx:60](src/app/deploy-models/components/JobStatusBanner.tsx#L60) triggers the API on click.

**Asks (pick one):**
- **A — cheap, honest copy:** Rename to "Discard result" and add a modal "The worker will keep running until it finishes, but its output will be thrown away. Continue?"
- **B — actual cancellation:** Propagate a stop-signal into aiconfigurator (cooperative cancellation via `threading.Event`, checked between sweep iterations). Stretch goal, real UX win.

And — disable the cancel button while `cancelling=true` so double-clicks don't fire two DELETE requests.

### 1.6 Recent runs panel should be the default landing state

The uncommitted [RecentRunsPanel.tsx](src/app/deploy-models/components/RecentRunsPanel.tsx) polls `/jobs` every 5 s and shows the last 8 runs per application. **This is the most valuable thing on the page.** Today it's tucked into `JobRunConsole` after you've already run at least one job.

**Ask:** when the user picks a project + application and *before* they pick a task, show a compact history of the last 10 runs for that app: task, model, status, git status, timestamp. Entry points:
- "Re-run" (pre-fills the form)
- "View result" (opens `JobRunConsole` with that job id)

This reframes the page from "form I fill" to "log of what my team has shipped, with a form to add another entry." It's the ArgoCD-native metaphor.

### 1.7 Preflight → "Run anyway" lifecycle is brittle

Flow today: preflight returns `status: 'warning'` → user clicks Run anyway → request fires with `force=true` → but preflight state is not cleared ([DefaultPage.tsx](src/app/deploy-models/pages/DefaultPage.tsx)). If the actual run then fails, the user sees *both* the original preflight warning and a failure notice, stacked.

**Ask:** when Run anyway is clicked, `setPreflight(null)` before the submit. And, when preflight returns `can_run_anyway: false`, hide the Run button entirely — don't just disable it. Today there is no visual difference between "blocked" and "loading."

### 1.8 Asymmetry between Support/Estimate (sync) and Default/Generate/Exp (async)

Two product behaviors live in one page. Sync tasks return immediately; async tasks show a status banner. The UI primitives handle this correctly, but the *mental model* isn't explained. A first-time user who clicks "Estimate Performance" and gets an instant answer, then clicks "Best Deployment Plan" and waits 3 minutes, has no idea why one was fast and the other slow.

**Ask:** in the task tile copy, label the sync ones as "instant" and the async ones as "takes ~2-5 minutes." Reinforce on the submit button itself — "Run (≈3 min)" vs. "Check".

### 1.9 Accessibility

- [JobResultView.tsx](src/app/deploy-models/components/JobResultView.tsx) activity timeline has no `role='log'` and no `aria-live='polite'` — screen readers won't announce new audit events as they arrive.
- After job state transitions, focus is not moved; keyboard users won't know the banner appeared. Add a `useEffect` that focuses the status banner when `job.status` transitions to a terminal state.
- Audit-trail loading state uses the string "Loading audit trail…" not the shared `<Spinner>`.
- No `<main>` landmark; the whole page is nested `<div>`.

These are ~1-day items; do them before the first external user.

---

## Part 2 — Data / API contract

### 2.1 The `gitops_state` refactor is the right move — ship it

The uncommitted `clustra_ai_service/gitops_state.py` centralizes mutation of the `gitops_status` lifecycle. Before this, four call sites were manually editing `result["gitops_status"]` and `result["git_committed"]`. **Merge this.** The follow-up helper `_persist_job_gitops_state()` in `services/gitops.py` closes the loop.

The UI work to consume this (`useJobAudit`, `JobRunConsole`) is also uncommitted. Ship the pair together, otherwise the backend has fields no one reads.

### 2.2 Contract drift — one soft mismatch

`EstimateResponse.raw: dict[str, Any]` is defined server-side but never read by the UI. Not a bug, but it's a forever-carry cost (any change to aiconfigurator's return shape ships through). Either:
- **Strip it** server-side before returning,
- or **expose a "View raw response" disclosure** in `EstimatePage` — power users can copy-paste for bug reports.

### 2.3 Job list needs filtering the UI doesn't use yet

`GET /jobs?status=&limit=&offset=` supports server-side filtering, but [RecentRunsPanel.tsx](src/app/deploy-models/components/RecentRunsPanel.tsx) today only filters client-side by app_name. On a busy instance this means every panel render downloads the global job history.

**Ask (server):** add `?app_name=` filter (indexed in schema already).
**Ask (UI):** pass the current app_name and a status filter so the panel doesn't download 1000s of unrelated jobs.

### 2.4 Audit events are free product telemetry — expose them

`AuditEventRow` already stores every state transition per job with user, endpoint, and JSON payload. This is effectively the backend-side analytics pipeline. Two wins:
- **Ops dashboard:** build a Grafana panel off `audit_events` counting by `event_type`, `endpoint`, and `triggered_by`. Zero new code.
- **UI self-service:** expose `/audit/recent?app_name=` for a team activity feed ("Alice ran default on Qwen/Qwen3-32B-FP8 10 min ago; succeeded"). Cheap to build, very sticky.

### 2.5 Sync endpoints silently skip the audit log

`/support` and `/estimate` don't write `audit_events`. So when someone says "estimate gave me a weird number," ops has no record. The code already has the writer; one-line addition at the request boundary.

---

## Part 3 — Reliability, scale, ops

### 3.1 Multi-replica is broken

`clustra_ai_service/database.py:206-216` reconciles all `pending`/`running` jobs to `failed` on startup. If you run 2 replicas, a rolling restart of pod A marks every in-flight job on pod B as failed. The docs tell you to flip `AICONF_RECONCILE_ON_STARTUP=false` to avoid this, but then crashed workers are *never* reconciled.

This is the single biggest production risk. Two realistic fixes:

- **Short term:** use pod identity (`POD_NAME` env) in the reconcile query. Only mark jobs whose `claimed_by == POD_NAME`. Zero-risk change, survives multi-replica.
- **Longer term:** replace the in-process `ThreadPoolExecutor` with a real work queue (Celery/RQ/arq). Workers are stateless, jobs persist, cancellation is cooperative.

Until one of these ships, document "single replica only, use `Recreate` strategy, downtime OK" in the Helm chart README with a banner.

### 3.2 `Recreate` deployment = deployment downtime

`k8s/deployment.yaml:11-12`. Combined with §3.1 this is arguably correct (because multi-replica is unsafe), but it means every image push = user-visible 10-30 s outage and any in-flight job dies. Fix is gated on §3.1.

### 3.3 Job retention is unbounded

Jobs accumulate forever. Over a year of moderate use this becomes a several-GB `jobs` table with JSON `result` blobs. No Alembic migration to cap it.

**Asks:**
- `AICONF_JOB_RETENTION_DAYS=30` config + a nightly `DELETE FROM jobs WHERE completed_at < now() - interval` background task. Cascade delete of `audit_events`.
- Expose retention in the Helm chart.
- Add a soft-warning banner in the UI when a viewed job is >14 days old: "This run is older than the retention window. It may be deleted automatically."

### 3.4 No per-user quotas

One user can saturate the thread pool (default 4 workers) and everyone else gets 429s. Admission control is at the service level, not per-tenant.

**Ask:** per-`triggered_by` concurrent-job limit (e.g., max 2 concurrent). Queue the rest with a "Your previous job is still running" message. Enforce server-side; UI shows the queue position.

### 3.5 Cancel doesn't free the worker

See §1.5. This means if I submit a 10-minute job, cancel after 10 seconds, then submit again, my second job waits 9:50 in the queue while the cancelled one is still computing. From the UI's perspective this is indistinguishable from "my cancellation didn't work." Fixing this fixes the cancel-fast-retry loop that is the dominant usage pattern for an early-access tool.

### 3.6 Trust boundary is header-based and unauthenticated

`clustra_ai_service/request_context.py:51-80` trusts `Argocd-Username`, `Argocd-Application-Name`, `Argocd-Project-Name` blindly. Anyone reaching the pod can impersonate any user and commit to any repo the ServiceAccount has credentials for. NetworkPolicy is recommended in docs but not enforced.

**Production-acceptance blockers:**
- NetworkPolicy that allows ingress only from the Argo CD server pod(s). Ship this in the default Helm chart with `networkPolicy.enabled: true`.
- Sign the proxy headers (HMAC from Argo CD with a shared secret). Verifying the header signature in `request_context.py` closes the impersonation vulnerability entirely. If Argo CD doesn't support this out of the box, add a small middleware in the Argo CD proxy extension that stamps and we verify.

### 3.7 Unbounded poll retries from the UI

[hooks/useJobPoller.ts:35-38](src/app/deploy-models/hooks/useJobPoller.ts#L35-L38) swallows network errors and reschedules every 3 s forever. If the backend is down for 10 minutes, each open browser tab hits it 200 times. Add exponential backoff with jitter, cap at 5 consecutive failures, then surface "Lost connection. Retry?" to the user.

Same applies to `useJobAudit` (4 s interval).

### 3.8 RDS CA init-container fetches from S3 at start

`k8s/deployment.yaml:31-53`. If S3 or the network is down, the pod boot hangs. Bake the CA into the image (it rotates every 5 years, rebuild cost is trivial) or mount from a ConfigMap. Remove the init-container.

### 3.9 `.env` is present locally, not in `.gitignore`

Verify and harden. Easy to miss once, hard to unmiss on GitHub.

---

## Part 4 — Observability & telemetry

### 4.1 UI has zero product analytics

No Segment, no PostHog, no custom tracker. You cannot answer:
- Which tasks get used most?
- How many users run Default and then abandon before reading the result?
- What % of runs commit to git vs. stay in `noop`?
- What's the median time from "Project selected" to "Run clicked"?

**Ask:** add one lightweight tracker (vendor TBD; PostHog OSS is cheap). Instrument ~15 events: `task_selected`, `form_submitted`, `preflight_triggered`, `preflight_blocked`, `run_anyway_clicked`, `job_cancelled`, `job_succeeded`, `job_failed`, `audit_trail_expanded`, `recent_run_clicked`, `page_viewed`, `project_selected`, `application_selected`. All in one `useTrack` hook.

### 4.2 Tracing and metrics exist server-side — surface them

The backend already emits Prometheus metrics, OpenTelemetry spans, and `X-Request-ID` on every response. None of this is used:
- Errors don't propagate `X-Request-ID` to the UI for support ticketing. Include it in `ErrorAlert` ("Reference id `abc123`"). Ops can then grep logs.
- No dashboards shipped. A minimal Grafana JSON in the Helm chart under `dashboards/` that charts `http_requests_total`, `inflight_requests`, `jobs_in_progress`, `job_lifecycle_total{status}`, and `gitops_outcomes_total{status}` is a one-afternoon job and gives ops immediate visibility.

### 4.3 Slow queries unobserved

Postgres under `jobs` will get hot. Add `pg_stat_statements` guidance in the Helm chart + query-time Prometheus histogram.

---

## Part 5 — Concrete backlog (prioritized)

### P0 — do before external users (≤ 2 weeks)
1. Ship the uncommitted `gitops_state.py` refactor + UI `useJobAudit` / `JobRunConsole` / `RecentRunsPanel` end-to-end.
2. Tooltips on every jargon label; rewrite task-tile descriptions.
3. Confirmation dialog on Cancel; disable Cancel during cancellation request.
4. Explicit commit-target notice above Run ("This will commit to `repo@branch:path`").
5. Multi-replica-safe reconcile (scope by `claimed_by == POD_NAME`), or enforce single-replica + `Recreate` with doc'd downtime window.
6. Default `networkPolicy.enabled: true` + ship signed proxy headers.
7. UI poll backoff + user-visible reconnect state.
8. Clear preflight state on "Run anyway"; hide Run when `can_run_anyway=false`.
9. `X-Request-ID` visible in `ErrorAlert`.
10. Audit-write for sync endpoints `/support` and `/estimate`.

### P1 — do before GA (≤ 2 months)
11. Job retention config + nightly cleanup task.
12. Per-user concurrent-job quota.
13. Cooperative cancellation in aiconfigurator OR rename to "Discard result".
14. Recent-runs panel as default landing state after project+app selection.
15. Grafana dashboards in Helm chart; `pg_stat_statements` guidance.
16. Product analytics (~15 events).
17. Replace in-process thread pool with a real work queue (Celery/arq) — unblocks real multi-replica.
18. Strip `EstimateResponse.raw` OR surface via disclosure.
19. Team activity feed (`/audit/recent?app_name=`).
20. `<main>` landmark, `role='log'` on audit timeline, focus management, shared `<Spinner>` everywhere.

### P2 — investment
21. Bake RDS CA into image, remove init-container.
22. Replace PVC-dependent `save_dir` with result-blob-in-DB (removes the "PVC must persist" operational footgun).
23. HMAC-signed proxy headers enforced at middleware layer.
24. Rate limiting via API gateway (Envoy/Kong) in front of the service.
25. E2E test suite: real Postgres + mock Git + full job lifecycle.

---

## Part 6 — One-page framing for leadership

> **Deploy Models is a credible MVP but is not yet a product.** The recent UI overhaul fixed the visual debt, and the backend's audit trail is genuinely best-in-class for an async job service. Two gaps block a real launch: **(1) the UI still reads as an internal research console** — we can close that with ~40 tooltips and two paragraphs of copy; **(2) the server's operational posture assumes single-replica and benevolent network**, which is OK for dogfooding but not for shared use. We can stabilize both in ~3 weeks of focused work, land the uncommitted refactors, and then spend the quarter on analytics-informed product iteration. Without doing (1), every new user needs a handhold; without doing (2), the first real incident will be visible downtime with no postmortem trail.
