# App Store

Browse the catalog of WebDesk applications and Atol modules, and
install/uninstall them.

## What "install" means

Everything ships in the build — apps and modules are discovered at build time.
"Install" / "uninstall" therefore only flips a **persisted flag**; no code is
downloaded or deleted.

- **Applications** → `apps.<id>.installed` in the Store (default: the manifest's
  `enabled` flag). Uninstalling hides the app from the Start menu and blocks
  launching it. Apps with `"removable": false` (such as the App Store itself)
  cannot be uninstalled.
- **Atol modules** → `apps.atol.modules.<id>.enabled` — the very same key
  Atol's `ModuleManager` reads, so toggling here enables/disables the
  module in Atol (applied next time Atol opens).

State changes for apps emit `app:installed` / `app:uninstalled` on the EventBus;
the Start menu listens and refreshes live.

## Catalog sources

- Applications: the `AppManager` registry (already discovered + validated).
- Atol modules: `import.meta.glob` over `atol/modules/*/module.json`.

## Layout

Master–detail: a filter/search bar on top, a grouped list (Applications /
Atol Modules) on the left, a detail panel with the manifest info and the
install/uninstall action on the right, and a count in the status bar.

## Notes / later

- Toggling an Atol module while Atol is already open takes effect on the
  next open (live sync of a running host is a later refinement).
- Real installation of third-party code (download + sandbox) is intentionally
  out of scope; this manages bundled apps/modules only.
