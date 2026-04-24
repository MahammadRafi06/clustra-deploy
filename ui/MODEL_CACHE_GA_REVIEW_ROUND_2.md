# Model Cache — GA Review, Round 2

**Reviewer role:** Senior PM + Product Architect (AI)
**Review date:** 2026-04-24
**Reviewed by:** OpenAI Codex (downstream)
**Predecessor:** [MODEL_CACHE_GA_REVIEW.md](MODEL_CACHE_GA_REVIEW.md) (Round 1)

**Scope of this round:**
- **UI** commit `8b7a39625` — *"Prepare model cache UI for GA"* (21 files, +1132 / −326)
- **API** commit `444f740` — *"Harden model cache service for GA"* (HEAD of `clustra-modal-cache`)

---

## 1. Executive Summary

**Both teams shipped the P0 list.** The substantive launch blockers are closed. What remains is operational maturity (dashboards, alerts, docs) and three small but real bugs the audit caught that weren't in Round 1.

**Updated verdict:** 🟢 **GO for GA** after fixing the **3 small carry-overs in §6** (≈4 engineer-hours total). Ship the rest as a fast-follow in the GA+1 sprint.

| Surface | Round 1 | Round 2 | Δ |
|---|---|---|---|
| UI | 🟡 5 P0 open | 🟢 5/5 P0 closed, 6/8 P1 closed | +5 P0, +6 P1 |
| API | 🟡 5 P0 open | 🟢 5/5 P0 closed, 1/5 P1 closed | +5 P0, +1 P1 |
| Cross-cutting | 4 open | 1.5/4 closed | +1.5 |

**Headline:** procurement-blocking and security-blocking issues are resolved. The team did the hard work first — exactly the right call. The remaining gaps are visible to ops, not to customers.

---

## 2. UI — Round 2 Findings

### 2.1 What shipped (P0 — all 5 done)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| §3.2.1 | Tests added | ✅ | New [api/client.test.ts](src/app/model-cache/api/client.test.ts) — 4 cases (query serialization, POST body, 409 mapping, 204 handling) |
| §3.2.2 | Accessibility | ✅ **exceeds spec** | ARIA on every interactive component: `role`/`aria-label`/`aria-pressed`/`aria-modal`/`aria-live`/`aria-busy`/`aria-hidden` across [FilterToolbar](src/app/model-cache/components/FilterToolbar.tsx), [BulkActionBar](src/app/model-cache/components/BulkActionBar.tsx), [JobLogViewer](src/app/model-cache/components/JobLogViewer.tsx), [ModelDetailDrawer](src/app/model-cache/components/ModelDetailDrawer.tsx), all `SlidingPanel` instances, status badges, and toasts |
| §3.2.3 | Error surfacing | ✅ **above spec** | Hooks now expose `error` + `isPollingPaused`; polling auto-pauses after `MAX_POLL_FAILURES = 3`; manual `refetch` resets — see [useModels.ts:17-71](src/app/model-cache/hooks/useModels.ts), [useJobs.ts:16-70](src/app/model-cache/hooks/useJobs.ts), [useHealth.ts:16-70](src/app/model-cache/hooks/useHealth.ts) |
| §3.2.4 | Native `confirm()` removed | ✅ | [PresetsPanel.tsx:212-221](src/app/model-cache/components/PresetsPanel.tsx#L212-L221) uses `ConfirmDialog` |
| §3.2.5 | Bulk soft-delete confirmation | ✅ | [ModelCachePage.tsx:380-389](src/app/model-cache/pages/ModelCachePage.tsx#L380-L389) — two-step flow with count in copy ("Soft delete N selected models?") |

### 2.2 P1 — 6/8 done

| # | Item | Verdict | Evidence |
|---|---|---|---|
| §3.3.1 | Remove `console.error` | ✅ | Gone from `ModelDetailDrawer.tsx` |
| §3.3.2 | Bulk action result toast | ✅ | "Pin complete: 12 succeeded, 3 failed" — [ModelCachePage.tsx:182](src/app/model-cache/pages/ModelCachePage.tsx#L182) |
| §3.3.3 | Toast magic numbers extracted | ✅ | `TOAST_DURATION_MS` in [constants.ts:4](src/app/model-cache/utils/constants.ts#L4) |
| §3.3.4 | AuditTimeline dedup → `entry.id` | ⚠️ **partially done — see §6.1** | Render key uses `entry.id` ([AuditTimeline.tsx:82](src/app/model-cache/components/AuditTimeline.tsx#L82)), but **dedup key still `${action}-${created_at}`** at [AuditTimeline.tsx:45](src/app/model-cache/components/AuditTimeline.tsx#L45) |
| §3.3.5 | StatusBadge label map | ✅ | `MODEL_STATUS_LABELS` in [constants.ts:27-40](src/app/model-cache/utils/constants.ts#L27-L40); also feeds `aria-label` |
| §3.3.6 | `visibilitychange` listener | ⚠️ **good enough but not literal** | All three hooks check `isDocumentVisible()` per tick; no event listener. Practical outcome: polling pauses within one interval (max 30s) of tab hide. Acceptable. |
| §3.3.7 | Defaults from `/health/status` | ✅ | [DownloadModelModal](src/app/model-cache/components/DownloadModelModal.tsx) accepts `defaultTargetPvc`/`defaultTargetNamespace`; [ModelCachePage.tsx:364-365](src/app/model-cache/pages/ModelCachePage.tsx#L364) feeds them from `useHealth()` data. **The matching backend change shipped too** (see §3) — these wire up end-to-end. |
| §3.3.8 | `JSON.stringify(params)` dep | ❌ **not done — see §6.2** | Still present at [useModels.ts:55](src/app/model-cache/hooks/useModels.ts#L55) and [useJobs.ts:54](src/app/model-cache/hooks/useJobs.ts#L54) |

### 2.3 Quality of the test additions

The 4 new API client tests are **necessary but not sufficient.** They cover request shape and status-code mapping, but not:

- The new error-recovery and polling-pause logic in the hooks (literally the most user-visible change in this commit).
- The new bulk-soft-delete confirmation flow.
- The new download form `defaultTarget*` props.

**Recommendation (post-GA):** Add ~6 hook tests (3 hooks × happy path + failure path) and 2 integration tests for the confirmation flows. ~3 hours of work. Not a launch blocker; the API client tests are enough to ship.

### 2.4 Unexpected good changes

- **[api/client.ts](src/app/model-cache/api/client.ts) now handles 204/non-JSON responses** before calling `.json()` — prevents the "Unexpected end of JSON input" class of bug. Not flagged in Round 1, valuable.
- **`isDocumentVisible()` was extracted as a helper** rather than inlined — small DX win for future tab-aware features.
- **`aria-pressed` on the "pinned" filter toggle** in [FilterToolbar.tsx:84](src/app/model-cache/components/FilterToolbar.tsx#L84) — screen-reader-correct toggle semantics, not just generic button labels.

---

## 3. API — Round 2 Findings

### 3.1 P0 — all 5 done

| # | Item | Verdict | Evidence |
|---|---|---|---|
| §4.2.1 | Commit hardening manifests | ✅ | All 8 files in commit `444f740`. Helm chart bumped 0.1.0→0.1.1, appVersion 1.3.7. **`MIGRATION.md` added** (line 10 documents the ClusterRole → Role breaking change with deletion steps). |
| §4.2.2 | Agent `DB_SSLMODE=verify-full` default | ✅ | [`agent/internal/config/config.go:96`](../../Desktop/clustra-modal-cache/agent/internal/config/config.go#L96) sets the default; [lines 139-144](../../Desktop/clustra-modal-cache/agent/internal/config/config.go#L139-L144) reject `disable` against remote hosts. Two new tests at [`config_test.go:82-99`](../../Desktop/clustra-modal-cache/agent/internal/config/config_test.go#L82-L99) cover both branches. Mirrors backend pattern correctly. |
| §4.2.3 | Idempotency on `/models/download` | ✅ **(option A)** | Server-side dedup: if a model is already in `downloading` state, returns the existing job with 200. See [`backend/app/routers/models.py:142-169`](../../Desktop/clustra-modal-cache/backend/app/routers/models.py#L142-L169) and [`backend/app/services/job_service.py:52-61`](../../Desktop/clustra-modal-cache/backend/app/services/job_service.py#L52-L61). Test added at [`test_models_router.py:159-185`](../../Desktop/clustra-modal-cache/backend/tests/test_models_router.py#L159-L185). **Carries one residual edge case — see §6.3.** |
| §4.2.4 | Bulk-action input cap | ✅ | `max_length=100` at [`backend/app/schemas/model.py:75`](../../Desktop/clustra-modal-cache/backend/app/schemas/model.py#L75). Stricter than my suggested 500, which is fine — 100 keeps the synchronous loop fast enough that the async-for-large-batches recommendation is moot. |
| §4.2.5 | Agent `/readyz` first-scan timeout | ✅ | New `readinessState` machine at [`agent/cmd/agent/main.go:26-63`](../../Desktop/clustra-modal-cache/agent/cmd/agent/main.go#L26-L63); `/readyz` returns 200 with `"ready: first scan in progress"` once the scan goroutine starts. Manifest startupProbe raised to `failureThreshold=120` (10 min) at [`manifests/agent/deployment.yaml:117-123`](../../Desktop/clustra-modal-cache/manifests/agent/deployment.yaml#L117-L123). |

### 3.2 P1 — 1/5 done (rest deferred)

| # | Item | Verdict | Notes |
|---|---|---|---|
| §4.3.1 | Grafana dashboards + PrometheusRule | ❌ | Scrape annotations and Prometheus selectors are in place; no actual dashboards or alert rules ship. **Day-2 ops gap.** |
| §4.3.2 | RBAC: Argo group mapping | ❌ | Still hard-coded `ADMIN_USERS = {"admin"}` at [`backend/app/dependencies.py:22`](../../Desktop/clustra-modal-cache/backend/app/dependencies.py#L22). Customers running as non-`admin` Argo users won't have admin permissions out of the box. |
| §4.3.3 | Backend ingress NetworkPolicy | ✅ | [`manifests/backend/networkpolicy.yaml`](../../Desktop/clustra-modal-cache/manifests/backend/networkpolicy.yaml) restricts ingress to `argocd-server` pod selector + Prometheus. Closes the proxy-header spoofing surface from Round 1 §4.3.3. |
| §4.3.4 | OpenAPI / api-reference.md | ❌ | `/openapi.json` is generated at runtime; no static markdown reference checked in. |
| §4.3.5 | Backup / DR docs | ❌ | `deployment-guide.md` got TLS/NetworkPolicy guidance but no backup/PITR/restore section. |

### 3.3 Unexpected good changes

- **OTLP tracing knobs exposed in both ConfigMaps** (backend + agent). Not on the list; gives operators a way to enable distributed tracing without rebuilding.
- **DB pool, connect timeout, recycle, TLS bundle path are all surfaced** in the backend ConfigMap (41 keys total, up from 3). Tunable for load without code changes.
- **Rate-limit knobs now configurable** at deploy time (mutation, log-stream, version-check). Was hard-coded before.
- **Helm `templates/networkpolicy.yaml`** parameterizes the Argo CD pod selectors — operators with non-default Argo namespaces can configure via values without forking the chart. *(But the **raw** `manifests/backend/networkpolicy.yaml` still hard-codes `kubernetes.io/metadata.name: argocd` and `app.kubernetes.io/name: argocd-server` — see §6.4.)*

---

## 4. Cross-cutting — Round 2 status

| # | Item | Round 1 | Round 2 |
|---|---|---|---|
| §5.1 | `Cache-Control` / SWR on `/models` | open | ❌ still open. Polling still uncached at 10s/5s/30s. With the new visibility-aware polling on the UI side, real-world load is somewhat lower than the Round 1 estimate, but there's still no server-side caching. **Defer to GA+1.** |
| §5.2 | OpenAPI codegen for status enums | open | ❌ still open. Both sides still maintain enum mappings independently. UI does have explicit fallbacks (`replace(/_/g, ' ')`) so unknown statuses degrade safely. |
| §5.3 | Audit action labels server-side | open | ⚠️ partial. UI's `ACTION_CONFIG` map covers the current 11 actions; backend [`schemas/audit.py:9-19`](../../Desktop/clustra-modal-cache/backend/app/schemas/audit.py#L9-L19) still returns enum value, no `label` field. |
| §5.4 | UI reads PVC/namespace defaults from server | open | ✅ **fully closed end-to-end.** Backend [`routers/health.py:96-99`](../../Desktop/clustra-modal-cache/backend/app/routers/health.py#L96-L99) returns `default_pvc_name` and `default_namespace` in `SystemHealth`; UI form consumes them via `useHealth()`. This is the cleanest cross-cutting fix in this round. |

---

## 5. PM-level: positioning question status

The Round 1 question — *"is Model Cache officially in `spec.md`'s GA scope or shipping as Tech Preview?"* — was not addressed in either commit. **Both repos now look launch-ready, so the positioning decision is on the critical path.**

**Recommendation:** Add Model Cache to `spec.md §4` ("Current launch scope") with a short capability description. The work is done; not claiming it as part of GA understates the deliverable.

---

## 6. Carry-overs — small but real

These are the residual issues from the round. **Items §6.1 and §6.3 are the only ones I'd ask to fix before GA cut.** Items §6.2 and §6.4 can ship as GA+1.

### 6.1 [P1, fix before GA] AuditTimeline dedup is still lossy
[AuditTimeline.tsx:45](src/app/model-cache/components/AuditTimeline.tsx#L45) keys the `seen` set on `${action}-${created_at}` — two events of the same kind in the same second silently lose one. The fix in Round 1 §3.3.4 was specifically *"key by `entry.id`"*. The render key was updated correctly (line 82); the dedup key was missed.

**Fix:** one-line change.
```ts
const key = entry.id;  // was: `${entry.action}-${entry.created_at}`
```

**Effort:** 5 minutes. **Why before GA:** integrity-check + scan-completed pairs commonly fire at the same second — this would silently drop entries from the timeline that operators rely on for forensics.

### 6.2 [P2] `useModels` / `useJobs` still depend on `JSON.stringify(params)`
[useModels.ts:55](src/app/model-cache/hooks/useModels.ts#L55) and [useJobs.ts:54](src/app/model-cache/hooks/useJobs.ts#L54) recompute the dep on every render. Combined with the new error/polling state living *in the hook itself*, this can cause re-renders to trigger unnecessary refetches.

**Fix:** stabilize via a `useMemo` over the param values, or factor a small `useStableJSON(params)` hook.

**Effort:** 30 min. **Why post-GA:** measurable as a small CPU/network drain at high concurrency, not a user-visible bug today.

### 6.3 [P1, fix before GA] Idempotency edge case — stale `downloading` job
The dedup logic in [`backend/app/services/job_service.py:52-61`](../../Desktop/clustra-modal-cache/backend/app/services/job_service.py#L52-L61) returns the existing job if the model is in `downloading` state. **But if the first attempt's K8s Job creation succeeded yet the GitOps push failed**, the model can sit in `downloading` for the full `MC_GITOPS_QUEUE_TIMEOUT_SECONDS` (default 900s = 15 min). During that window, every retry returns a stale, never-going-anywhere job ID — and the user can't trigger a real retry.

**Fix:** in `_get_active_download_job`, also check job age. If the existing job is older than `MC_GITOPS_QUEUE_TIMEOUT_SECONDS / 2` AND has no associated K8s Job name yet, fall through and create a fresh job (with bumped `download_generation`).

**Effort:** 1.5 hours including a regression test. **Why before GA:** turns a recoverable transient failure into a perceived "stuck" download — first-impression bug for new users.

### 6.4 [P2] Raw manifests vs. Helm chart drift
[`manifests/backend/networkpolicy.yaml`](../../Desktop/clustra-modal-cache/manifests/backend/networkpolicy.yaml) hard-codes `kubernetes.io/metadata.name: argocd` and `app.kubernetes.io/name: argocd-server`. The Helm chart at `charts/model-cache/templates/networkpolicy.yaml` parameterizes them. Customers using `kubectl apply -f manifests/` (path documented in the deployment guide) get the hard-coded values and must edit by hand if their Argo CD lives elsewhere.

**Fix options:**
1. **Recommended:** delete `manifests/backend/networkpolicy.yaml` and `manifests/agent/networkpolicy.yaml` from the raw manifest set, pointing operators to Helm only. (Less surface to maintain.)
2. **Alt:** add a callout in the deployment guide explicitly listing the values an operator must edit when applying raw manifests.

**Effort:** 30 min. **Why post-GA:** doesn't affect the Helm install path which is the documented one for prod.

---

## 7. Things that were *not* on the Round 1 list but caught my eye in Round 2

1. **No metric for "first scan complete"** on the agent. The new `/readyz` correctly returns 200 once the scan *starts*, which is the right call for K8s probe semantics. But operators have no signal for "this 1M-file PVC has finished its first reconciliation." Add a gauge `model_cache_agent_first_scan_completed{node="…"}` — a counter going 0→1 after the initial scan succeeds. **30 min, post-GA.**

2. **No test for the bulk-action 100-cap.** Pydantic enforces it at the schema layer, but no test asserts the 422 response. **15 min, before or after GA.**

3. **The init container that fetches the RDS CA bundle uses plain `curl -fsSL`.** AWS PKI is the trust anchor — there's no signature verification. Risk is low (curl will at least validate the HTTPS chain to AWS), but for true defense-in-depth, future versions should ship the bundle in the image. **Not a launch blocker; tracked already in original review §4.4.**

4. **Both repos still lack load-test artifacts.** Round 1 listed this under the "least confident" section; nothing was added. With idempotency + bulk caps in place the load profile is now bounded enough to test meaningfully — **recommended pre-GA validation: a 30-min synthetic test simulating 50 concurrent UI sessions + 20 in-flight downloads on a real cluster.** Document the resulting headroom before GA cut.

---

## 8. Updated GA Decision

**🟢 GO for GA** with the following minimum:

```
Pre-cut (must):
[ ] Fix AuditTimeline dedup key (§6.1)              — 5 min
[ ] Fix idempotency stale-downloading edge (§6.3)   — 1.5 hr
[ ] Make positioning decision in spec.md (§5)       — 30 min
[ ] Run a synthetic load test on a real cluster (§7.4) — 1 day calendar
[ ] Cut release tag (UI: 1.0.0; chart: 0.2.0)       — 15 min

Fast-follow (GA+1, ~1 sprint):
[ ] Grafana dashboards + 5 PrometheusRule alerts (§4.3.1)
[ ] Backup/DR documentation (§4.3.5)
[ ] OpenAPI markdown reference published (§4.3.4)
[ ] RBAC: Argo group → role mapping (§4.3.2)
[ ] Cache-Control on GET /models (§5.1)
[ ] Hook tests for error/polling-pause logic (§2.3)
[ ] Stabilize useModels/useJobs param deps (§6.2)
[ ] First-scan-complete agent metric (§7.1)
```

**Total pre-cut work:** ~2 engineer-hours of code + a half-day of cluster validation. The team earned this position by addressing the right list in the right order.

---

## 9. Notes for Codex Reviewer

1. **What's verifiable mechanically and what isn't.** P0 items are all checkable from the diff (`git show 8b7a39625` and `git show 444f740`). The carry-overs in §6 and the deferred items in §4-§5 cannot be confirmed by tests passing — they need code reading.

2. **The two carry-overs I'd argue with the team about (§6.1, §6.3) both came up because the original Round 1 fix description was specific** (`entry.id` as dedup key; idempotency on `(repo_id, revision, source)` independent of state). The team implemented the spirit but not the letter, in both cases producing something that works for the common case but breaks at the edge. Worth asking: does the team have a habit of trimming acceptance criteria during planning? If so, future review docs should mark "acceptance test you can run" alongside each fix.

3. **Where I revised my Round 1 priorities upward:** the `/health/status` defaults endpoint (§5.4) — I called it cross-cutting hygiene; the team built it cleanly end-to-end on both sides, which closes a whole class of "what does the cluster actually use" support tickets. Worth highlighting in the GA release notes.

4. **Where I revised downward:** §3.3.6 (`visibilitychange` listener). I asked for a literal event listener; the team did per-tick polling-skip via `isDocumentVisible()`. Behaviorally equivalent for the user, simpler code. Accepting this implementation.

5. **What I did not check:** I didn't run the test suites or render the UI. I didn't apply the Helm chart to a cluster. The §7.4 load-test recommendation reflects that gap.

End of round 2.
