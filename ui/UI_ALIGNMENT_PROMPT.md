# Prompt: Align `deploy-models` and `model-cache` pages with stock ArgoCD UI

## Context

Repo: `/home/mahammad/clustra-deploy/ui` (a forked Argo CD UI, rebranded "Clustra Deploy").

Two pages in this fork were built from scratch and **look dramatically different from every other ArgoCD page** in the app:

- [src/app/deploy-models/](src/app/deploy-models/) — root class `.clustra-ext`, styles in [src/app/deploy-models/styles.scss](src/app/deploy-models/styles.scss) (1,058 lines)
- [src/app/model-cache/](src/app/model-cache/) — root class `.model-cache`, styles in [src/app/model-cache/styles/model-cache.scss](src/app/model-cache/styles/model-cache.scss) (658 lines) plus heavy inline `React.CSSProperties` inside every component

Stock pages to mirror:
- [src/app/applications/components/applications-list/applications-list.tsx](src/app/applications/components/applications-list/applications-list.tsx)
- [src/app/settings/components/settings-overview/settings-overview.tsx](src/app/settings/components/settings-overview/settings-overview.tsx)
- [src/app/settings/components/repos-list/repos-list.tsx](src/app/settings/components/repos-list/repos-list.tsx)
- [src/app/settings/components/clusters-list/clusters-list.tsx](src/app/settings/components/clusters-list/clusters-list.tsx)

The design system is in:
- [src/app/shared/brand-tokens.scss](src/app/shared/brand-tokens.scss) — SCSS `$brand-*` tokens
- [src/app/shared/clustra-theme.scss](src/app/shared/clustra-theme.scss) — global `.theme-dark` overrides for `argo-*`, `white-box`, `argo-table-list`, `argo-button`, `argo-field`, `sliding-panel`, etc.
- [src/app/shared/components/page/page.tsx](src/app/shared/components/page/page.tsx) — the `<Page>` wrapper everyone else uses
- [BRANDING.md](BRANDING.md) — the visual smoke-test checklist

**Root cause of the mismatch:** both custom pages reinvented the page chrome instead of consuming the existing primitives. They bypass `.theme-dark` by namespacing into `.clustra-ext` / `.model-cache`, redefine tokens as CSS custom properties, drop in a custom hero banner, use `Inter` as a forced font-family, use 12–22 px border-radius vs. ArgoCD's 3–4 px, use 18–26 px shadow blur vs. ArgoCD's 2–4 px, and build custom `.cext-*` / `.model-cache-*` classes for every button / input / table / badge instead of reusing `argo-button`, `argo-field`, `argo-table-list`, `white-box`, `Paginate`, `SlidingPanel`, etc. `model-cache` also picks a **blue** accent (`$brand-status-info` `#58a6fe`) while the rest of the app is emerald (`$brand-emerald` `#10b981`).

## Goal

Make both pages **visually indistinguishable, at the chrome level, from the other ArgoCD pages** in this fork — same wrapper, same toolbar pattern, same typography scale, same card/table/button/field classes, same accent color — while keeping the page-specific feature UI (task selector, health cards, model table, jobs drawer, etc.) intact.

Do **not** redesign the features. Only re-skin/re-plumb the containers, typography, colors, and primitive components.

## Rules

### R1 — Use the stock `<Page>` toolbar, not a hero banner

Both pages already wrap in `<Page>` at [src/app/deploy-models/index.tsx:15](src/app/deploy-models/index.tsx#L15) and [src/app/model-cache/index.tsx:15](src/app/model-cache/index.tsx#L15) — good. But they ignore its `toolbar` prop and instead render a gradient hero (`.cext-header--hero` at [src/app/deploy-models/App.tsx](src/app/deploy-models/App.tsx), `.model-cache-hero` at [src/app/model-cache/pages/ModelCachePage.tsx:340-361](src/app/model-cache/pages/ModelCachePage.tsx#L340-L361)).

**Do:** pass `toolbar={{breadcrumbs: [{title: '<Page Name>'}]}}` to `<Page>` (see [settings-overview.tsx:48](src/app/settings/components/settings-overview/settings-overview.tsx#L48) for the pattern), and for pages that need a second action bar follow the `FlexTopBar` pattern in [applications-list.tsx:403-440](src/app/applications/components/applications-list/applications-list.tsx#L403-L440).

**Delete:** `.cext-header`, `.cext-header--hero`, `.cext-header__eyebrow`, `.cext-header__title`, `.cext-header__subtitle`, `.cext-header__aside`, `.cext-header__hint`, and their entire block in `styles.scss`; `.model-cache-hero*` and its block in `model-cache.scss`. No gradient banners, no oversized titles, no "eyebrow" strapline — ArgoCD pages don't have these.

### R2 — Drop the custom root classes; rely on global `.theme-dark`

The reason these pages look "off" is they set `.clustra-ext` / `.model-cache` and then redeclare everything inside that scope as CSS custom properties (`--brand-*`, `--mc-*`), which causes them to miss the ~260 lines of `argo-*` / `white-box` / `sliding-panel` dark overrides in [clustra-theme.scss](src/app/shared/clustra-theme.scss).

**Do:**
- Replace `.clustra-ext` root with `<div className='deploy-models'>` and scope page-specific styles under `.deploy-models` using ArgoCD conventions: `.deploy-models__filters`, `.deploy-models__task-grid`, etc. (mirror [applications-list.scss](src/app/applications/components/applications-list/applications-list.scss)).
- Replace `.model-cache` root with `<div className='model-cache'>` but **only** use it for page-local BEM like `.model-cache__catalog`, not as a token isolation scope.
- Remove all `--brand-*` and `--mc-*` CSS custom-property blocks (lines 1–73 of `styles.scss`, lines 4–52 of `model-cache.scss`). Use the existing SCSS variables (`$brand-navy`, `$brand-emerald`, `$brand-text-primary`, etc.) directly — they're already imported via `@import '../../shared/brand-tokens';`.

### R3 — Use `argo-*` classes for every primitive

Replace custom classes one-for-one with existing ArgoCD primitives. The stock `.theme-dark` styling will then take over automatically:

| Custom (remove) | Stock (use) | Reference |
|---|---|---|
| `.cext-btn`, `.cext-link-btn`, inline `backgroundColor: '--mc-accent'` buttons in `BulkActionBar`, `FilterToolbar`, `DownloadModelModal`, `ConfirmDialog`, `CreatePresetModal` | `argo-button argo-button--base` (primary) / `argo-button argo-button--base-o` (outline) | [clustra-theme.scss:88-140](src/app/shared/clustra-theme.scss#L88-L140) |
| `.cext-input`, `.cext-select`, `.cext-textarea`, `.cext-argo-select`, `.model-cache-input`, `.model-cache-argo-select` | `argo-field`, argo-ui `<FormField>` / `<FormSelect>` / `<Text>` / `<TextArea>` | [repos-list.tsx:2](src/app/settings/components/repos-list/repos-list.tsx#L2) |
| `.cext-panel`, `.model-cache-panel`, `.cext-sidecard`, `.model-cache-sidecard` | `white-box` + `white-box__details` / `white-box__details-row` | [clustra-theme.scss](src/app/shared/clustra-theme.scss) search `white-box` |
| Custom `<table>` with inline `React.CSSProperties` in [ModelCatalogTable.tsx](src/app/model-cache/components/ModelCatalogTable.tsx) | `argo-table-list argo-table-list--clickable` with `.argo-table-list__head` / `.argo-table-list__row` + `.row` / `.columns small-N` grid — see [repos-list.tsx](src/app/settings/components/repos-list/repos-list.tsx) |
| Custom inline-styled modals: `DownloadModelModal`, `ConfirmDialog`, `JobLogViewer`, `CreatePresetModal` (`overlayStyle`/`modalStyle` with `position: fixed; backgroundColor: rgba(0,0,0,0.5)`) | `SlidingPanel` from `argo-ui` (for side drawers) or argo-ui modal | `ModelDetailDrawer` / `JobsPanel` / `PresetsPanel` already do this correctly |
| `.cext-notice`, `.cext-error`, `.model-cache-inline-alert`, `ErrorBanner` inline | argo-ui `ErrorNotification` + `NotificationType` (already imported in `ErrorAlert.tsx`) |
| `.cext-badge`, `.model-cache-badge`, inline `StatusBadge`, `labelBadgeStyle` | `application-status-icon` / existing status conventions; or extract a single shared `<StatusBadge>` in [src/app/shared/components/](src/app/shared/components/) |
| Custom pagination in `ModelCatalogTable` | `<Paginate preferencesKey='model-cache' data={...}>` — pattern in [applications-list.tsx](src/app/applications/components/applications-list/applications-list.tsx) |
| `.cext-radio-group`, `.cext-radio-label` | argo-ui `<FormField component={Text}>` / native with `argo-form-row` |

### R4 — Delete every `style={{ ... }}` from `model-cache` components

Grep confirms the bulk of the `model-cache` visual divergence is **inline** React styles, which won't be themed at all:

- [BulkActionBar.tsx](src/app/model-cache/components/BulkActionBar.tsx) — `barStyle`, `btnStyle`
- [FilterToolbar.tsx](src/app/model-cache/components/FilterToolbar.tsx) — `toolbarStyle`, `inputStyle`, `btnStyle`, `primaryBtnStyle`
- [ModelCatalogTable.tsx](src/app/model-cache/components/ModelCatalogTable.tsx) — `tableStyle`, `headerRowStyle`, `thStyle`, `tdStyle`, `labelBadgeStyle`, `updateBadgeStyle`, `duplicateBadgeStyle`, pagination `btnStyle`
- [ModelDetailDrawer.tsx](src/app/model-cache/components/ModelDetailDrawer.tsx) — section/metadata grid/action button styles
- [JobsPanel.tsx](src/app/model-cache/components/JobsPanel.tsx) — `jobCardStyle`, footer
- [HealthSummaryCards.tsx](src/app/model-cache/components/HealthSummaryCards.tsx) — `containerStyle`, `cardStyle`, `labelStyle`, `valueStyle`
- [StoragePressureBanner.tsx](src/app/model-cache/components/StoragePressureBanner.tsx) — `bannerStyle`
- [DownloadModelModal.tsx](src/app/model-cache/components/DownloadModelModal.tsx), [JobLogViewer.tsx](src/app/model-cache/components/JobLogViewer.tsx), [common/ConfirmDialog.tsx](src/app/model-cache/components/common/ConfirmDialog.tsx), [common/ErrorBanner.tsx](src/app/model-cache/components/common/ErrorBanner.tsx), [common/EmptyState.tsx](src/app/model-cache/components/common/EmptyState.tsx), [common/StatusBadge.tsx](src/app/model-cache/components/common/StatusBadge.tsx), [AuditTimeline.tsx](src/app/model-cache/components/AuditTimeline.tsx) — all inline

Rule: **no component in [src/app/model-cache/components/](src/app/model-cache/components/) should contain a `style={{` that sets color, background, border, padding, or border-radius.** Move the few justified ones (dynamic widths, grid column counts, progress bars) to either an SCSS class or inline attribute only for truly dynamic values. Do a `grep -n "style={{" src/app/model-cache` pass — final count should be near zero, matching [src/app/applications/components/](src/app/applications/components/).

### R5 — Kill the rogue accent color on model-cache

`model-cache.scss` defines `--mc-accent` from `$brand-status-info` (blue `#58a6fe`). The rest of the fork uses `$brand-emerald` (`#10b981`) as the primary accent (see [clustra-theme.scss](src/app/shared/clustra-theme.scss) — every `argo-button--base`, tab underline, link, `sidebar__nav-item--active`, `filter__selected`, etc. is emerald).

**Do:** replace every occurrence of `--mc-accent` / `--mc-accent-*` / `#58a6fe` with `$brand-emerald` / `$brand-emerald-light` / `$brand-emerald-dark`. Blue is reserved for `status-info` toast/alert usage only.

### R6 — Typography & scale: match stock

- **Font-family:** remove `font-family: 'Inter', system-ui, sans-serif` from [styles.scss:79](src/app/deploy-models/styles.scss#L79). Stock pages inherit the default argo-ui font stack; overriding only on these two pages is half the reason they look alien.
- **Border-radius:** stock pages use **3–4 px** (buttons, inputs, white-box); drop all `14px`, `18px`, `20px`, `22px`, `999px`-on-badges radii in both custom stylesheets. Pills allowed only for actual pill contexts that already exist in ArgoCD (e.g. `filter__selected`).
- **Shadows:** stock uses `1px 2px 3px rgba(0,0,0,.1)` (see [settings-overview.scss:19](src/app/settings/components/settings-overview/settings-overview.scss#L19)). Remove `0 18px 38px` / `0 26px 60px` dramatic drop-shadows.
- **Spacing:** pages use `1em` / `18px 0` / `padding: 20px` units (see `.settings-overview__redirect-panel`). Don't introduce a parallel 4/6/8/10/12/14/16/18 ladder inside these pages only.
- **Headings:** page title lives in `<Page title=...>`, not in an in-body `<h1>` with 22–30 px bold. Panel subtitles should be ~0.8125em secondary text like `.settings-overview__redirect-panel__description` ([settings-overview.scss:49-53](src/app/settings/components/settings-overview/settings-overview.scss#L49-L53)).

### R7 — Layout: single-column with optional `FlexTopBar`, not two-column workspace + sticky rail

Both pages use a 2-column `minmax(0, 1fr) 320px` grid with a sticky right sidebar (`.cext-rail--side`, `.model-cache-rail`). **No other page in the repo does this.** Stock ArgoCD is single column under the fixed top bar; "sidecard" content (your "How This Flows", "Operational Runbook" hints) either belongs in an `argo-tooltip`/`HelpIcon`, a `SlidingPanel` opened by an action button, or a collapsed `<Expandable>` info block — **not** a permanent right rail.

**Do:** collapse the workspace to a single column, move rail content into either inline notes, `<HelpIcon>` popovers, or a `SlidingPanel` triggered by an action in the `FlexTopBar`.

### R8 — Form layout

The `.cext-form` 2-column CSS grid in [styles.scss](src/app/deploy-models/styles.scss) does not match how ArgoCD forms look. Use the `react-form` + `FormField` + `.argo-form-row` patterns from [repos-list.tsx](src/app/settings/components/repos-list/repos-list.tsx) (e.g. how repos connection form is built). `<AdvancedSection>` can stay as a disclosure, but render its content in the same form-row style as the required fields above.

### R9 — Leave page behavior alone

Keep all current:
- API contracts in [src/app/deploy-models/api.ts](src/app/deploy-models/api.ts) and [src/app/model-cache/api/](src/app/model-cache/api/)
- Hooks: `useFormState`, `useJobPoller`, `useModels`, `useJobs`, `useHealth`
- Task selector logic, preflight advisory, bulk actions, presets, audit timeline — **functionality unchanged**

Only the **visual shell, typography, color, and primitive classes** change.

## Concrete deliverables

1. **[src/app/deploy-models/index.tsx](src/app/deploy-models/index.tsx)** — pass `toolbar={{breadcrumbs: [{title: 'Deploy Models'}]}}`.
2. **[src/app/deploy-models/App.tsx](src/app/deploy-models/App.tsx)** — remove hero banner; remove right rail; replace root `.clustra-ext` with `.deploy-models`; route task selection above a single-column `.argo-container`.
3. **[src/app/deploy-models/styles.scss](src/app/deploy-models/styles.scss)** — shrink from ~1,058 lines to <200. Remove all `--brand-*` re-declarations, all gradient backgrounds, all `font-family: Inter`, all oversized radii/shadows. Keep only page-specific layout under a single `.deploy-models` BEM namespace.
4. **[src/app/deploy-models/components/*.tsx](src/app/deploy-models/components/)** — rewrite `FieldInput`, `AdvancedSection`, `TaskSelector`, `JobStatusBanner`, `JobResultView`, `ErrorAlert`, `NoticeAlert`, `AppNameBadge` to emit `argo-*` / `white-box` / argo-ui components. Delete `EndpointForm.tsx` if unused.
5. **[src/app/model-cache/index.tsx](src/app/model-cache/index.tsx)** — pass `toolbar={{breadcrumbs: [{title: 'Model Cache'}]}}`.
6. **[src/app/model-cache/pages/ModelCachePage.tsx](src/app/model-cache/pages/ModelCachePage.tsx)** — remove hero, remove 2-col `.model-cache-layout` with `.model-cache-rail`; wrap catalog in `<Paginate>` + `argo-table-list`; use `<SlidingPanel>` for all drawers/modals.
7. **[src/app/model-cache/styles/model-cache.scss](src/app/model-cache/styles/model-cache.scss)** — shrink from 658 lines to <200. Remove every `--mc-*` variable, every gradient, every `0 26px 60px` shadow, every `22px` radius. No `$brand-status-info` as primary accent. Replace accent references with `$brand-emerald`.
8. **[src/app/model-cache/components/](src/app/model-cache/components/)** — eliminate inline `React.CSSProperties` objects. Rebuild `FilterToolbar` around `argo-field` + argo-ui `<Select>` (un-wrapped); `BulkActionBar` around `argo-button argo-button--base` / `--base-o`; `ModelCatalogTable` around `argo-table-list` + `Paginate`; `HealthSummaryCards` around `white-box` / `applications-summary` style grid; every modal around `SlidingPanel`.

## Acceptance criteria

Verify each of these before submitting:

- [ ] `grep -rn "cext-" src/app/deploy-models` returns **0 results** (namespace fully removed).
- [ ] `grep -rn "model-cache-" src/app/model-cache` returns results only for the single `.model-cache` root BEM wrapper + legitimate page-local BEM like `.model-cache__catalog` — no `--mc-*`, no `.model-cache-hero`, no `.model-cache-panel`.
- [ ] `grep -rn "style={{" src/app/model-cache src/app/deploy-models` returns **no color, background, border, padding, or border-radius** inline styles.
- [ ] `grep -rn "Inter" src/app/deploy-models src/app/model-cache` returns **0**.
- [ ] Every `<button>` in either directory uses `argo-button argo-button--base` or `argo-button argo-button--base-o`.
- [ ] Every `<input>` / `<textarea>` / `<select>` uses `argo-field` (or argo-ui `<FormField>` / `<FormSelect>`).
- [ ] The "Model Cache" catalog renders as an `argo-table-list` with `.row` / `.columns small-N` columns, identical feel to repos-list.
- [ ] Primary accent in hover/focus/active states on both pages is **emerald** (`$brand-emerald` `#10b981`), matching [applications-list.scss](src/app/applications/components/applications-list/applications-list.scss) and the sidebar.
- [ ] Both pages' `toolbar` shows a proper breadcrumb row — identical top-bar chrome as `/settings`, `/applications`, `/settings/repos`.
- [ ] Run `yarn start` or equivalent; side-by-side screenshots of `/applications`, `/settings/repos`, `/deploy-models`, `/model-cache` should be indistinguishable in **chrome, typography, button shape, table shape, field shape, accent color, shadow depth, border-radius**. Only the feature-specific body content differs.
- [ ] `BRANDING.md` visual smoke tests still pass: body bg `rgb(10,25,47)`, emerald active sidebar item, emerald links, no `#007bff`, no mixed `#333/#444` grays, no stray light-theme artifacts.

## What to leave untouched

- Server APIs, hooks, job polling, preflight logic, compatibility advisory, bulk-action state machine, preset CRUD, audit timeline data — all feature behavior.
- [src/app/shared/brand-tokens.scss](src/app/shared/brand-tokens.scss), [src/app/shared/clustra-theme.scss](src/app/shared/clustra-theme.scss) — these are the source of truth; don't add or mutate tokens to accommodate the custom pages.
- The rest of the fork (`applications/`, `settings/`, `sidebar/`, `login/`, `user-info/`, `ui-banner/`).

---

## Quick summary of what's wrong today (for reviewers)

| Dimension | Stock ArgoCD | `deploy-models` today | `model-cache` today |
|---|---|---|---|
| Root wrapper | `<Page toolbar={{breadcrumbs}}>` with `argo-container` | `<Page>` (no toolbar) + `.clustra-ext` gradient hero | `<Page>` (no toolbar) + `.model-cache` gradient hero |
| Layout | single column | 2-col workspace + sticky `.cext-rail` | 2-col workspace + sticky `.model-cache-rail` |
| Tokens | SCSS `$brand-*` from shared | redeclared as `--brand-*` CSS vars | redeclared as `--mc-*` CSS vars |
| Buttons | `argo-button argo-button--base` | `.argo-button .cext-btn` hybrid | mostly inline `style={{...}}` |
| Inputs | `argo-field` | `.cext-input` / `.cext-argo-select` | `.model-cache-input` + inline |
| Tables | `argo-table-list` + `Paginate` | N/A | custom inline `<table>` + custom pagination |
| Modals | `SlidingPanel` | inline none | drawers use `SlidingPanel` ✓, but all other modals are hand-rolled fixed overlays |
| Font | argo-ui default | **Inter** override | **Inter** (inherited) |
| Radius | 3–4 px | 4–18 px | 12–22 px |
| Shadow blur | 2–4 px | 18–38 px | 26–60 px |
| Accent | **emerald** `#10b981` | emerald ✓ | **blue** `#58a6fe` ✗ |
| Dark-theme overrides | inherit from `.theme-dark` | bypass via `.clustra-ext` scope | bypass via `.model-cache` scope |

Expect the fix to delete roughly **900 lines from `styles.scss`**, **500 lines from `model-cache.scss`**, and **~400 lines of inline styles from `model-cache/components/*.tsx`**, with a net reduction in LOC.

---

# Revision 2 — Final-mile alignment prompt

## Status of Revision 1

Revision 1 landed well. Verified on the current working tree:

**`deploy-models/` (clean pass on R1–R7, R9):**
- [src/app/deploy-models/index.tsx:15](src/app/deploy-models/index.tsx#L15) passes `toolbar={{breadcrumbs: [{title: 'Deploy Models'}]}}`.
- Root class is now `.deploy-models` in [src/app/deploy-models/App.tsx:52](src/app/deploy-models/App.tsx#L52). No `.clustra-ext`.
- [src/app/deploy-models/styles.scss](src/app/deploy-models/styles.scss) is now **404 lines** (was 1,058). No `--brand-*` / `--cext-*` re-declarations, no `Inter`, no gradients, no heroes.
- `grep -rn "cext-"` on the folder → **0**.
- `grep -rn "style={{"` → **0**.
- All primitives are `argo-button argo-button--base` / `--base-o`, `argo-field`, `argo-form-row`, `argo-container`, `white-box`.
- Layout is single column. Border-radius 4 px. No dramatic shadows. Emerald accent.

**`model-cache/` (clean pass on R1, R2, R3 structural, R5, R6, R7, R9):**
- [src/app/model-cache/index.tsx:15](src/app/model-cache/index.tsx#L15) passes `toolbar={{breadcrumbs: [{title: 'Model Cache'}]}}`.
- Root class is `.model-cache` used only as a page-local BEM namespace in [src/app/model-cache/pages/ModelCachePage.tsx:298](src/app/model-cache/pages/ModelCachePage.tsx#L298).
- [src/app/model-cache/styles/model-cache.scss](src/app/model-cache/styles/model-cache.scss) is **548 lines** (was 658). No `--mc-*` custom properties.
- `grep -rn "#58a6fe\|brand-status-info"` → **0**. Blue accent is gone.
- Catalog is now `argo-table-list argo-table-list--clickable` with `.row` / `.columns small-N` ([ModelCatalogTable.tsx:62-75](src/app/model-cache/components/ModelCatalogTable.tsx#L62-L75)).
- All six drawer/modal components (`ModelDetailDrawer`, `JobsPanel`, `PresetsPanel`, `DownloadModelModal`, `ConfirmDialog`, `JobLogViewer`) now use `SlidingPanel` from `argo-ui`.
- `grep -rn "style={{"` → **1 hit**, in [HealthSummaryCards.tsx:62](src/app/model-cache/components/HealthSummaryCards.tsx#L62) for a progress-bar width — legitimate dynamic value. Keep it.

## What's still drifting — fix these in Revision 2

The pages look close to stock now, but a handful of small, visible gaps remain. Each item below is a concrete swap that brings the pages onto the same patterns `applications/` and `settings/` use. Treat this as a polish pass, not a redesign.

### R10 — Swap custom pagination for `<Paginate>`

[ModelCatalogTable.tsx:127-142](src/app/model-cache/components/ModelCatalogTable.tsx#L127-L142) still renders a hand-rolled `Prev` / `page / totalPages` / `Next` footer. Stock ArgoCD uses the shared `<Paginate>` component — see how [applications-list.tsx](src/app/applications/components/applications-list/applications-list.tsx) wraps its list with it.

**Do:**
- `import {Paginate} from '../../shared/components';`
- Wrap the catalog rows in `<Paginate preferencesKey='model-cache-catalog' data={modelsData?.items || []}>{page => ...}</Paginate>`.
- Delete `.model-cache__pagination`, `.model-cache__pagination-label`, `.model-cache__table-footer` from [styles/model-cache.scss:236-240](src/app/model-cache/styles/model-cache.scss#L236-L240) and their usages.
- Lift the page size to Paginate's preferences hook and drop the local `page`/`setPage` state.
- Keep server-side paging (model cache is paginated on the API), but feed Paginate only the rendered subset — or wrap Paginate in client-only mode and let the API page param map to Paginate's pageNumber. Choose the simpler shape; don't regress behavior.

### R11 — Swap custom empty states for the shared `<EmptyState>` component

Both pages still render hand-rolled empty states:
- [deploy-models/App.tsx:96-108](src/app/deploy-models/App.tsx#L96-L108) — `.deploy-models__empty-state` / `__empty-icon` / `__empty-title` / `__empty-description`
- [model-cache/components/common/EmptyState.tsx](src/app/model-cache/components/common/EmptyState.tsx) — page-local copy
- [ModelCatalogTable.tsx:57](src/app/model-cache/components/ModelCatalogTable.tsx#L57) — calls the local EmptyState

There is already a shared component at [src/app/shared/components/empty-state/](src/app/shared/components/empty-state/) exported from [src/app/shared/components/index.ts](src/app/shared/components/index.ts).

**Do:**
- Replace the in-body empty states with `import {EmptyState} from '../../shared/components';` and the `<EmptyState icon='fa-...' ...>` shape used by stock pages.
- Delete [src/app/model-cache/components/common/EmptyState.tsx](src/app/model-cache/components/common/EmptyState.tsx).
- Remove `.deploy-models__empty-state*` and `.model-cache__empty-state*` rules from both SCSS files.

### R12 — Swap custom spinner for the shared `<Spinner>`

[styles.scss:373-384](src/app/deploy-models/styles.scss#L373-L384) defines `.deploy-models__spinner` + a `@keyframes deploy-models-spin` block. [src/app/shared/components/spinner.tsx](src/app/shared/components/spinner.tsx) already exists and is exported from [src/app/shared/components/index.ts](src/app/shared/components/index.ts).

**Do:**
- In [JobStatusBanner.tsx](src/app/deploy-models/components/JobStatusBanner.tsx) and anywhere else `.deploy-models__spinner` is rendered, import and use `<Spinner>` from shared.
- Delete the `.deploy-models__spinner` rules and `@keyframes deploy-models-spin`.

### R13 — Use `argo-form-row__error-msg`, not custom error classes

Stock error spans under form fields use `.argo-form-row__error-msg` (referenced in [FieldInput.tsx](src/app/deploy-models/components/FieldInput.tsx) already — keep it). But inline banners still have custom classes that duplicate it:

- `.deploy-models__field-error`, `.deploy-models__error`, `.deploy-models__error--flush` in [styles.scss:135-137, 238-246](src/app/deploy-models/styles.scss#L135-L246)
- `.model-cache__inline-error` in [styles/model-cache.scss:428-431](src/app/model-cache/styles/model-cache.scss#L428-L431)

**Do:**
- Row-scoped validation errors → `<div className='argo-form-row__error-msg'>`.
- Page-level error banners → `<ErrorNotification>` from `argo-ui` (already imported through `ErrorAlert.tsx`).
- Delete the duplicate `.model-cache__inline-error` / `.deploy-models__field-error` / `.deploy-models__error` rules.

### R14 — Drop `!important` flags; solve specificity properly

Four `!important` overrides remain:

- [deploy-models/styles.scss:316-317](src/app/deploy-models/styles.scss#L316-L317) — `.deploy-models__danger-button` forces color + shadow over `.argo-button--base-o`
- [model-cache/styles/model-cache.scss:331-338](src/app/model-cache/styles/model-cache.scss#L331-L338) — `&__button--warning`, `&__button--danger` likewise

**Do:** raise specificity instead. Apply the variant classes on the same element that has `.argo-button.argo-button--base-o`, and write the rule as `.argo-button.argo-button--base-o.model-cache__button--danger { ... }` (no `!important`). If specificity still loses, the right fix is an argo-button outline-red variant in [shared/clustra-theme.scss](src/app/shared/clustra-theme.scss) — match the existing pattern for `.argo-button--base-o`.

### R15 — Consolidate the status badge / chip

Three overlapping constructs exist in `model-cache/`:

- [common/StatusBadge.tsx](src/app/model-cache/components/common/StatusBadge.tsx) — reusable status pill
- `.model-cache__chip` + `.model-cache__chip--{success|warning|danger|accent|muted|violet}` in [styles/model-cache.scss:242-317](src/app/model-cache/styles/model-cache.scss#L242-L317)
- `.model-cache__status-badge--{success|warning|danger|accent|muted}` — same SCSS block

They share identical backgrounds/colors but are applied inconsistently (e.g. `.model-cache__chip` in [ModelCatalogTable.tsx:99-100](src/app/model-cache/components/ModelCatalogTable.tsx#L99-L100), `StatusBadge` in [ModelCatalogTable.tsx:106](src/app/model-cache/components/ModelCatalogTable.tsx#L106)).

**Do:** pick one. Extend `<StatusBadge>` to cover the chip use cases (add `kind`/`accent`/`violet`/`muted` tones) and route everything through it. Collapse `.model-cache__status-badge*` + `.model-cache__chip*` into a single rule block.

### R16 — Align panel heading color with stock settings pattern

Stock settings uses teal on panel titles via `themify()`:

```scss
// settings-overview.scss
&__title { font-size: 1.2em; color: $argo-color-teal-6; }
```

Which the dark theme repaints via [clustra-theme.scss](src/app/shared/clustra-theme.scss). The custom pages currently hard-code emerald-light:

- [deploy-models/styles.scss:35](src/app/deploy-models/styles.scss#L35) — `&__panel-title { color: $brand-emerald-light; }`
- [model-cache/styles/model-cache.scss:83, 132, 298, 434](src/app/model-cache/styles/model-cache.scss) — same treatment on section titles, health values, inline banners

Emerald-light on panel titles is louder than any other page in the app. Titles in `applications-list`, `settings-overview`, `repos-list` are plain primary text; only tabs/links/active-nav use emerald.

**Do:**
- Remove the `color: $brand-emerald-light;` declarations on `.deploy-models__panel-title`, `.model-cache__section-title`, `.model-cache__section-header`, `.model-cache__drawer-subtitle`.
- Let titles inherit `$brand-text-primary` like every other page.
- Keep emerald-light only on interactive accents (active tab, selected filter chip, link hover) where the rest of the app already puts it.

### R17 — Use `themify($themes)` for theme-aware surfaces

Reference pattern — [settings-overview.scss:14-17](src/app/settings/components/settings-overview/settings-overview.scss#L14-L17):
```scss
@include themify($themes) {
    background-color: themed('background-2');
    color: themed('text-2');
}
```

Currently `.deploy-models` and `.model-cache` hard-read `$brand-*` SCSS variables. That works because [clustra-theme.scss](src/app/shared/clustra-theme.scss) sets the dark theme globally, but it means the pages break if the fork ever re-enables light mode (mentioned as a branded-only dark fork in [BRANDING.md](BRANDING.md), but the rest of the settings stylesheets still go through `themify()`).

**Do:**
- At the top of both stylesheets, `@import 'node_modules/argo-ui/src/styles/config'; @import 'node_modules/argo-ui/src/styles/theme';` (this is how [repos-list.scss:1-2](src/app/settings/components/repos-list/repos-list.scss#L1-L2) and [settings-overview.scss:1-2](src/app/settings/components/settings-overview/settings-overview.scss#L1-L2) do it).
- Wrap rules that set colour/background in `@include themify($themes) { ... themed('...') ... }` — particularly hover states, selected row background, and any panel-level `background:` that differs from the default `white-box` background.
- `rgba($brand-emerald, 0.06)` style accents can stay as-is (they're alpha overlays that work on any theme).

### R18 — Remove the rogue `border-radius: 999px`

One pill remains: [model-cache/styles/model-cache.scss:138](src/app/model-cache/styles/model-cache.scss#L138) on `.model-cache__progress` track. Stock ArgoCD progress bars (see [applications-status-bar.scss](src/app/applications/components/applications-list/applications-status-bar.scss)) use 2–4 px radius.

**Do:** change `border-radius: 999px` → `border-radius: 4px` on both the track and any `__progress-fill` rule.

### R19 — Register the two pages in the sidebar nav consistently with other entries

[src/app/sidebar/](src/app/sidebar/) holds the nav registration. Verify:
- Both pages have an entry under the same sidebar section as existing entries (Applications, Settings).
- Icon sizing, padding, and active-state indicator (emerald left-border / emerald icon) match what the sidebar already does for Applications — no bespoke styling.
- Active nav item on `/deploy-models` and `/model-cache` must show the same emerald left border + emerald icon color defined in [clustra-theme.scss](src/app/shared/clustra-theme.scss) `.sidebar__nav-item--active` / `.sidebar__subnav-item--active`.

### R20 — Migrate forms to `react-form` + `FormField` (optional but recommended)

Both pages still manage form state by hand:
- [deploy-models/hooks/useFormState.ts](src/app/deploy-models/hooks/useFormState.ts) + native `<input>` / `<textarea>` / argo-ui `<Select>` in [FieldInput.tsx](src/app/deploy-models/components/FieldInput.tsx)
- [DownloadModelModal.tsx](src/app/model-cache/components/DownloadModelModal.tsx) uses `useState` + native inputs

Visually this is already correct (uses `argo-form-row` + `argo-field`). But stock pages like [repos-list.tsx:2](src/app/settings/components/repos-list/repos-list.tsx#L2) and cluster/project forms all go through `react-form`'s `<Form>`, `<FormField>`, `<Text>`, `<TextArea>`, `<FormSelect>`.

**Do (only if schedule allows, not blocking):**
- Wrap each page's form in `<Form onSubmit={...}>{formApi => ...}</Form>`.
- Replace `<input className='argo-field' value=... onChange=...>` with `<FormField field='repo_id' component={Text} componentProps={{className: 'argo-field'}}>`.
- Delete `useFormState` and route state through `FormApi`.
- Keep custom validation logic (preflight advisory, disagg-mode conditional fields) in a `validateError` handler — same shape repos-list uses.

If the team skips this, the form still passes visual compliance; it only fails "source-pattern parity" with repos-list.

## Revision 2 acceptance criteria

Verify after the polish pass. All should be satisfiable with grep / a local `yarn start` screenshot diff.

- [ ] `grep -rn "Paginate" src/app/model-cache` → at least one hit in `ModelCatalogTable.tsx`.
- [ ] `grep -rn "from.*shared/components.*EmptyState\|from.*shared.*Spinner" src/app/deploy-models src/app/model-cache` → shared components imported.
- [ ] `grep -rn "__empty-state\|__empty-icon\|__empty-title\|__empty-description\|__spinner" src/app/deploy-models src/app/model-cache` → **0**.
- [ ] `grep -rn "!important" src/app/deploy-models src/app/model-cache` → **0** (outside of legitimate argo-ui overrides already present in clustra-theme.scss).
- [ ] `grep -rn "999px" src/app/deploy-models src/app/model-cache` → **0**.
- [ ] `grep -rn "color: \$brand-emerald-light" src/app/deploy-models/styles.scss src/app/model-cache/styles/model-cache.scss` → applies only to interactive accents (links, active filters, progress fill), not to static heading titles.
- [ ] `grep -rn "themify(\$themes)" src/app/deploy-models/styles.scss src/app/model-cache/styles/model-cache.scss` → matches the pattern count used in [settings-overview.scss](src/app/settings/components/settings-overview/settings-overview.scss) and [repos-list.scss](src/app/settings/components/repos-list/repos-list.scss).
- [ ] `grep -rn "argo-form-row__error-msg" src/app/deploy-models src/app/model-cache` → replaces `.deploy-models__field-error`, `.deploy-models__error`, `.model-cache__inline-error`.
- [ ] Only one status-pill component in `model-cache/` (`<StatusBadge>`); `.model-cache__chip` + `.model-cache__status-badge` collapsed into one rule block.
- [ ] `src/app/deploy-models/styles.scss` ≤ 320 lines (from 404).
- [ ] `src/app/model-cache/styles/model-cache.scss` ≤ 420 lines (from 548).
- [ ] Sidebar active state on `/deploy-models` and `/model-cache` shows emerald left border + emerald icon color, identical to `/applications` and `/settings`.
- [ ] Screenshot parity: open `/applications`, `/settings`, `/settings/repos`, `/deploy-models`, `/model-cache` at 1440×900. Panel title color, panel padding, button shape, table row height, pagination control, empty-state icon-circle, spinner width, and focus-ring color must be indistinguishable across all five.
- [ ] Feature smoke: preflight advisory still fires in `deploy-models/DefaultPage`, job polling still streams, bulk-action bar still works, presets still apply, drawer hard-delete still requires typed confirm. No regression.

## Out of scope for Revision 2

- Do not touch [src/app/shared/brand-tokens.scss](src/app/shared/brand-tokens.scss), [src/app/shared/clustra-theme.scss](src/app/shared/clustra-theme.scss), or the sidebar/login/user-info/ui-banner folders.
- Do not introduce new argo-ui components or new shared components unless R15 requires a one-file extension of `<StatusBadge>`.
- Do not restructure API / hooks / state machines.

## Priority order

1. **R14** (remove `!important` — cheap, tightens CSS cascade)
2. **R16** (panel title colour — single highest visual difference remaining)
3. **R18** (999px pill → 4px)
4. **R13** (error class unification)
5. **R15** (status badge/chip consolidation)
6. **R11** (shared `<EmptyState>`)
7. **R12** (shared `<Spinner>`)
8. **R17** (themify wrapping)
9. **R10** (`<Paginate>` — touches server paging logic, ship last)
10. **R19** (sidebar verification — mostly a check, not a change)
11. **R20** (react-form migration — optional)

Ship R14/R16/R18 first; they're ~30 lines of change and remove the last visible "off" touches. The rest are code-hygiene wins with smaller visual payoff.
