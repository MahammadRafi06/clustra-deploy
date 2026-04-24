# Model Cache — Beta → GA Readiness Review

**Reviewer role:** Senior Product Manager + Product Architect (AI)
**Review date:** 2026-04-24
**Reviewed by:** OpenAI Codex (downstream)
**Scope:** Two repositories considered as one product surface
- **UI:** `clustra-deploy/ui/src/app/model-cache/` (HEAD `2dea601ac`, working tree clean)
- **API:** `clustra-modal-cache/` (HEAD `87bd22f`, **8 uncommitted manifest changes** — security/runtime hardening)

> All file references use `repo:path:line` so Codex can verify each claim mechanically.

---

## 1. Executive Summary

Model Cache is **functionally complete and architecturally sound**. The recent UI alignment work (commit `d5fb95a81`) and the API hardening commit (`87bd22f`) bring the product within striking distance of GA.

**Verdict:** 🟡 **Conditional GO for GA.** Ship after closing **5 P0 blockers** (≈2 working weeks). The remaining gaps are real but not launch‑gating.

| Surface | Functionality | Security | Reliability | Observability | Tests | Docs | Net |
|---|---|---|---|---|---|---|---|
| UI page | 9/10 | 7/10 | 7/10 | 6/10 | **0/10** | 5/10 | 🟡 |
| API + agent | 9/10 | 8/10 | 7/10 | 7/10 | 6/10 | 5/10 | 🟡 |

The two **deal‑breakers** sit in different repos:
1. **UI** has zero automated tests and no a11y attributes — enterprise customers will reject this on procurement.
2. **API** has uncommitted security hardening sitting in a working tree — the prod manifests on `main` are still over‑permissioned.

Everything else is polish, ops enablement, or v1.1 work.

---

## 2. Product Positioning Check

Before code-level feedback, a PM observation: **Model Cache is presented in the UI as a peer of Deploy Models, but `spec.md §4` ("Current launch scope") does not list it as a GA task.** Either:

- **Option A:** Update `spec.md` to officially scope Model Cache into GA (recommended — the feature is ready and the UI alignment work has already been paid for), or
- **Option B:** Hide the page behind a feature flag and ship as "Tech Preview" with explicit GA in the next release.

Shipping a polished‑looking page that isn't in the GA spec is a positioning risk: customers will assume parity with Deploy Models (SLAs, support, lifecycle). Pick a lane.

---

## 3. UI Review — `clustra-deploy/ui/src/app/model-cache/`

### 3.1 What's working well

- **Design system alignment is done.** Post Revision 2 (`d5fb95a81`) the page uses stock `<Page>` + breadcrumb toolbar ([index.tsx:15](src/app/model-cache/index.tsx#L15)), `argo-table-list`, `SlidingPanel`, brand emerald accent, BEM SCSS, and `themify()` dark-mode wrapping. No rogue blue accent, no inline styles outside one justified progress bar width ([HealthSummaryCards.tsx:62](src/app/model-cache/components/HealthSummaryCards.tsx#L62)).
- **API layer is fully typed.** [api/types.ts](src/app/model-cache/api/types.ts) defines 14 interfaces with **zero `any`**. The 18-method client at [api/client.ts](src/app/model-cache/api/client.ts) wraps `fetch` cleanly, and SSE log streaming is implemented via [api/client.ts:118-180](src/app/model-cache/api/client.ts#L118-L180).
- **Hard delete uses typed confirmation.** [common/ConfirmDialog.tsx:22-28](src/app/model-cache/components/common/ConfirmDialog.tsx#L22-L28) requires the user to type the model name — good destructive-action guardrail. Reuse this pattern (see §3.3.1).
- **Late-arrival cleanup is exposed in audit timeline** — operators can see what the agent reconciled, which is the correct UX for the generation-tracking design (§4.3).

### 3.2 P0 blockers (must close before GA)

#### 3.2.1 No automated tests
**Evidence:** `find src/app/model-cache -name "*.test.*"` returns 0 files.

**Why this blocks GA:** This is shared infrastructure (Argo fork) where regressions are silent. Deploy Models has tests; Model Cache should match the bar.

**Minimum coverage to ship:**
- API client: contract tests for the 18 methods (request shape, query params, error mapping).
- Hooks: `useModels`, `useJobs`, `useHealth` — verify polling cadence, abort on unmount, error surfacing.
- Critical UI flows: hard delete confirmation, bulk action, download form validation.

**Estimate:** 6–8 hours for ~70% coverage of the surface area.

#### 3.2.2 Accessibility — non-compliant
**Evidence:** `grep -r "role=\|aria-" src/app/model-cache/components/` returns **0 matches**.

**Why this blocks GA:** WCAG 2.1 AA is a procurement gate at most enterprises. Deploy Models passed this bar in Revision 3 ([AI_PM_REVIEW.md](AI_PM_REVIEW.md) "Accessibility Wins"). Shipping Model Cache without the same treatment is an inconsistency the security/legal review will catch.

**Concrete fixes:**
- `<Page>` wrapper at [pages/ModelCachePage.tsx:159](src/app/model-cache/pages/ModelCachePage.tsx#L159) → `role="main"`.
- Filter toolbar → `role="search"`, search input → `aria-label="Search models"`.
- Status badges → `aria-label="Status: {label}"` (the visual `_`→` ` transform isn't enough for screen readers).
- Modal `SlidingPanel` instances → `aria-modal="true"`, focus trap on open, focus restore on close.
- Job log viewer → `role="log" aria-live="polite"` (mirror Deploy Models pattern).
- Tab order: bulk action bar should be reachable by Tab without going through every row checkbox first.

**Estimate:** 3–4 hours.

#### 3.2.3 Silent error swallowing
**Evidence:**
- [hooks/useModels.ts:45](src/app/model-cache/hooks/useModels.ts#L45) — `.catch(() => {})`
- [hooks/useJobs.ts:13](src/app/model-cache/hooks/useJobs.ts#L13) — `.catch(() => {})`
- [hooks/useHealth.ts:32](src/app/model-cache/hooks/useHealth.ts#L32) — `.catch(() => {})`

**User impact:** When the API is unreachable (deploy in progress, RBAC misconfig, agent down), the UI shows a perpetual "Loading…" with no signal. Users will refresh, panic, file support tickets.

**Fix:** Surface to local error state, render via existing [ErrorBanner](src/app/model-cache/components/common/ErrorBanner.tsx) component, and **stop polling on persistent failures** with an explicit "Retry" affordance — auto-refetch every 10s against a dead endpoint just amplifies the outage.

**Estimate:** 1.5 hours.

#### 3.2.4 Native `confirm()` on preset delete
**Evidence:** [components/PresetsPanel.tsx:66](src/app/model-cache/components/PresetsPanel.tsx#L66) — `if (!confirm(...))`.

**Why it matters:** Browser-native confirms render outside the app theme, look unbranded, are blocked by some browser settings, and (in headless tests) bypass automation. Hard delete already uses [ConfirmDialog](src/app/model-cache/components/common/ConfirmDialog.tsx); presets must match.

**Estimate:** 15 min.

#### 3.2.5 Bulk soft-delete fires without confirmation
**Evidence:** [pages/ModelCachePage.tsx:235-237](src/app/model-cache/pages/ModelCachePage.tsx#L235-L237) calls `bulkAction.mutate({action: 'soft_delete'})` immediately. Hard delete (line 269-270) does prompt.

**Why it matters:** Soft delete is recoverable but still destructive — when a user has 50 rows selected and clicks "Soft Delete", they should see "Soft delete 50 models? (recoverable for 30 days)" not just see them disappear.

**Estimate:** 30 min (reuse `ConfirmDialog`, no typed-confirm needed for soft delete).

### 3.3 P1 — Important polish (within GA window if possible)

| # | Issue | File | Fix | Effort |
|---|---|---|---|---|
| 1 | `console.error()` in production code | [ModelDetailDrawer.tsx:48](src/app/model-cache/components/ModelDetailDrawer.tsx#L48) | Remove; surface to error state | 5 min |
| 2 | Bulk action success not toasted | [ModelCachePage.tsx:235-237](src/app/model-cache/pages/ModelCachePage.tsx#L235-L237) | Await result, show toast with succeeded/failed counts | 30 min |
| 3 | Toast durations as magic numbers (2000/3000ms) | [ModelCachePage.tsx:213,225,313](src/app/model-cache/pages/ModelCachePage.tsx#L213) | Extract `TOAST_DURATION_MS` to constants; ideally a centralized toast service | 30 min |
| 4 | Audit timeline dedup keyed on `action+created_at` (lossy if 2 events share a second) | [AuditTimeline.tsx:42](src/app/model-cache/components/AuditTimeline.tsx#L42) | Key by `entry.id` | 10 min |
| 5 | `StatusBadge` does naive `_`→` ` transform; doesn't capitalize | [StatusBadge.tsx:17](src/app/model-cache/components/common/StatusBadge.tsx#L17) | Use explicit label map (mirror `ACTION_CONFIG` in AuditTimeline) | 20 min |
| 6 | Polling continues in hidden tabs (10s/5s/30s) | [utils/constants.ts](src/app/model-cache/utils/constants.ts) + the 3 hooks | Add `visibilitychange` listener; pause when hidden | 1 hr |
| 7 | Hard‑coded namespace/PVC defaults in download form | [DownloadModelModal.tsx:19-20](src/app/model-cache/components/DownloadModelModal.tsx#L19-L20) | Read from `/health/status` or a settings endpoint instead of literal `'model-cache'` | 1 hr |
| 8 | `JSON.stringify(params)` as effect dep | [useModels.ts:21](src/app/model-cache/hooks/useModels.ts#L21) | Stabilize via `useDeepCompareMemo` or a custom hook | 30 min |

### 3.4 P2 — Post‑GA backlog

- **i18n.** Zero `i18next`/`react-intl` integration; all copy is English literals. Defer until a localization customer requirement lands, but **scope it now** so the keys can be extracted later without rewriting JSX.
- **List virtualization.** Default page size 25 is fine. If the catalog grows to 1k+ models with `page_size=100`, revisit.
- **Job logs persistence.** [JobLogViewer.tsx:21](src/app/model-cache/components/JobLogViewer.tsx#L21) keeps logs in component state; navigating away loses them. The backend already retains a `log_tail`; the v1.1 story is "open a finished job, see its full log" without re-streaming.
- **Optimistic mutations.** All actions wait for server roundtrip then refetch. For pin/unpin, optimistic UI would feel snappier.

---

## 4. API + Agent Review — `clustra-modal-cache/`

### 4.1 Architecture is right

FastAPI backend + Go agent + PostgreSQL + K8s Jobs (with optional GitOps dispatch). The separation of concerns is clean: the agent owns disk truth, the backend owns intent, the DB is the reconciliation surface, and Jobs are the unit of work. **Generation-tracked late-arrival cleanup** (§4.3) is the right pattern for an eventually-consistent system spanning a queue, a Git push, and a slow K8s scheduler.

### 4.2 P0 blockers

#### 4.2.1 8 uncommitted manifest changes are the GA hardening
**Evidence:** `git status` shows modifications to `manifests/{agent,backend,database}/*.yaml` plus two new `networkpolicy.yaml` files.

**Why this blocks GA:** The diff is exactly the work that takes this from beta to prod-grade — RDS TLS init container, `readOnlyRootFilesystem`, Prometheus annotations + startupProbe/readinessProbe, narrow Role (replacing the over-broad ClusterRole), egress NetworkPolicies, and image bump 1.3.4 → 1.3.6. **None of this is on `main`.** Every customer pulling the current Helm chart gets the unhardened version.

**Action:**
1. Stage and commit (`feat: GA runtime hardening` or split as 3 logical commits: TLS, RBAC, NetworkPolicy).
2. Test the ClusterRole → Role split in a fresh namespace — this is the only **breaking change** for upgraders.
3. Add a `MIGRATION.md` note: existing deployments must `kubectl delete clusterrolebinding model-cache-backend` before `helm upgrade`.
4. Bump chart version. Tag release.

**Estimate:** 1 hour to commit, 2–3 hours to verify upgrade path on a test cluster.

#### 4.2.2 Agent `DB_SSLMODE` defaults to `disable`
**Evidence:** [agent/internal/config/config.go](../../Desktop/clustra-modal-cache/agent/internal/config/config.go) — `DB_SSLMODE` default `"disable"`.

**Why it matters:** Backend already enforces `verify-full` by default; agent is asymmetric. If an operator forgets to set `DB_SSLMODE=verify-full` (or use the new `DB_URL` with `sslmode=verify-full` baked in), the agent talks plaintext to RDS — silent data-plane vulnerability that won't show up in any liveness check.

**Fix:** Default to `verify-full`. Refuse to start if remote DB host is detected with `disable`. Mirror the backend's [config.py:136](../../Desktop/clustra-modal-cache/backend/app/config.py#L136) validator.

**Estimate:** 30 min.

#### 4.2.3 No idempotency on `POST /models/download`
**Evidence:** [backend/app/routers/models.py:142](../../Desktop/clustra-modal-cache/backend/app/routers/models.py#L142). Each POST creates a new job row even with identical `(repo_id, revision, source)`.

**User impact:** A user double‑clicks "Download". A network blip causes the UI to retry. Either way: 2 K8s Jobs spin up, both pull the same model, one wins, the other wastes minutes of bandwidth and fails with "already exists". Operator sees a phantom failed job, files a bug.

**Fix:** Two options, pick one:
- **Easy:** Server-side dedup — if there's an active `download` job for the same `(repo_id, revision, source)`, return the existing `JobSummary` (HTTP 200, not 409).
- **Right:** Add `Idempotency-Key` header support (RFC draft). UI sends a UUID per user-initiated request; server hashes `(key, body)` and returns the cached response for 24h.

**Estimate:** 2 hours for option A, 4–6 hours for option B.

#### 4.2.4 Bulk operations are not atomic
**Evidence:** [backend/app/routers/models.py:264](../../Desktop/clustra-modal-cache/backend/app/routers/models.py#L264) — `bulk-action` loops, returns `{succeeded[], failed[]}`. **No length cap on `model_ids`.**

**Why it matters:**
1. A user selects "Soft delete all 50,000 models" → backend processes synchronously inside the request → request times out → some unknown subset is deleted → audit log is partial → UI shows stale data.
2. No protection against an attacker (or buggy client) sending a 100k-element list to exhaust DB connections.

**Fix:**
- Cap `len(model_ids) <= 500` (validate at Pydantic layer, return 422).
- For >50 items, return 202 + a `bulk_job_id`, process async, expose status via existing `/jobs/{id}` machinery.

**Estimate:** 3–4 hours.

#### 4.2.5 Agent `/readyz` has no first-scan timeout
**Evidence:** [agent/cmd/agent/main.go:104-122](../../Desktop/clustra-modal-cache/agent/cmd/agent/main.go#L104-L122) — `/readyz` returns 503 until the **first** scan completes; on a 1M-file PVC, that can be 5+ minutes.

**Combined with the new startupProbe** (`failureThreshold=30, periodSeconds=5` = 150s deadline) **this will CrashLoopBackOff agents on large clusters.**

**Fix:** Either (a) raise startupProbe to `failureThreshold=120` (10 min) for agent only, or (b) make `/readyz` return 200 once the goroutine is *running* even if the first scan is in flight, with a separate metric `model_cache_agent_first_scan_complete`.

**Estimate:** 30 min, but **must validate against a representative PVC size before GA**.

### 4.3 P1 — Important (close in GA + 1 sprint)

#### 4.3.1 No Grafana dashboards or PrometheusRule alerts shipped
The metrics are emitted ([backend/app/metrics.py](../../Desktop/clustra-modal-cache/backend/app/metrics.py)), but there's no `dashboards/` dir, no `manifests/monitoring/prometheusrule.yaml`. Day-2 ops require:
- **Dashboard panels:** total models, models by status, active jobs, job failure rate (1h window), agent heartbeat lag per node, storage usage %, request latency p50/p95/p99.
- **Alerts:**
  - `agent_heartbeat_age > 300s` — page on-call (warning); `> 900s` — critical.
  - `job_failure_rate_5m > 5%` — warning.
  - `storage_usage_percent > 85` — warning; `> 95` — critical.
  - `database_pool_exhausted_total` increase — warning.

Ship these as part of the Helm chart in `templates/monitoring/`.

**Estimate:** 6 hours (dashboards JSON + 5–6 PrometheusRules).

#### 4.3.2 RBAC policy is hard-coded
**Evidence:** [backend/app/dependencies.py:15-22](../../Desktop/clustra-modal-cache/backend/app/dependencies.py#L15-L22) — `ADMIN_USERS = {"admin"}`, hardcoded role map. DB override exists in `system_settings` but no UI, no schema versioning.

**Why GA matters:** A single admin user named `admin` is a brittle assumption. Customers will run as their own Argo CD users. Either:
- Document explicitly that "admin" must exist in their Argo identity, **or**
- Drive role mapping from Argo group membership (e.g., `argocd-admins` group → `role:admin`).

**Estimate:** 2 hours for the second approach.

#### 4.3.3 Argo proxy header trust is spoofable inside cluster
**Evidence:** [backend/app/middleware/auth.py](../../Desktop/clustra-modal-cache/backend/app/middleware/auth.py) — if `MC_AUTH_TRUST_PROXY_HEADERS=true`, any pod that can reach `:8080` directly can set `Argocd-Username: admin`.

**Mitigation already present:** NetworkPolicy ingress restriction would help, but the new `manifests/backend/networkpolicy.yaml` only defines **egress** — there's no ingress restriction. Anyone who can reach the service can spoof.

**Fix options (pick one):**
- Add ingress NetworkPolicy that only accepts traffic from the Argo CD server pod selector.
- Validate a shared HMAC header set by Argo (operationally heavier).
- mTLS (heaviest, best). 

**Estimate:** 1 hour for ingress NetworkPolicy.

#### 4.3.4 OpenAPI is auto-generated but not published
FastAPI exposes `/openapi.json` and `/docs`. For GA:
- Mount under `/api/v1/openapi.json` and link from the README.
- Generate a static markdown reference (e.g., `widdershins`) checked into `docs/api-reference.md`.

**Estimate:** 1.5 hours.

#### 4.3.5 No backup/DR documentation
RDS is the system of record. There's no doc covering: snapshot cadence, PITR window, what to restore vs. recreate (the PVC is rebuildable from the DB + HF Hub; the DB is not).

**Estimate:** 2 hours of documentation + ops review.

### 4.4 P2 — Post-GA

| # | Item | Why later |
|---|---|---|
| 1 | Migrate custom Prometheus emitter → `prometheus_client` library | Works; standardization is hygiene, not a launch gate |
| 2 | RDS CA bundle fetched via plain HTTP `curl` in init container | Trust path is AWS PKI, low real risk; ship CA in image in v1.1 |
| 3 | HF token in pod env vars (visible to anyone with `pods/exec`) | Mount as file with 0400 perms; address with secret rotation story |
| 4 | Keyset pagination instead of offset | Only matters past page 200 |
| 5 | Add `(status, updated_at)` index for stale cleanup | Add when stale-cleanup query shows up in slow-query log |
| 6 | Circuit breaker for Argo API calls | Token cache (60s TTL) already absorbs short outages |
| 7 | Job orchestration / queue depth metrics + backpressure | `MC_MAX_CONCURRENT_DOWNLOADS=3` is sufficient guardrail for GA |
| 8 | OIDC/JWKS direct support (decouple from Argo) | Required for non-Argo deployments; not in current ICP |

---

## 5. Cross-cutting (UI ↔ API contract)

These are issues that touch both repos:

1. **Polling cadence asymmetry.** UI polls `/models` every 10s ([utils/constants.ts](src/app/model-cache/utils/constants.ts)). With 100 active users on the page, that's 600 req/min hitting `/models`. Backend rate limit is 20 mutations/min; reads are uncapped but every request hits the DB (no caching, [§12.2 of the API review](#)). **Action for GA:** add `Cache-Control: max-age=5` to `GET /models` response, and have the UI honor it via SWR-style stale-while-revalidate.
2. **Status enum drift risk.** UI hardcodes status options in [utils/constants.ts](src/app/model-cache/utils/constants.ts); backend defines them in `model_status` Postgres enum. If either side adds a value, the other silently breaks. **Action:** generate UI types from the OpenAPI schema as part of CI.
3. **Audit action labels.** UI maps actions in [AuditTimeline.tsx:11-23](src/app/model-cache/components/AuditTimeline.tsx#L11-L23) (`ACTION_CONFIG`); backend defines them in the audit_action enum (13 actions). New actions added on the backend will render as raw enum strings on the UI. **Action:** include a `label` field in audit log responses, or generate UI mapping from OpenAPI.
4. **Hard-coded `'model-cache'` namespace/PVC defaults.** UI ([DownloadModelModal.tsx:19-20](src/app/model-cache/components/DownloadModelModal.tsx#L19-L20)) and backend ([config.py](../../Desktop/clustra-modal-cache/backend/app/config.py) `MC_DEFAULT_PVC_NAME`) both default to `'model-cache'`. If an operator overrides on the backend, the UI form still suggests the wrong default. **Action:** UI should read defaults from `/health/status` or a new `/api/v1/settings/defaults` endpoint.

---

## 6. GA Release Checklist (use this as the cut criteria)

```
[ ] UI: Add unit tests for hooks + 3 critical flows (P0 §3.2.1)
[ ] UI: Add ARIA attributes to all components (P0 §3.2.2)
[ ] UI: Surface errors from useModels/useJobs/useHealth (P0 §3.2.3)
[ ] UI: Replace native confirm() in PresetsPanel (P0 §3.2.4)
[ ] UI: Add ConfirmDialog for bulk soft-delete (P0 §3.2.5)
[ ] API: Commit the 8 hardening manifests (P0 §4.2.1)
[ ] API: Default agent DB_SSLMODE to verify-full (P0 §4.2.2)
[ ] API: Idempotency on /models/download (P0 §4.2.3)
[ ] API: Cap bulk-action input + async for >50 items (P0 §4.2.4)
[ ] API: Validate agent /readyz timing on real PVC (P0 §4.2.5)
[ ] PM: Decision on positioning (§2 Option A vs. B) — update spec.md
[ ] PM: Write MIGRATION.md (ClusterRole → Role breaking change)
[ ] PM: Tag chart version + write release notes
```

**Estimated effort:** ~25 engineer-hours of code + 8 hours of validation + 4 hours of docs/positioning ≈ **1.5–2 weeks of one engineer's calendar time**, less with parallelization.

---

## 7. Notes for the Codex Reviewer

1. **All citations use `repo:path:line` form.** UI references resolve from `clustra-deploy/ui/`; API references resolve from `clustra-modal-cache/`. If a line number drifts, the file/symbol identity should still be unique enough to relocate.
2. **The 8 uncommitted manifest changes are the most consequential single item in this review.** Read the actual diff (`git -C ~/Desktop/clustra-modal-cache diff manifests/` and `git -C ~/Desktop/clustra-modal-cache status -uall manifests/`) before assessing P0 §4.2.1.
3. **I did not run the test suite, hit the API, or render the UI in a browser.** All findings are static analysis. A reasonable next pass would be: spin up a dev cluster with the uncommitted manifests applied, exercise the bulk-delete + late-arrival cleanup flows end-to-end, and verify the ClusterRole → Role split actually works on `helm upgrade` (not just clean install).
4. **Two things I deliberately did not flag as blockers but reasonable people might disagree:**
   - **i18n** (UI §3.4) — only relevant if a localization customer is in the GA pipeline.
   - **Custom Prometheus emitter** (API §4.4) — works correctly; replacing it is hygiene, not a defect.
5. **Where I'm least confident:** the load characteristics. There are no published load test results for either surface. The recommendations in §5.1 (cache headers, SWR) assume hot cardinality similar to other Argo CD pages; if Model Cache will be left open on operator dashboards 24/7, the polling math changes and the priority of caching rises.

End of review.
