# Changelog

## 1.0.0

- Initial App Store: master–detail catalog of applications and Atol modules
  built from their manifests.
- Install/uninstall via a persisted flag (apps: `apps.<id>.installed`; modules:
  reuse `apps.atol.modules.<id>.enabled`). No code is downloaded or removed.
- Filter by type (All / Applications / Modules) and text search.
- Detail panel shows description, version, author, category/host and
  permissions, with an install/uninstall action.
- `removable: false` apps (e.g. the App Store itself) cannot be uninstalled.
- Emits `app:installed` / `app:uninstalled`; the Start menu refreshes live.
