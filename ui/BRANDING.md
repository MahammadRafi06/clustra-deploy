# Clustra Deploy UI Branding

This fork uses the current Clustra AI website visual system: a slightly darker
light enterprise app canvas, white operational surfaces, slate text, Inter
typography, blue primary actions, visible borders, and the blue shield logo from
`/home/mahammad/Clustra-AI/public/logo-blue.svg`.

## Source Of Truth

- `src/app/shared/brand-tokens.scss` is the token source for palette and
  typography. Component SCSS should import tokens from this file instead of
  hard-coding brand colors or font stacks.
- `src/app/shared/clustra-theme.scss` is the Argo UI override layer. Keep it
  focused on inherited Argo surfaces such as cards, tables, filters, dialogs,
  tabs, logs, settings pages, and product typography resets.
- `src/app/shared/utils.ts` intentionally returns the light theme so user or
  system preferences cannot switch this product shell back to Argo dark mode.
- `src/assets/images/logo-blue.svg` is the visible product logo. The old
  transparent and text-logo PNGs may remain in the tree for compatibility, but
  they should not be used in visible UI.
- `src/assets/favicon/` is regenerated from the website blue PNG. The
  `package.json` postinstall hook copies those favicons into `argo-ui` so
  webpack does not replace them with upstream Argo assets.

## Merge Rules

- Preserve Clustra routes and labels for `Model Inventory`, `Model Deployments`,
  and Clustra-branded settings copy.
- Preserve the Helm custom CSS delivery path:
  `configs.styles` -> `ui.cssurl` -> `./custom/custom.styles.css`.
- Keep `src/app/shared/brand-tokens.scss`,
  `src/app/shared/clustra-theme.scss`, login/sidebar branding, and favicon
  assets as ours during upstream merge conflict resolution unless an upstream
  change fixes a real compatibility problem.
- Do not expose implementation vendor names in visible public/product chrome
  unless product requirements explicitly call for them.

## Visual Acceptance Checklist

Check these screens after branding changes:

- `/login`
- `/applications`
- `/deploy-models`
- `/model-cache`
- `/settings`
- `/settings/repos`
- `/settings/clusters`
- `/settings/appearance`
- `/user-info`

Desktop and mobile checks should confirm:

- The blue shield is used in login, sidebar, and favicons.
- No unsupported theme-mode copy appears in the UI.
- The body background is `#eef2f7` and main surfaces are white/light with
  visible borders.
- Primary actions use Clustra blue, not the old emerald brand accent.
- Sidebar navigation is text-first without decorative icons beside items. On
  mobile it keeps a compact text rail and content does not inherit the old
  full-width sidebar gutter.
- Long repository, path, model, and job values wrap instead of clipping.
- UI text uses Inter; code, YAML, traces, and logs use the mono stack.

## Quick Commands

```bash
yarn build
yarn lint
rg -n "assets/images/logo-" src/app/login src/app/sidebar
```
