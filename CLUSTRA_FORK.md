# Clustra Deploy — Fork Maintenance Guide

This repository is a fork of [argoproj/argo-cd](https://github.com/argoproj/argo-cd)
with Clustra-specific extensions (Model Deployments, Model Inventory, Policy
Management, brand theming, server-side proxy). This guide explains how to keep
the fork current with upstream releases.

## Branch layout

| Branch | Purpose |
|---|---|
| `main` | Production integration branch. All Clustra customizations land here. Releases tagged from this branch. |
| `upstream-mirror` | Strict mirror of `upstream/release-3.4` (or whichever upstream branch we track). **Never commit directly.** Refresh via `git push origin upstream/release-3.4:upstream-mirror`. |
| `feat/*` | Short-lived feature branches off `main`. PR back to `main` and delete. |
| `chore/sync-upstream-*` | Per-sync branches for catching up to upstream releases. PR to `main`. |

## Remotes

```bash
origin    https://github.com/MahammadRafi06/clustra-deploy.git    (fetch + push)
upstream  https://github.com/argoproj/argo-cd.git                 (fetch only)
```

## Snapshot tags

Before every upstream sync, tag a rollback point: `clustra/snapshot-YYYY-MM-DD`.
Current snapshots:

- `clustra/snapshot-2026-05-16` — baseline before the first deliberate upstream
  catch-up + branch reorganization.

## One-time per-clone setup

The `.gitattributes` file uses a `theirs` merge driver to auto-resolve files we
never maintain by hand (generated manifests, snyk reports). Run once per clone:

```bash
git config --local merge.theirs.name "always take theirs"
git config --local merge.theirs.driver "cp -f %B %A"
```

After that, files marked `merge=theirs` in `.gitattributes` will auto-resolve to
upstream's version during a merge.

## Sync workflow

When you want to pull new upstream features or fixes:

```bash
# 1. Refresh local upstream refs and the mirror branch on origin
git fetch upstream
git push origin upstream/release-3.4:upstream-mirror

# 2. Branch off main for the sync work (never merge directly into main)
git checkout main
git pull
git checkout -b chore/sync-upstream-$(date +%Y-%m-%d)

# 3. Merge upstream into the sync branch
git merge upstream/release-3.4

# 4. Resolve remaining conflicts (see "Known conflict hotspots" below)

# 5. Verify the result builds and tests pass
cd ui && yarn install && yarn build && yarn test && yarn lint
cd .. && go test ./...

# 6. Smoke-test the customized routes:
#    - /applications (Argo CD core)
#    - /deploy-models (Model Deployments)
#    - /model-cache (Model Inventory)
#    - /policy-management/runtime-config (Runtime Config v2)
#    - /settings/clusters, /settings/projects (Argo CD settings)

# 7. PR the sync branch into main. Squash or keep history per team preference.
```

## Known conflict hotspots

Despite the `clustra/` plugin module (see "Architecture" below), some files have
in-place customizations that will conflict on upstream syncs. Listed roughly in
order of expected friction:

### UI (sidebar/layout/theming)

- `ui/src/app/sidebar/sidebar.tsx` — small re-export shim into
  `ui/src/app/clustra/ClustraSidebar.tsx`. Conflicts here are rare; if upstream
  changes the `Sidebar` interface, reflect it in `ClustraSidebar.tsx`.
- `ui/src/app/sidebar/sidebar.scss` — heavily customized; expect conflicts.
- `ui/src/app/app.tsx` — uses `clustra/` plugin imports for routes and nav. The
  remaining diff is the constructor, `componentDidMount`, Helmet, PageContext
  title, and JSX route map. ~94 lines vs upstream.
- Multiple `ui/src/app/applications/components/**/*.scss` — brand-token
  application. Mostly additive but may conflict.

### Build / dependencies

- `ui/package.json` — Clustra adds `@fontsource/*`, `react-helmet-async` (in
  future), etc. Take upstream version bumps, keep our additions.
- `ui/yarn.lock` — regenerate after resolving `package.json`:
  `cd ui && rm yarn.lock && yarn install`. **Do not** hand-resolve yarn.lock conflicts.
- `go.mod`, `go.sum` — same idea: take upstream's, then `go mod tidy`.
- `ui/src/app/webpack.config.js` — Clustra adds font/asset loaders.

### Server / Go

A naive `git diff upstream/release-3.4 -- '*.go'` makes it look like ~35 Go
files diverge. **This is misleading.** A Phase 3 audit (2026-05-16) confirmed
the divergence falls into four buckets, only one of which needs hand-resolving:

**Bucket 1 — Truly Clustra-specific (~50 lines total, hand-resolve):**

- `server/clustra_pages_proxy.go` — **new file** (208 lines). Not a conflict
  surface at all; just take it as-is.
- `server/server.go` — **1 line** in `newHTTPServer`:
  `server.registerClustraPageProxies(mux)` after `mux.Handle("/api/", handler)`.
- `util/rbac/rbac.go` — **2 lines** registering the `clustra-pages` RBAC
  resource.
- `server/extension/extension.go` — **~45 lines** for Deploy Models extension
  wiring (from commit `2dea601ac Ship Deploy Models GA experience`).

These are the only places that need careful manual conflict resolution.

**Bucket 2 — Cherry-picks already in `upstream/release-3.4` (collapse on merge):**

Several PRs were cherry-picked into our `main` and are also present in
`upstream/release-3.4` under different commit SHAs. Git's 3-way merge resolves
these cleanly because the underlying code is identical. Examples seen during
the Phase 3 audit (PR numbers, not exhaustive):

- #27002, #27229, #27390, #27402 → `controller/appcontroller.go`
- #26724, #26996 → `controller/hook.go`
- #26811 → `applicationset/controllers/applicationset_controller.go`
- #27115, #27476, #26793 → `server/server.go`

If a sync surfaces conflicts in these files but the conflict markers wrap
identical code, take either side.

**Bucket 3 — Cherry-picks NOT yet in `upstream/release-3.4` (we are ahead):**

We pulled some bug-fix PRs ahead of upstream's release-3.4. These resolve
themselves when upstream backports them. Until then, expect the diff to remain.

- #25759 → `util/glob/glob.go` (RBAC glob cache)
- #26594 → `util/webhook/webhook.go` (Bitbucket diffstat)
- #26642 → `applicationset/controllers/applicationset_controller.go` +
  `applicationset/utils/createOrUpdate.go` (appset concurrency)
- #27052 → `server/deeplinks/deeplinks.go` (URL validator)
- #26936 → `cmd/argocd/commands/app.go` (typo fix)

If upstream backports any of these, the conflict will be identical-code on both
sides — take either.

**Bucket 4 — Pure upstream-lag (zero Clustra changes):**

Files like `util/argo/resource_tracking.go`, `cmd/argocd/commands/app_test.go`,
and `controller/appcontroller_test.go` show large "diffs" but have **zero
commits unique to our `main`**. The diff is 100% upstream patches we haven't
absorbed yet. Take upstream's version unconditionally.

### Auto-resolved (via `.gitattributes`)

These pull upstream's version automatically (no conflict to resolve):

- `docs/snyk/**` — security scan reports, regenerated upstream
- `manifests/install*.yaml`, `manifests/ha/**`, `manifests/crds/*-crd.yaml`
- `assets/swagger.json`

If you need a Clustra-specific version of one of these, remove the
`merge=theirs` attribute and maintain by hand.

## Architecture: the `clustra/` plugin module

To keep upstream syncs cheap, all fork-specific UI registrations live in:

```
ui/src/app/clustra/
├── nav-items.ts      ← sidebar navigation data (full nav tree + feature items)
├── nav-groups.ts     ← sidebar grouping taxonomy + bucketing helpers
├── routes.ts         ← React Router route map for Clustra pages
├── feature-gates.ts  ← permission checks, dev-mode fallbacks
├── ClustraSidebar.tsx← full custom sidebar rendering
└── index.ts          ← single re-export surface
```

`app.tsx` and `sidebar/sidebar.tsx` import from `clustra/` instead of inlining
the data, which keeps their diff vs upstream minimal.

**When adding a new Clustra page:**
1. Add the page module under `ui/src/app/<feature>/`.
2. Register the route in `clustra/routes.ts`.
3. Add the nav item to `clustra/nav-items.ts` (and gate it in
   `clustra/feature-gates.ts` if it needs permission checks).
4. Place its path in the appropriate group in `clustra/nav-groups.ts`.

This pattern keeps `app.tsx` and `sidebar.tsx` untouched.

## When upstream changes the `Sidebar` interface

`clustra/ClustraSidebar.tsx` implements the rendering. If upstream changes the
`SidebarProps` shape or adds new responsibilities to the `Sidebar` component:

1. Look at `git log upstream/release-3.4 -- ui/src/app/sidebar/sidebar.tsx`.
2. Update `clustra/ClustraSidebar.tsx` to match the new contract.
3. The shim file `ui/src/app/sidebar/sidebar.tsx` should rarely need changes.

## Recovery / rollback

If a sync goes sideways:

```bash
# Restore main to the last good snapshot
git checkout main
git reset --hard clustra/snapshot-YYYY-MM-DD
git push origin main --force-with-lease   # only if main was pushed first
```
