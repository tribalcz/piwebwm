# Atol

A universal modular application: a rich-text notepad in its base form that doubles as a **host** for micro-app modules — extensible into anything up to an IDE.

The editor (contenteditable + basic formatting: bold/italic/underline,
headings, lists) is the built-in baseline. Everything beyond that is added by
**modules** — small, self-contained extensions discovered and managed at
runtime, kept deliberately separate from top-level WebDesk applications.

## Architecture

```
atol/
├── index.ts              Host app (WebDeskApp). Wires editor + ModuleManager.
├── components/           Editor, Toolbar, StatusBar, ModulesDialog.
├── core/
│   ├── types.ts          Module contracts (ModuleManifest, AtolModule, …).
│   ├── ModuleManager.ts  Discovery, validation, activate/deactivate, cleanup.
│   └── EditorAPI.ts      Narrow editor facade handed to modules.
└── modules/<id>/         Micro-apps (see below).
```

Content is auto-saved to the Store (`apps.atol.content`) and restored on
reopen.

## Modules vs. applications

A module is **not** a WebDesk application. The differences are structural, not
just convention:

| | Application | Module |
|---|---|---|
| Manifest | `meta/manifest.json` | `module.json` |
| Discovery | global `AppManager` | Atol's `ModuleManager` |
| Window | own window | none — contributes to host slots |
| Lifecycle | `init`/`open`/`close` | `activate`/`deactivate` |
| Context | `AppContext` | `ModuleContext` |

Because the manifest filename and directory depth differ, the global app
discovery globs never pick a module up.

## Writing a module

1. Create `modules/<id>/module.json`:

   ```json
   {
     "id": "my-module",
     "type": "atol-module",
     "host": "atol",
     "version": "1.0.0",
     "name": "My Module",
     "description": "What it does.",
     "entryPoint": "index.ts",
     "slots": ["toolbar", "statusbar", "contextmenu"],
     "enabledByDefault": true
   }
   ```

   `slots` declares where the module may contribute; calls to undeclared slots
   are ignored with a warning.

2. Create `modules/<id>/index.ts` with a default-exported class implementing
   `AtolModule`:

   ```ts
   import type { ModuleContext, AtolModule } from '../../core/types';

   export default class MyModule implements AtolModule {
       activate(ctx: ModuleContext): void {
           ctx.ui.addToolbarItem({
               id: 'shout',
               label: 'Shout',
               onClick: () => ctx.editor.replaceSelection(
                   ctx.editor.getSelectionText().toUpperCase()
               ),
           });
       }
       // deactivate?() is optional — registrations are torn down automatically.
   }
   ```

That's it — no registration step. The module is discovered on next load and can
be toggled at runtime from the toolbar's **⚙ Modules** dialog.

### What a module can do (`ModuleContext`)

- `editor` — read/replace text and selection, apply formatting, subscribe to
  `onChange` / `onSelectionChange`.
- `ui` — `addToolbarItem`, `addStatusItem`, `addContextMenuItem`,
  `refreshStatus`.
- `commands` — `register(id, handler, shortcut?)` (e.g. `"Ctrl+Shift+K"`).
- `storage` — key/value store namespaced to the module.
- `log` — console.

Every registration returns a `Disposable` and is tracked by the host: when a
module is disabled or the Atol closes, all of its contributions, listeners
and commands are removed automatically. A module cannot leak state into the
host.

## Bundled modules

- **word-count** — live word/character count in the status bar (example of the
  `statusbar` slot).
- **insert-datetime** — inserts the current date/time at the cursor (example of
  the `toolbar` and `contextmenu` slots, a keyboard command — Ctrl+Shift+D —
  and per-module storage).
- **menu-bar** — classic File / Edit dropdown menu bar above the toolbar
  (example of the `menubar` slot). The host shows the menu bar only while a
  module contributes menus to it.
- **line-numbers** — IDE-style line-number gutter (example of a slot-less
  module: pure editor behaviour via `EditorAPI.setLineNumbers`). Off by
  default; enabling it shows the gutter and switches the editor to a no-wrap
  layout so numbers stay aligned.
- **find-replace** — floating Find & Replace panel (Ctrl+F / Ctrl+H), backed by
  `EditorAPI.search`. On by default.
- **export** — download the note as .txt / .md / .html. On by default.
- **text-transforms** — context-menu actions on the selection (case changes,
  sort lines, trim, remove duplicates). On by default.
- **snapshots** — local history: periodic + on-demand snapshots you can
  restore (uses module storage and `EditorAPI.setHTML`). Off by default.
- **focus-mode** — distraction-free writing; hides the chrome and centers the
  text via `ui.setFocusMode`. Off by default.
