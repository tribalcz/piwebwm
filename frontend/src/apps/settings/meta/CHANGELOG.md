# Changelog

## 1.1.0

- New **Network** section (Status / Interfaces / Routing) reading live host
  network data via the agent; hostname is editable, the rest is read-only in
  this iteration. Interfaces tab shows live throughput (polled).
- Sections may now return a cleanup function from `render` (used to stop the
  Network polling when the section is left or Settings closes).
- Fix: `/health` is now proxied by the Vite dev server, so the System tab shows
  the host-agent status in dev too.

## 1.0.0

- Initial Settings app with a GNOME-like sidebar layout.
- Sections: Appearance (theme Light/Dark + desktop background presets),
  Windows (restore on startup), Taskbar & Clock (12/24h, seconds),
  System (backend health, account/logout, developer event logging), About.
- Introduced the design-token theming system (`:root` /
  `[data-theme="dark"]` CSS custom properties) and the core `ThemeManager`;
  refactored all existing app styles to the tokens.
- All settings persist in the Store under `settings.*` and apply live.
