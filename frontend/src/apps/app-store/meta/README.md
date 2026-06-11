# App Store

Browse the catalog of WebDesk applications and Notepad modules, and
install/uninstall them.

## What "install" means

Everything ships in the build — apps and modules are discovered at build time.
"Install" / "uninstall" therefore only flips a **persisted flag**; no code is
downloaded or deleted.

- **Applications** → `apps.<id>.installed` in the Store (default: the manifest's
  `enabled` flag). Uninstalling hides the app from the Start menu and blocks
  launching it. Apps with `"removable": false` (such as the App Store itself)
  cannot be uninstalled.
- **Notepad modules** → `apps.notepad.modules.<id>.enabled` — the very same key
  the Notepad's `ModuleManager` reads, so toggling here enables/disables the
  module in Notepad (applied next time Notepad opens).

State changes for apps emit `app:installed` / `app:uninstalled` on the EventBus;
the Start menu listens and refreshes live.

## Catalog sources

- Applications: the `AppManager` registry (already discovered + validated).
- Notepad modules: `import.meta.glob` over `notepad/modules/*/module.json`.

## Layout

Master–detail: a filter/search bar on top, a grouped list (Applications /
Notepad Modules) on the left, a detail panel with the manifest info and the
install/uninstall action on the right, and a count in the status bar.

## Notes / later

- Toggling a Notepad module while Notepad is already open takes effect on the
  next open (live sync of a running host is a later refinement).
- Real installation of third-party code (download + sandbox) is intentionally
  out of scope; this manages bundled apps/modules only.
