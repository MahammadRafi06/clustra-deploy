# Clustra Deploy UI branding

This document explains how the Clustra Deploy brand is applied to the
forked argo-cd UI and where to make changes.

## Where brand colors live

**Single source of truth:** [`src/app/shared/brand-tokens.scss`](src/app/shared/brand-tokens.scss).

To change any brand color — edit this one file. All other SCSS files
consume the tokens via `@import`. The file contains nothing but SCSS
variable declarations (no rules, no side effects), so importing it is
free and can't cause conflicts.

**Global dark-theme overrides:** [`src/app/shared/clustra-theme.scss`](src/app/shared/clustra-theme.scss).
Imports brand-tokens and uses `!important` to re-skin argo-ui component
classes under `.theme-dark`. This is the override *layer*, not the
palette source — don't put new color constants here.

## Rules for writing new SCSS

1. **Never declare brand-color variables in component files.** Always
   `@import '../../shared/brand-tokens'` (adjust the relative path) and
   use `$brand-navy`, `$brand-emerald`, etc.
2. **Never write brand hex literals** (`#0a192f`, `#10b981`, `#d4af37`,
   etc.) in component files. Use the token. Exceptions: `#000` or `#fff`
   inside `rgba()` for shadows is fine.
3. **Semantic status colors** (`$brand-status-success`, `$brand-status-error`,
   `$brand-status-warning`, `$brand-status-info`) are separate from brand
   accents on purpose. Use them for health badges, sync states, etc.
   — so "success" can diverge from "emerald" in the future without
   having to hunt down every call site.
4. **Legacy aliases** (`$navy`, `$emerald`, `$clustra-navy`, ...) exist
   in brand-tokens.scss for backwards compatibility with pre-refactor
   code. New code should prefer `$brand-*`.

## Theme mode

Clustra Deploy is **dark-only**. The `.theme-light` / `.theme-dark`
class plumbing from upstream argo-cd is still in place, but:

- [`src/app/shared/utils.ts`](src/app/shared/utils.ts) — `useTheme`
  is a no-op shim that always returns `['dark']`.
- [`src/app/shared/components/layout/layout.tsx`](src/app/shared/components/layout/layout.tsx)
  — `document.body.style.background` is always `$brand-navy` (`#0a192f`).
- [`src/app/settings/components/appearance-list/appearance-list.tsx`](src/app/settings/components/appearance-list/appearance-list.tsx)
  — the theme selector has been removed. The page just shows a notice.

If you ever need to restore light mode, revert those three files and
add light-mode variants to the `.theme-dark &`-scoped blocks in the
component SCSS files that hardcode dark surface colors (sidebar bg,
login bg, filter panel, etc.).

## Upstream argo-cd tracking

This fork is based on argo-cd commit
[`8981a5b85`](https://github.com/argoproj/argo-cd/commit/8981a5b85).

### One-time setup

Ensure the `upstream` remote is wired up (only needs to be done once
per clone):

```sh
git remote add upstream https://github.com/argoproj/argo-cd.git
git fetch upstream
git remote -v   # sanity check — should list both origin and upstream
```

### Pulling upstream changes — full playbook

Run these steps from the repo root.

**1. Fetch upstream without touching your working tree.**

```sh
git fetch upstream
```

**2. Preview what's changed.**

```sh
# How many upstream commits are you behind?
git log --oneline HEAD..upstream/master | wc -l

# How many of those touch the UI?
git log --oneline HEAD..upstream/master -- ui/src | wc -l

# List the UI-relevant commits in chronological order
git log --oneline --reverse HEAD..upstream/master -- ui/src

# Show actual file-level churn in ui/src (adds/deletes/renames)
git diff --stat HEAD..upstream/master -- ui/src
```

If `--stat` shows a file from the "Files that intentionally diverge"
list below, **expect a conflict** on that file. Budget more time.

**3. Decide merge vs rebase.**

- **Rebase** (`git rebase upstream/master`) — preferred for *small*
  upstream changes (patch releases, handfuls of commits). Replays your
  commits on top of upstream one-by-one, keeps history linear, makes
  conflicts visible per-commit.
- **Merge** (`git merge upstream/master`) — preferred for *big*
  upstream changes (minor/major releases, hundreds of commits). Keeps
  your commits intact, produces a single merge commit, one consolidated
  conflict-resolution pass.

Rule of thumb: **<20 upstream commits → rebase. ≥20 → merge.** Also
always merge (never rebase) if your branch has already been pushed
and others may be tracking it.

**4. Create a working branch.** Do NOT do the merge/rebase on `main`
directly — if something goes wrong it's much easier to throw away
a branch than to unwind main.

```sh
git checkout -b upgrade/upstream-$(date +%Y-%m-%d)
```

**5. Run the merge or rebase.**

```sh
# Option A — rebase
git rebase upstream/master

# Option B — merge
git merge upstream/master
```

**6. Resolve conflicts** (see the "Conflict resolution playbook" below).
After resolving each file:

```sh
git add <file>
# If rebasing:
git rebase --continue
# If merging, just keep going until git status is clean.
```

If something goes badly wrong and you want to start over:

```sh
git rebase --abort       # if rebasing
git merge  --abort       # if merging
```

**7. Install and build.** Upstream may have bumped npm deps:

```sh
cd ui
yarn install
yarn build 2>&1 | tail -20
yarn lint  2>&1 | tail -30
```

Pre-existing lint errors (in `filter.tsx`, `sidebar.tsx`,
`application-create-panel.tsx`) are expected — see
[the refactor handoff](BRANDING.md#known-pre-existing-lint-noise) below.
Errors in *other* files are new and need fixing before you continue.

**8. Run the visual smoke test** (see "Visual smoke test" below).

**9. Merge the upgrade branch back to `main`.**

```sh
git checkout main
git merge upgrade/upstream-YYYY-MM-DD   # fast-forward if rebased
git push origin main
git branch -d upgrade/upstream-YYYY-MM-DD
```

**10. Trigger an ECR/GHCR image rebuild** via the manual
[.github/workflows/image.yaml](../.github/workflows/image.yaml)
workflow when you're ready to deploy.

### Conflict resolution playbook

For each file that conflicts, decide: "did upstream also change this,
or is it just my change sitting on top of a reorganized region?"

| File | What to do on conflict |
|---|---|
| `ui/src/app/shared/brand-tokens.scss` | **Impossible** — doesn't exist upstream. No conflicts ever. |
| `ui/src/app/shared/clustra-theme.scss` | **Impossible** — same, new file. |
| `ui/src/app/login/components/login.scss` | **Category C.** Read both diffs. The mesh-gradient + hero-card structure is ours. If upstream added new login features (SSO buttons, MFA prompts, etc.), splice them into our structure — don't revert. |
| `ui/src/app/applications/components/filter/filter.{scss,tsx}` | **Category C.** Our dropdown redesign completely replaces upstream's checkbox/radio layout. If upstream added a new *filter dimension* (e.g. a new column), add it to our dropdown list. If upstream rewrote the filter internals, you'll need to re-implement the dropdown on top of the new baseline. |
| `ui/src/app/sidebar/sidebar.{tsx,scss}` | **Category C.** Our sidebar has restructured nav, bottom-collapse, and brand chrome. Keep ours; splice in any new upstream nav items. |
| `ui/src/app/applications/components/applications-list/applications-list.tsx` | **Category C.** 100-line diff. Read carefully. |
| `ui/src/app/shared/components/paginate/paginate.{tsx,scss}` | **Category C.** |
| `ui/src/app/app.tsx` | **Category C.** Our routes + AI config integration. Keep ours; add any new upstream routes to the end of the Routes map. |
| `ui/src/app/shared/components/layout/layout.tsx` | **Category C.** Small but load-bearing (forces dark theme, body bg). |
| `ui/src/app/shared/utils.ts` | Our `useTheme` is a no-op shim. If upstream changed it (unlikely), keep our shim. |
| `ui/src/app/settings/components/appearance-list/appearance-list.tsx` | Our page is the "dark-only notice." Keep ours unless upstream added genuinely new appearance settings we want to expose. |
| Any SCSS file we tokenized in Tier 1/2 | **Category B.** Accept upstream, then re-apply `@import '../../shared/brand-tokens'` + re-replace any hex literals with tokens. Usually 1–2 minutes. |
| `ui/src/app/assets/favicon/*`, `ui/src/assets/images/*` (logos) | **Category A.** Keep ours (`git checkout --ours`). |

### Pulling argo-ui changes (separate from argo-cd)

`argo-ui` is a **separate npm git dependency**, not part of the
argo-cd merge. It doesn't move when you merge upstream argo-cd.

**Current pin** in [`ui/package.json`](package.json):

```json
"argo-ui": "git+https://github.com/argoproj/argo-ui.git#a1c32a45e83fdda4baafc7ca3105c3ead383f8ba"
```

To check if there's a newer version worth pulling:

```sh
git ls-remote https://github.com/argoproj/argo-ui.git HEAD
# Compare the returned SHA to the one in package.json
```

Or visit https://github.com/argoproj/argo-ui/commits/master to see
what's changed.

**To bump it:**

1. Update the SHA in `ui/package.json`.
2. `cd ui && yarn install` (updates yarn.lock).
3. **Full visual smoke test.** argo-ui shipping new CSS classes can
   silently break the `clustra-theme.scss` override layer — the new
   classes won't be re-skinned. You need to eyeball the whole app.
4. If something looks off: add a new override rule to `clustra-theme.scss`
   targeting the new argo-ui class. Do NOT edit argo-ui in `node_modules`.
5. Commit package.json + yarn.lock together in one commit titled
   `chore(ui): bump argo-ui to <SHA>`.

**Postinstall favicon hook.** [`ui/package.json`](package.json) has a
`postinstall` hook that re-copies our favicons into
`node_modules/argo-ui/src/assets/favicon/`. This exists because
argo-ui's webpack CopyPlugin would otherwise overwrite our favicons
in the build output. Do not remove it.

### When to pull upstream — cadence guidance

Don't mirror upstream blindly. Pull when you have a *reason*:

- **Security advisory** — subscribe to
  [argo-cd security advisories](https://github.com/argoproj/argo-cd/security/advisories)
  on GitHub. This is the one feed you should actually watch. CVE fixes
  are the primary reason to merge.
- **A specific upstream feature you want** — scan
  [release notes](https://github.com/argoproj/argo-cd/releases) for
  features relevant to your users. Most releases are ignorable.
- **Drift budget** — if you're > 6 months / > 500 commits behind,
  the per-release cost of catching up starts compounding. Schedule
  an upgrade sprint.

**Don't pull upstream just because it released.** Patch releases
that don't touch UI or security are pure merge-cost with no benefit.

### Visual smoke test (run after every upgrade)

1. `cd ui && yarn start` → open http://localhost:4000
2. **Login page** — mesh gradient background visible, emerald hero
   drop-shadow on logo, glass card centered.
3. **Sidebar** — navy-dark bg, brand logo with drop-shadow, emerald
   on active nav item, bottom collapse button works.
4. **Applications list** — tiles grid renders, filter dropdowns open,
   sort/page-size pills styled as branded rows, pagination at bottom.
5. **Application details** (click any app) — resource tree readable
   on navy bg, right-side details panel readable, tabs emerald on active.
6. **Pod logs viewer** (drill into a pod) — terminal chrome is
   cohesive navy/slate (NOT mixed `#333`/`#444`/`#555`). Copy buttons
   have correct status colors.
7. **Settings → Clusters** — help text link is emerald (not `#007bff`).
8. **Settings → Appearance** — shows "Clustra Deploy uses a dark-mode-only
   theme." No `<Select>` control.
9. **DevTools sanity checks:**
   - `document.body.style.background` → `'rgb(10, 25, 47)'` (= `#0a192f`)
   - Page source `<title>` → `"Clustra Deploy"` (or whatever's in `index.html`)
   - Favicon tab icon → Clustra shield, not Argo octopus

Any regression = revert the upgrade branch, investigate offline.

## Regular maintenance

### Dependabot PRs (daily)

Dependabot opens PRs for npm, Go, GitHub Actions, and Docker deps.
Review policy:

- **npm / yarn.lock patch bumps** — usually safe to merge after CI green.
- **npm minor/major bumps** — smoke-test before merging. Especially for
  anything touching React, webpack, sass, or eslint.
- **argo-ui bumps** — Dependabot typically does NOT touch git-dependency
  entries, so you shouldn't see these. If you do, handle via the
  "Pulling argo-ui changes" procedure above instead of just clicking merge.
- **Go / Docker / GitHub Actions** — server-side concerns; not covered
  by this doc.

### Branding health check (monthly)

Run a quick drift audit:

```sh
cd ui

# Should return only brand-tokens.scss lines
grep -rn "^\\\$\(navy\|emerald\|clustra-\)" src --include='*.scss'

# Should return only brand-tokens.scss hits
grep -rn "#\(0a192f\|112240\|020c1b\|10b981\|34d399\|059669\|d4af37\)" src --include='*.scss' -i
```

If either grep shows results outside `src/app/shared/brand-tokens.scss`,
someone added a new hardcoded hex or duplicate variable — fix it by
importing brand-tokens and using the token instead.

### Changing a brand color

1. Edit the value in [`src/app/shared/brand-tokens.scss`](src/app/shared/brand-tokens.scss).
2. `yarn build` (catches any typo that breaks SCSS compile).
3. Visual smoke test (the brand color probably shows up in 10+ places).
4. Commit as `refactor(ui): tweak <token-name> to <new-value>`.

### Known pre-existing lint noise

`yarn lint` currently reports ~15 errors in files **not touched** by
the branding refactor. These come from earlier commits (93b131d4e,
344b6da61) and are tracked separately:

- `application-create-panel.tsx` — TS2339 `metadata` type errors
- `filter.tsx` — unused imports, missing return-type annotations
- `sidebar.tsx` — unused destructure vars

Don't mistake these for new regressions. After any change, diff the
lint output against this baseline — only *new* errors are yours.

### Rolling back a bad upgrade

If an upstream merge ships and you need to revert:

```sh
# Find the merge commit
git log --oneline --merges | head -5

# Revert it (creates a new revert commit; preserves history)
git revert -m 1 <merge-sha>
git push origin main

# Rebuild the image
# → trigger .github/workflows/image.yaml manually
```

Do NOT `git reset --hard` on `main` — it rewrites published history
and breaks anyone else tracking the branch.

## Files that intentionally diverge from upstream (Category C)

These have structural redesigns (not just color tweaks) and will
conflict on upstream merges. Read both sides of the diff carefully;
never just "take theirs":

- `ui/src/app/login/components/login.scss` — mesh gradient + hero card
- `ui/src/app/applications/components/filter/filter.scss` — dropdown controls
- `ui/src/app/applications/components/filter/filter.tsx` — dropdown controls
- `ui/src/app/sidebar/sidebar.tsx` / `sidebar.scss` — bottom collapse, brand chrome
- `ui/src/app/applications/components/applications-list/applications-list.tsx`
- `ui/src/app/shared/components/paginate/paginate.tsx` / `paginate.scss`
- `ui/src/app/app.tsx` — routes + AI config integration
- `ui/src/app/shared/components/layout/layout.tsx` — forced dark mode
- `ui/src/app/shared/utils.ts` — `useTheme` shim
- `ui/src/app/settings/components/appearance-list/appearance-list.tsx` — dark-only notice

Everything else is either Category A ("keep ours") or Category B
("mechanical re-apply after accepting upstream").
