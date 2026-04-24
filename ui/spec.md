# Deploy Models GA Spec

Status: GA-ready in code, pending final production runbook completion

Last updated: 2026-04-24

Primary repos:
- UI and Argo CD proxy extension: `/home/mahammad/clustra-deploy`
- API/service: `/home/mahammad/Desktop/clustra-ai-service`

Primary implementation paths:
- UI: `src/app/deploy-models/`
- Model Cache UI: `src/app/model-cache/`
- Proxy signer: `server/extension/extension.go`
- Service: `clustra_ai_service/`
- Model Cache service and agent: `/home/mahammad/Desktop/clustra-modal-cache`

## 1. Purpose

Deploy Models is a first-party Argo CD experience for generating, validating, estimating, and deploying model-serving configurations without forcing users to drop into raw YAML or internal CLI tooling.

The product goal is to make common model deployment tasks safe, explainable, and operable inside the existing Argo CD workflow:
- discover the current project/application context
- understand what action will run and where it will write
- run AI Configurator jobs with bounded operational risk
- inspect audit history and recent runs
- understand failures well enough to self-serve or escalate with a request id

## 2. Goals

### Launch goals
- Provide a usable Deploy Models experience for platform users inside Argo CD.
- Support both synchronous analysis flows and asynchronous deployment/generation flows.
- Make write targets explicit before the user submits a job.
- Provide recent runs, audit history, and copyable support identifiers.
- Enforce a trusted proxy boundary between the UI and the service.
- Bound execution time, cancellation behavior, polling, retention, and per-user concurrency.

### Non-goals for GA
- Multi-replica active-active job execution.
- A full distributed work-queue platform.
- Pause/resume/checkpointed jobs.
- A cross-app team activity feed.
- Full analytics-driven optimization of the UX before launch.

## 3. Users and core journeys

### Primary users
- Platform engineers deploying or tuning model-serving configurations.
- ML infrastructure engineers validating compatibility, estimates, and generated configs.
- Operators supporting failed or stuck deployments through job history and audit data.

### Core journeys
1. Quick check
   - User opens the page in Argo CD.
   - User selects a task like Support or Estimate.
   - User gets a direct response with guidance and request ids if something fails.

2. Guided deploy
   - User opens Default or Generate.
   - User sees the current application context and deploy target notice.
   - User optionally runs preflight.
   - User submits an async job.
   - User watches status, audit history, GitOps state, and result details.

3. Team visibility
   - User lands on a task page and immediately sees recent runs for the current app.
   - User opens an existing run, reviews audit output, and decides whether to retry or escalate.

## 4. Current launch scope

### UI tasks
- `Default`: guided async deployment flow with preflight.
- `Generate`: async config generation flow.
- `Experiment`: async advanced flow using YAML path or inline config.
- `Support`: sync compatibility/advisory check.
- `Estimate`: sync resource and topology estimation.
- `Model Cache`: first-party catalog, download, lifecycle, audit, job log, and node health surface for cached model artifacts.

### Service capabilities
- Async job submission, storage, audit tracking, polling, cancellation, and retention.
- Sync support and estimate endpoints.
- GitOps commit/retry lifecycle surfaced back to the UI.
- Health, readiness, and Prometheus metrics endpoints.
- Model Cache API, agent reconciliation, download job orchestration, lifecycle actions, audit trail, and operational health endpoints.

## 5. Functional requirements

### UX requirements
- The page must infer Argo CD application and project context from the extension host.
- The page must show where a deploy writes before submission.
- Advanced jargon must be explained inline with field-level help.
- Recent runs must be visible by default on async task pages.
- Result and error views must show enough information for operator follow-up.
- Accessibility basics must be covered:
  - a `<main>` landmark
  - focus management on important state transitions
  - a live audit log region
  - consistent loading indicators

### Async job requirements
- Jobs must have persistent identifiers and pollable status.
- Jobs must keep an audit trail.
- Jobs must enforce per-user concurrency limits.
- Jobs must stop on cancellation within seconds, not minutes.
- Jobs must stop on execution timeout and return a clear failure with request ids.
- Jobs must be visible to users in the same application context.
- Cancellation permissions must be explicit and not implied by mere visibility.

### Sync endpoint requirements
- Support and Estimate must remain fast, bounded, and traceable.
- Errors must expose `request_id` and `trace_id`.

## 6. UI architecture

UI implementation lives in `src/app/deploy-models/`.

### Main building blocks
- `App.tsx`: top-level shell and task routing.
- `components/AppContext.tsx`: Argo CD application/project context and source selection.
- `components/TaskSelector.tsx`: task entry point with sync/async framing.
- `components/DeployTargetNotice.tsx`: explicit repo/branch/path target notice.
- `components/RecentRunsPanel.tsx`: app-scoped recent async jobs.
- `components/JobRunConsole.tsx`: banner, audit log, result surface, and recent-run drill-in.
- `components/FieldInput.tsx`: shared input rendering and glossary/help text.
- `pages/DefaultPage.tsx`: guided async deploy with preflight.
- `pages/GeneratePage.tsx`: async generation flow.
- `pages/ExpPage.tsx`: advanced experiment flow.
- `pages/SupportPage.tsx`: sync compatibility flow.
- `pages/EstimatePage.tsx`: sync estimation flow.

### UX behaviors shipped for GA
- Task descriptions clarify sync versus async behavior.
- Field help covers key terms like ISL, OSL, TTFT, TPOT, database modes, quantization modes, and topology knobs.
- Recent Runs is promoted to the top of async task pages.
- Error surfaces show request ids.
- Polling uses exponential backoff, bounded retries, exhaustion state, and manual retry.
- Audit history is accessible and visible during run monitoring.

## 7. API and service architecture

Service implementation lives in `clustra_ai_service/`.

### Endpoint groups

| Endpoint | Type | Purpose |
|---|---|---|
| `POST /api/v1/default/preflight` | Sync | Validate the request and return readiness, warnings, and recommended DB mode |
| `POST /api/v1/default` | Async | Run the guided deploy flow |
| `POST /api/v1/generate` | Async | Generate deployable configuration artifacts |
| `POST /api/v1/exp` | Async | Run advanced experiment/config flows |
| `POST /api/v1/support` | Sync | Check support and compatibility |
| `POST /api/v1/estimate` | Sync | Estimate topology and resource needs |
| `GET /jobs` | Sync | List jobs, optionally filtered by status and `app_name` |
| `GET /jobs/{job_id}` | Sync | Fetch one job result |
| `GET /jobs/{job_id}/audit` | Sync | Fetch audit trail |
| `DELETE /jobs/{job_id}` | Sync | Cancel an active job |
| `GET /health` | Sync | Liveness |
| `GET /ready` | Sync | Readiness, including DB reachability |
| `GET /metrics` | Sync | Prometheus metrics |

### Core runtime model
- Async jobs are persisted and wrapped in tracked background tasks.
- CLI-heavy async work runs in subprocesses through `clustra_ai_service/job_worker.py`.
- Cancellation is enforced at both task and subprocess levels.
- Execution time is bounded with `AICONF_JOB_EXECUTION_TIMEOUT_SECONDS`.
- Job history is retained and later cleaned up by a background retention loop.
- Startup reconciliation is heartbeat-aware and worker-instance-aware.

### Current job states

`job.status`
- `pending`
- `running`
- `success`
- `failed`
- `cancelled`

`gitops_status`
- `queued`
- `retrying`
- `committed`
- `noop`
- `failed`
- `cancelled`

### Preflight contract
- `status`: `ready`, `warning`, or `failed`
- `can_run_anyway`: whether the user can intentionally continue despite warnings
- `recommended_database_mode`: suggested remediation when applicable
- `messages[]`: typed severity and user-facing explanation

## 8. Security and trust boundary

### Trust model
- The browser talks only to the first-party Argo CD proxy path.
- The Go proxy extension signs application context headers with HMAC.
- The Python service verifies those headers and rejects missing, stale, or invalid signatures.

### Security requirements
- `AICONF_PROXY_SIGNATURE_SECRET` must be configured in production.
- Signature age is bounded by `AICONF_PROXY_SIGNATURE_MAX_AGE_SECONDS` with a default of `300`.
- Signature comparison must use constant-time equality.
- Only the in-cluster trusted proxy should be allowed to reach the service.
- The service must run as a non-root container user.

### Current operational guardrails
- Startup warning if the proxy signature secret is missing.
- Network policy support in the Helm chart.
- Request correlation via `X-Request-ID`, `X-Trace-ID`, and `traceparent`.

## 9. Reliability and operational controls

### Runtime controls

| Setting | Default | Purpose |
|---|---|---|
| `AICONF_MAX_CONCURRENT_JOBS_PER_USER` | `3` | Prevent one user from saturating worker capacity |
| `AICONF_JOB_EXECUTION_TIMEOUT_SECONDS` | `600` | Bound one async job run |
| `AICONF_JOB_HEARTBEAT_INTERVAL_SECONDS` | `15` | Mark active worker ownership |
| `AICONF_STALE_JOB_TIMEOUT_SECONDS` | `90` | Identify stale jobs on recovery |
| `AICONF_JOB_RETENTION_DAYS` | `30` | Retain completed jobs and audit history |
| `AICONF_JOB_RETENTION_CLEANUP_INTERVAL_SECONDS` | `3600` | Retention cleanup cadence |
| `AICONF_PROXY_SIGNATURE_MAX_AGE_SECONDS` | `300` | Reject stale signed proxy context |
| `AICONF_RECONCILE_ON_STARTUP` | `true` | Run stale job reconciliation at startup |

### Reliability features in scope
- Thread pool with bounded shutdown behavior.
- Subprocess isolation for CLI-heavy work.
- SIGTERM then SIGKILL escalation during timeout or cancellation.
- Bounded UI polling with retry caps and manual retry.
- App-scoped recent runs to avoid noisy shared-instance history.
- Request ids surfaced all the way to the UI.

## 10. Data and observability

### Persisted data
- Jobs
- Job status and timing metadata
- Triggering user
- Application name
- GitOps status
- Audit trail events

### Observability shipped for GA
- Structured logs with request and trace correlation.
- Prometheus metrics for HTTP, job lifecycle, and GitOps outcomes.
- Health and readiness endpoints.
- Optional OpenTelemetry integration.

### Operational helper
- `/home/mahammad/Desktop/clustra-ai-service/scripts/report_job_durations.py` summarizes recent successful job durations and recommends a timeout target based on observed p99.

## 11. Deployment model

### Current supported rollout shape
- Single replica production deployment
- `strategy.type: Recreate`
- Shared persistent database
- Shared Git credentials or SSH identity for commit operations

### Required production configuration
- `DATABASE_URL`
- `AICONF_PROXY_SIGNATURE_SECRET`
- matching proxy extension signing secret
- Git credentials with write access to target repos
- memory and CPU limits sized for concurrent subprocess execution

### Required pre-launch runbook
1. Set the same non-empty HMAC secret in both the proxy extension and the service.
2. Point `DATABASE_URL` at persistent Postgres.
3. Confirm Git write credentials are valid for the target application repos.
4. Run `cd /home/mahammad/Desktop/clustra-ai-service && python scripts/report_job_durations.py --limit 50` against prod-like data and confirm or adjust the timeout.
5. Validate Helm/chart deployment in staging.
6. Confirm rollback steps and previous image/chart versions.

## 12. Testing and acceptance

### Test expectations
- Service unit and integration tests cover:
  - signature verification
  - cancellation
  - timeout handling
  - Helm render contract
  - API behavior for job access and filters
- UI validation covers:
  - typed API contract
  - lint-clean Deploy Models components
  - production build success

### GA acceptance criteria
- All Revision 3 launch blockers are closed in code.
- Full test suite is green in the service repo.
- Deploy Models UI builds successfully.
- The operational checklist has been completed in the target environment.

## 13. Known constraints

- Multi-replica execution is intentionally deferred until after launch validation.
- The current deployment strategy remains `Recreate`.
- Analytics are not yet wired and must be added immediately post-launch.
- True distributed work-queue isolation is not part of the GA architecture.

## 14. Post-GA roadmap

### Sprint A: analytics and product measurement
- Add a `useTrack` hook and ship product events such as:
  - `page_viewed`
  - `task_selected`
  - `form_submitted`
  - `preflight_triggered`
  - `preflight_blocked`
  - `run_anyway_clicked`
  - `job_succeeded`
  - `job_failed`
  - `job_cancelled`
  - `recent_run_clicked`
  - `audit_trail_expanded`
  - `retry_now_clicked`
  - `raw_payload_expanded`
- Deploy analytics infrastructure such as PostHog OSS or the company-standard stack.

### Sprint B: multi-replica readiness
- Run with `replicas: 2` in staging and observe for at least one full week.
- Validate no duplicate commits, no lost jobs, and correct worker ownership handling.
- Move from `Recreate` to `RollingUpdate` only after the above is stable.
- Revisit `AICONF_RECONCILE_ON_STARTUP` semantics for multi-replica behavior.

### Sprint C: observability and scale
- Ship Grafana dashboards with key request, job, and GitOps metrics.
- Add alerting for 5xx rate, saturation, retry growth, and DB issues.
- Add DB growth visibility for the jobs and audit tables.

### Sprint D: platform evolution
- Evaluate a real work-queue backend behind a feature flag.
- Compare:
  - `SQS + worker service` as the likely default managed option
  - `AWS Batch` for heavier compute-oriented jobs
  - `Step Functions` for workflow-heavy orchestration
  - `Celery + Amazon MQ` only if Celery primitives become a real need
- Add a team activity feed and aggregated audit surface.
- Add generated-file viewers and richer GitOps artifact drill-in.
- Add HMAC secret rotation support with dual-secret verification.

## 15. Risks to monitor after launch

1. Timeout value is too low for real-world sweep durations.
2. Proxy and service HMAC secrets are mismatched.
3. Concurrent subprocess memory use exceeds pod limits.
4. GitOps commit retries accumulate silently.
5. Frequent open tabs create unnecessary `/jobs` polling load.

## 16. Decision summary

This feature is ready for GA from a code perspective. The remaining launch risk is operational setup, not product architecture. The near-term focus should be:
- finish the production runbook
- launch
- add analytics immediately
- validate multi-replica readiness before changing rollout strategy
