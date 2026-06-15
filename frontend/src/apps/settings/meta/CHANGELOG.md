# Changelog

## 1.3.0

- Network phase 2 completed: editable **Routing** tab (add/delete static routes)
  and **DNS search domains** in the Configure dialog. DNS/search now use
  "leave unchanged unless specified" semantics so an IP edit never wipes them.
- Interface controls: **Enable/Disable** (with lockout confirmation) and
  **MTU** change, plus MTU and error/dropped counters on each card.
- New **Wi-Fi** tab: scan (signal strength), connect (password prompt for
  secured networks) and forget saved networks.
- New **Diagnostics** tab: ping, traceroute and DNS lookup with an output pane.
- **IPv6** interface configuration (auto/manual/disabled/ignore) in the
  Configure dialog; the DNS field accepts IPv4 and IPv6 servers together.
- Polish: inline **throughput sparkline** per interface and a **DHCP lease**
  viewer.
- New agent actions and `/api/system/network/*` endpoints back all of the
  above; static routes and IPv6 are included in the safe-apply auto-revert.

## 1.2.0

- Network phase 2: per-interface IPv4 configuration (DHCP/static + gateway +
  DNS) via NetworkManager, from the Interfaces tab's "Configure" dialog.
- Safe-apply with auto-revert: the agent reverts the change after 60s unless
  confirmed, preventing lockout when changing the management interface.
  New agent actions SetInterfaceConfig / ConfirmNetworkConfig and endpoints
  `POST /api/system/network/{interface,confirm}`.
- Routing remains read-only (route editing deferred).

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
