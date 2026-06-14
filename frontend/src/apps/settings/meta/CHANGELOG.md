# Changelog

## 1.0.0

- Initial Settings app with a GNOME-like sidebar layout.
- Sections: Appearance (theme Light/Dark + desktop background presets),
  Windows (restore on startup), Taskbar & Clock (12/24h, seconds),
  System (backend health, account/logout, developer event logging), About.
- Introduced the design-token theming system (`:root` /
  `[data-theme="dark"]` CSS custom properties) and the core `ThemeManager`;
  refactored all existing app styles to the tokens.
- All settings persist in the Store under `settings.*` and apply live.
