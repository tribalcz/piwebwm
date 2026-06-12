# Changelog

## 1.1.0

- Renamed from **Notepad** to **Atol** — positioned as a universal modular
  application (a notepad in its base form, extensible into anything up to an
  IDE). App id `notepad` → `atol`, module discriminator `notepad-module` →
  `atol-module`, Store keys `apps.notepad.*` → `apps.atol.*`.
- New bundled module **insert-datetime**: toolbar button, context-menu entries
  (date & time / date / time) and a Ctrl+Shift+D command; remembers the last
  used format in module storage.

## 1.0.0

- Initial Notepad application: contenteditable rich-text editor with basic
  formatting (bold/italic/underline, headings, paragraph, bulleted/numbered
  lists, clear formatting).
- Content auto-saved to and restored from the Store.
- Module (micro-app) host system:
  - `ModuleManager` with `module.json` discovery, manifest validation, and
    runtime enable/disable persisted to the Store.
  - `ModuleContext` exposing editor, UI slots (toolbar/statusbar/contextmenu),
    commands with keyboard shortcuts, and namespaced storage.
  - Automatic teardown of all module contributions on deactivate/close.
  - **⚙ Modules** management dialog.
- Bundled `word-count` module (status-bar slot example).
