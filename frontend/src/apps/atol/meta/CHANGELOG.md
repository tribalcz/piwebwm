# Changelog

## 1.5.0

- File mode: Atol can be opened against an external document through a
  `DocumentProvider` (`appManager.launch('atol', { args: { provider } })`).
  Provider-launched Atol opens in its own window — plain-text editing with
  explicit Save/Reload, line numbers, no rich formatting and no autosave —
  alongside (not replacing) the notes buffer. First consumer: the /etc/hosts
  editor in Settings ▸ Network.

## 1.4.0

- Host editor capabilities: `EditorAPI.search` (find/next/prev/replace/
  replaceAll over the content), `EditorAPI.setHTML` (restore whole document),
  and `ui.setFocusMode` (hide chrome / center editor).
- Five new bundled modules:
  - **find-replace** (on): floating Find & Replace panel, Ctrl+F / Ctrl+H.
  - **export** (on): download the note as .txt / .md / .html.
  - **text-transforms** (on): selection case changes, sort lines, trim,
    remove duplicate lines, via the context menu.
  - **snapshots** (off): local history with periodic + manual snapshots and
    restore.
  - **focus-mode** (off): distraction-free writing with a floating exit button.

## 1.3.0

- New `EditorAPI.setLineNumbers` editor capability (host owns a sticky,
  scroll-synced line-number gutter; enabling it switches the editor to a
  no-wrap layout so logical lines map 1:1 to rows).
- New bundled module **line-numbers** (off by default): a slot-less module
  that turns the gutter on/off purely through the editor API.

## 1.2.0

- New `menubar` slot in the module system (host gained a menu-bar region above
  the toolbar; hidden until a module contributes menus, so the base editor is
  unchanged when no menu module is enabled).
- New bundled module **menu-bar**: classic File / Edit dropdown menus.

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
