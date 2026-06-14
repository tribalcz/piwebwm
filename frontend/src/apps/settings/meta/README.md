# Settings

GNOME-style settings: a sidebar of sections on the left, the selected section's
controls on the right. Everything persists in the Store under `settings.*` and
applies immediately.

## Sections

- **Appearance** — theme (Light/Dark) and desktop background presets. Backed by
  the core `ThemeManager`, which flips `data-theme` / `data-background` on
  `<html>`; the CSS design tokens in `style.css` cascade from there into every
  window, the taskbar, menus and the login screen. No WindowManager changes
  were needed.
- **Network** — host network from the agent. Status: hostname (editable),
  gateway, DNS, connectivity. Interfaces: per-NIC state, IPv4/IPv6, MAC, link
  speed, live throughput, and **Configure** (DHCP/static IPv4 + gateway + DNS
  via NetworkManager). Routing: routing table (read-only).
  - Reads use `ip -j addr/route`, `/sys`, `/etc/resolv.conf`; hostname via
    `hostnamectl`; interface config via `nmcli` (requires iproute2 +
    NetworkManager on the host).
  - **Safe-apply:** an interface change applies with a 60s timer — the agent
    reverts unless the UI confirms (`POST /network/confirm`). Changing the IP of
    the interface you're connected through will drop the session and auto-revert,
    so you can't lock yourself out.
  - Endpoints: `GET /api/system/network/{status,interfaces,routes}`,
    `POST /api/system/network/{hostname,interface,confirm}`.
- **Windows** — restore persistent windows on startup
  (`settings.windows.restoreOnStartup`, read by `StateManager`).
- **Taskbar & Clock** — 12/24-hour format and seconds visibility
  (`settings.clock.*`, the taskbar `Clock` subscribes via the Store).
- **System** — backend health (`/health`), host-agent mode, signed-in user and
  logout; developer toggle to log all EventBus events to the console
  (`settings.developer.logEvents`).
- **About** — version/stack info and app counts.

## Adding a section

One file in `sections/` exporting a `render(container, ctx)` function plus one
row in the `SECTIONS` registry in `index.ts`. The `SettingsContext` provides
the Store, EventBus, AppManager and ThemeManager.

## Theming notes

Light token values match the original palette exactly, so the light theme is
pixel-identical to the pre-token UI. The dark palette lives next to it in
`style.css`. App styles (including Process Monitor's inline styles) reference
the tokens, so both themes propagate everywhere.
