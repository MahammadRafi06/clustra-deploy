# AI PM Review — Deploy Models + `clustra-ai-service`

**Reviewer:** senior PM + product architect
**Scope:**
- UI: `/home/mahammad/clustra-deploy/ui/src/app/deploy-models/`
- API: `/home/mahammad/Desktop/clustra-ai-service/`
- Proxy extension: `/home/mahammad/clustra-deploy/server/extension/`

**Note to downstream reviewers:** this document will be consumed by an OpenAI Codex model before any team member acts on it. All prescriptions include explicit file paths and line references so they can be applied unambiguously.

---

# 🟢 Revision 4 — GA Green Light

## Decision: **APPROVED for General Availability**

All four Revision 3 must-fixes have landed with tests. The remaining items in the backlog are post-GA iteration, not launch blockers.

**Ship this.**

---

## Verification of the four Rev 3 must-fixes

### ✅ Must-fix #1 — `?app_name=` filter on `GET /jobs`
**UI:** [`ui/src/app/deploy-models/api.ts:187-194`](src/app/deploy-models/api.ts#L187-L194) — `listJobs` now accepts `appName?: string` and forwards it as the `app_name` query parameter.
**UI:** [`ui/src/app/deploy-models/components/RecentRunsPanel.tsx:26,47`](src/app/deploy-models/components/RecentRunsPanel.tsx#L26-L47) — pulls `appName` from `useAppContext()` and calls `listJobs({appName, limit: 8})`.
**API:** [`clustra_ai_service/routers/jobs.py:33-36`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/routers/jobs.py#L33-L36) — `list_jobs` endpoint adds `app_name: str | None = Query(default=None, min_length=1)` and forwards to `list_jobs_for_context`.
**API:** [`clustra_ai_service/jobs.py:288-341`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/jobs.py#L288-L341) — `list_jobs_for_context` applies the filter server-side with a 403 when the caller's Argo CD context mismatches the requested `app_name`.
**Tests:** `test_list_jobs_accepts_explicit_app_name_filter_for_direct_requests` + `test_list_jobs_rejects_mismatched_app_name_filter_against_argocd_context` at [`tests/test_api.py:825,859`](/home/mahammad/Desktop/clustra-ai-service/tests/test_api.py#L825).

Shared-instance scaling problem resolved.

### ✅ Must-fix #2 — Subprocess-level cancel escalation
**API:** [`clustra_ai_service/runtime.py:167-186`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/runtime.py#L167-L186) — the subprocess polling loop now checks `await job_runtime.is_cancelled(job_id)` every 0.25 s; on `True`, calls `_terminate_process` which SIGTERMs with a 2-second grace then SIGKILLs.
**API:** [`clustra_ai_service/jobs.py:372`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/jobs.py#L372) — `cancel_active_job` + [`routers/jobs.py:77`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/routers/jobs.py#L77) — DELETE `/jobs/{id}` now calls `cancel_active_job` after flipping the DB row.
**Tests:** `test_run_cli_subprocess_terminates_process_when_job_status_is_cancelled` at [`tests/test_production_hardening.py`](/home/mahammad/Desktop/clustra-ai-service/tests/test_production_hardening.py); `test_cancel_active_job_interrupts_running_background_work` at [`tests/test_api.py:666`](/home/mahammad/Desktop/clustra-ai-service/tests/test_api.py#L666).

Cancel now releases the worker slot within ~2-3 seconds instead of up to 600 seconds. The user-facing product lie is closed.

### ✅ Must-fix #3 — HMAC secret startup warning
**API:** [`clustra_ai_service/runtime.py:221-222`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/runtime.py#L221-L222) — on startup, if `settings.proxy_signature_secret` is empty, logs `WARNING: "Proxy header signing is disabled. Set AICONF_PROXY_SIGNATURE_SECRET for production."`
**Helm:** [`helm/clustra-ai-service/values.yaml`](/home/mahammad/Desktop/clustra-ai-service/helm/clustra-ai-service/values.yaml) exposes `secret.AICONF_PROXY_SIGNATURE_SECRET` (defaults to `""`) so the operator can populate it in-cluster.
**Helm test:** [`tests/test_helm.py`](/home/mahammad/Desktop/clustra-ai-service/tests/test_helm.py) now asserts `AICONF_PROXY_SIGNATURE_SECRET` exists in the rendered Secret and `AICONF_PROXY_SIGNATURE_MAX_AGE_SECONDS: "300"` in the ConfigMap.
**Runtime test:** `test_runtime_warns_when_proxy_signature_secret_is_missing` at [`tests/test_production_hardening.py`](/home/mahammad/Desktop/clustra-ai-service/tests/test_production_hardening.py).

Operators can no longer silently skip the HMAC secret in production without seeing a log warning.

### ✅ Must-fix #4 — Timeout tuning tooling
**API:** [`scripts/report_job_durations.py`](/home/mahammad/Desktop/clustra-ai-service/scripts/report_job_durations.py) — new operator script that queries `DATABASE_URL`, pulls the last N successful job durations, and reports p50/p90/p99. Direct input for tuning `AICONF_JOB_EXECUTION_TIMEOUT_SECONDS` (default 600 s) to match observed sweep times.

Data-backed timeout tuning is now one command.

### Bonus — already in place, worth calling out
- **`X-Request-ID` on every HTTP response header** via middleware at [`clustra_ai_service/observability.py:174`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/observability.py#L174). The Rev 3 "minor nit" (body-only) was already closed — headers carry `X-Request-ID`, `X-Trace-ID`, and W3C `traceparent`. Support tickets can correlate immediately.
- **End-to-end HMAC trust boundary**: Go signer at [`server/extension/extension.go:843-896`](server/extension/extension.go#L843-L896); Python verifier at [`clustra_ai_service/request_context.py:58-116`](/home/mahammad/Desktop/clustra-ai-service/clustra_ai_service/request_context.py#L58-L116); ±300 s timestamp window; constant-time signature comparison via `hmac.compare_digest`.

---

## What this launch ships (feature inventory)

### Trust & security
- HMAC-signed Argo CD proxy headers (extension + service), 401 on missing/stale/invalid signatures.
- Network policy shipped in Helm chart; only Argo CD + in-cluster traffic allowed.
- Constant-time signature comparison; configurable timestamp skew window.
- Non-root container user (uid 1000); read-only filesystem-friendly layout.

### Reliability
- **Subprocess-isolated CLI execution** with SIGTERM → SIGKILL escalation on cancel or timeout.
- Per-job execution timeout (`AICONF_JOB_EXECUTION_TIMEOUT_SECONDS=600`) with clean 504 + `request_id` payload.
- Per-user concurrent job quota (`AICONF_MAX_CONCURRENT_JOBS_PER_USER=3`).
- Bounded UI polling with exponential backoff, jitter, `maxRetries: 12`, exhaustion state, and a manual **"Retry now"** affordance in every `NoticeAlert`.
- Job retention TTL cleanup task (`AICONF_JOB_RETENTION_DAYS=30`).
- `HOSTNAME`-scoped stale-job reconciliation (multi-replica-safe foundation, currently at `replicas: 1`).
- Graceful shutdown of ThreadPoolExecutor + retry loop + cleanup loop.

### Product UX
- `<main>` landmark, `role='log' aria-live='polite'` audit timeline, focus management on job state transitions, shared `<Spinner>` everywhere.
- Task-tile descriptions with sync-vs-async badges.
- **~40 field-level tooltips** covering all identified jargon (ISL, OSL, TTFT, TPOT, Database Mode per-option, Attention DP, MoE TP/EP, 5 quant modes, prefill/decode variants).
- `DeployTargetNotice` explicitly naming the commit target (repo URL + branch + path) above every Run.
- `RecentRunsPanel` as landing state on every async task page, scoped to the current application.
- `EstimateResponse.raw` exposed via `<details>` disclosure for debug/support.
- Confirmation modal + disabled-during-request for Cancel; honest copy.
- `gitops_status` lifecycle pills (queued / retrying / committed / noop / failed / cancelled) surfacing retry clocks.
- `X-Request-ID` visible in every `ErrorAlert` for support ticketing.

### Observability
- Prometheus metrics (`/metrics`): request totals, in-flight, job lifecycle, gitops outcomes, latency histograms.
- Structured logs with `request_id` / `trace_id` contextvars.
- Optional OpenTelemetry export with W3C traceparent propagation.
- `/health` (always 200) + `/ready` (503 if DB unreachable).

### Ops
- New `scripts/report_job_durations.py` for data-backed timeout tuning.
- Full Helm chart with `test_helm.py` asserting rendered contract.
- Conftest wiring for deterministic test teardown (`_running_job_tasks.clear()`).
- Subprocess cancel + SIGTERM + timeout tested with a `_FakeProcess` fixture in `tests/test_production_hardening.py`.

---

## Pre-launch operational checklist

These are runbook items, not code items. Complete before flipping traffic to the GA service.

| # | Item | Owner | Blocking |
|---|---|---|---|
| 1 | Populate `AICONF_PROXY_SIGNATURE_SECRET` in the production Kubernetes Secret (min 32 bytes, randomly generated) | Ops | ✅ yes |
| 2 | Populate the same secret in the Argo CD proxy extension env (`AICONF_PROXY_SIGNATURE_SECRET`) so signatures match | Ops | ✅ yes |
| 3 | Verify `DATABASE_URL` points to a managed Postgres with persistent storage (not the in-memory fallback) | Ops | ✅ yes |
| 4 | Verify `GIT_USERNAME` + `GIT_TOKEN` (or `GIT_SSH_KEY`) are populated and have write access to the target Argo CD application repos | Ops | ✅ yes |
| 5 | Run `scripts/report_job_durations.py --limit 50` against prod-like traffic and tune `AICONF_JOB_EXECUTION_TIMEOUT_SECONDS` to `p99 * 1.5` if the default 600 s is too tight | Ops | ✅ yes |
| 6 | Confirm `replicas: 1` + `strategy.type: Recreate` in the active Deployment (multi-replica is correctly deferred to post-launch validation) | Ops | ✅ yes |
| 7 | Confirm `AICONF_RECONCILE_ON_STARTUP=true` given replicas=1 | Ops | ✅ yes |
| 8 | Confirm NetworkPolicy is enabled and restricts ingress to Argo CD namespace | Ops | ✅ yes |
| 9 | Run `helm test clustra-ai-service` against the staging release and confirm all assertions pass | Ops | ⚠ strongly recommended |
| 10 | Document rollback plan: previous image tag + previous Helm chart version | Ops | ⚠ strongly recommended |
| 11 | Post-launch: add a sticky note to revisit the timeout value after 1 week of real traffic | PM | informational |

---

## Post-launch roadmap (keep as-is from Rev 3)

None of these are launch blockers. Sequence by data collected from the analytics wiring in Sprint A.

### Sprint A — measurement (week 1 post-launch, non-negotiable)
- Wire ~15 product analytics events via a `useTrack` hook. Vendor: PostHog OSS in-cluster is cheapest; Segment if corporate standard. Events: `page_viewed`, `project_selected`, `application_selected`, `task_selected`, `form_submitted`, `preflight_triggered`, `preflight_blocked`, `run_anyway_clicked`, `job_succeeded`, `job_failed`, `job_cancelled`, `audit_trail_expanded`, `recent_run_clicked`, `retry_now_clicked`, `raw_payload_expanded`.
- Without this, we cannot prioritize any follow-up work by impact.

### Sprint B — multi-replica readiness (weeks 2-3 post-launch)
- Smoke-test at `replicas: 2` for a full week with traffic. Validate no job loss, no duplicate commits, reconciliation works only on own `HOSTNAME`.
- Flip `strategy.type: Recreate` → `RollingUpdate` with `maxSurge: 1, maxUnavailable: 0`.
- Revisit `AICONF_RECONCILE_ON_STARTUP` semantics for multi-replica rollout (likely turn off; rely on the HOSTNAME-scoped heartbeat reconcile).

### Sprint C — observability at scale (weeks 3-4)
- Grafana dashboards shipped in the Helm chart under `templates/dashboard-configmap.yaml`: `http_requests_total`, `inflight_requests`, `jobs_in_progress`, `job_lifecycle_total{status}`, `gitops_outcomes_total{status}`, request-latency p50/p95/p99.
- Alert rules: sustained 5xx > 1 %, thread-pool saturation > 80 %, `pending_commits` growth, DB connection failures.
- `pg_stat_statements` guidance doc in the chart README.
- `jobs` table row-count + size gauge with growth alert.

### Sprint D — platform (month 2, parallel track)
- Celery / arq migration spike behind a feature flag. True work-queue isolation with native `revoke(terminate=True)`.
- Team activity feed: `/audit/recent?app_name=` aggregation endpoint; pane in RecentRunsPanel.
- Generated-files viewer in `JobResultView` linking each committed file to its path in the Git repo (data already present in audit payload).
- Bake the RDS CA into the image; remove the init-container fetch.
- HMAC secret rotation story: support `SECRET_V1` / `SECRET_V2` dual-accept in `verify_proxy_signature`.

---

## Risks to watch in the first 30 days

Rank-ordered by likelihood × blast radius.

1. **Timeout too tight.** If the default `600 s` is below p99 of real sweep durations, users see spurious 504s on their first runs. Mitigation: the operational checklist step 5 uses the new `scripts/report_job_durations.py` tool. If not run, this is the most likely launch-day issue.
2. **Misconfigured HMAC secret.** Secret in the service but not the proxy extension (or mismatched) → 100 % 401 on every request. Mitigation: a startup smoke test from the proxy extension to `/ready` returning 200 is the go/no-go gate.
3. **Subprocess resource accumulation.** Each active job spawns a child process; at `AICONF_MAX_CONCURRENT_JOBS_PER_USER=3` × N users × per-process memory footprint the pod may OOM. Mitigation: set `resources.limits.memory` in the Helm values with headroom for `max_workers × per-job-memory`.
4. **Git commit retries silently backing up.** Pending commits accumulate if target repos are unreachable. Mitigation: Sprint C alert on `pending_commits` row count.
5. **RecentRunsPanel poll storms.** At replicas=1 with N tabs open, the 5 s poll interval across tabs could hit the list endpoint hard. Mitigation: monitor `http_requests_total{endpoint="/jobs"}` — if it spikes, add a `visibilitychange` event listener to pause polling when the tab is hidden.

---

## Executive framing for the launch approval meeting

> **This is the sprint that finished the product.** Over three revisions the team closed all P0 and most P1 gaps: the UI is now self-serve (tooltips, landing-state recent runs, deploy target transparency, accessibility), the trust boundary is signed end-to-end (HMAC + network policy), cancellation actually stops compute (subprocess SIGTERM within seconds, not minutes), timeouts are bounded (504 with request id), and polling is bounded (max retries with manual retry). All backed by tests.
>
> **Recommendation: approve GA.** The eleven items on the operational checklist are runbook, not engineering. The Sprint A analytics wiring in the first week post-launch is the one non-negotiable follow-up — without it we'll have no data to prioritize the remaining roadmap. Everything else (multi-replica, RollingUpdate, dashboards, work-queue migration) is iteration, not readiness.
>
> **Confidence: high.** The change density between Revision 1 and now is significant but the architectural shape has been stable since Revision 2; this final sprint was targeted closure work with tests. Expected launch-day risk is operational misconfiguration, not product defects.

---
---

# Historical record

## Revision 3 — GA-readiness review (conditional green light)

Headline: product debt closed, four small items blocked GA. Rev 4 verified all four landed.

The four Rev 3 must-fixes, now resolved:
1. **`?app_name=` filter on `GET /jobs`** — resolved in Rev 4 (§verification above).
2. **Subprocess-level cancel escalation** — resolved in Rev 4.
3. **HMAC secret startup warning** — resolved in Rev 4.
4. **Timeout validation tool** — resolved via `scripts/report_job_durations.py` in Rev 4.

Rev 3 also acknowledged these wins:
- `<main>` landmark, `role='log'`, focus management, shared `<Spinner>` → a11y closed.
- Centralized `POLLING_CONFIG` with `maxRetries: 12` + exhaustion + "Retry now" button.
- End-to-end HMAC signing (extension.go signer + request_context.py verifier + tests).
- Subprocess isolation architecture (`job_worker.py` + `_run_cli_subprocess`).
- Per-endpoint execution timeout with 504 handler.
- 14 new tooltips on EstimatePage advanced fields + per-option Database Mode descriptions.
- `EstimateResponse.raw` exposed via `<details>` disclosure.
- `RecentRunsPanel` promoted to landing state on Default/Generate/Exp pages.

---

## Revision 2 — follow-up review

Headline: strong execution on the P0 list; most user stories finished one step short. Rev 3 addressed nearly all.

Scorecard from Rev 2:
- 7 of 10 P0 items addressed cleanly, 2 half-addressed, 1 partial.
- 4 of 10 P1 items addressed; 6 outstanding.
- No regressions. New abstractions (`jobState.ts`, `polling.ts`, `errors.ts`, `useJobAudit`) were the right shapes.

Key Rev 2 wins:
- Multi-replica reconcile scoped to `HOSTNAME` (single biggest production risk from Rev 1).
- `X-Request-ID` round-trips cleanly from backend through `errors.ts` into `ErrorAlert`.
- Tooltip infrastructure (`FIELD_HELP` + help icon) wired up.

Key Rev 2 misses (later closed by Rev 3 and Rev 4):
- RecentRunsPanel built but only mounted after first job.
- `listJobs` still no `app_name` filter.
- Cancel relabelled ("Mark cancelled") but worker still ran to completion.
- 15 tooltips still missing on EstimatePage advanced fields.
- Zero product analytics (still outstanding, now Sprint A post-launch).

---

## Revision 1 — initial audit

TL;DR: three themes blocked credibility for non-wizards.

1. **Language, not layout.** Jargon like ISL, OSL, TTFT, TPOT, SILICON/HYBRID/EMPIRICAL/SOL, aggregated vs. disaggregated was undefined in the UI. → Closed in Rev 3.
2. **Job outcome story.** Backend emitted a rich audit trail; UI barely started showing it. → Closed in Rev 3 via `jobState.ts`, `JobRunConsole`, `RecentRunsPanel` as landing state.
3. **Production hardening of the async pipeline.** Indefinite retries, unbounded retention, no per-user quotas, `Recreate` deployment, cancel that didn't actually stop the worker. → All closed except `Recreate` (correctly deferred) by Rev 4.

Original Rev 1 framing:
> **Deploy Models is a credible MVP but is not yet a product.** Two gaps block a real launch: **(1) the UI still reads as an internal research console**; **(2) the server's operational posture assumes single-replica and benevolent network**.

**Status after Rev 4:** both gaps closed. The product is now GA-ready.
