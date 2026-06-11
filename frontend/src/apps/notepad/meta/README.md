# Notepad

A basic rich-text notepad that doubles as a **host** for micro-app modules.

The editor (contenteditable + basic formatting: bold/italic/underline,
headings, lists) is the built-in baseline. Everything beyond that is added by
**modules** — small, self-contained extensions discovered and managed at
runtime, kept deliberately separate from top-level WebDesk applications.

## Architecture

```
notepad/
├── index.ts              Host app (WebDeskApp). Wires editor + ModuleManager.
├── components/           Editor, Toolbar, StatusBar, ModulesDialog.
├── core/
│   ├── types.ts          Module contracts (ModuleManifest, NotepadModule, …).
│   ├── ModuleManager.ts  Discovery, validation, activate/deactivate, cleanup.
│   └── EditorAPI.ts      Narrow editor facade handed to modules.
└── modules/<id>/         Micro-apps (see below).
```

Content is auto-saved to the Store (`apps.notepad.content`) and restored on
reopen.

## Modules vs. applications

A module is **not** a WebDesk application. The differences are structural, not
just convention:

| | Application | Module |
|---|---|---|
| Manifest | `meta/manifest.json` | `module.json` |
| Discovery | global `AppManager` | Notepad's `ModuleManager` |
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
     "type": "notepad-module",
     "host": "notepad",
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
   `NotepadModule`:

   ```ts
   import type { ModuleContext, NotepadModule } from '../../core/types';

   export default class MyModule implements NotepadModule {
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
module is disabled or the Notepad closes, all of its contributions, listeners
and commands are removed automatically. A module cannot leak state into the
host.

## Bundled modules

- **word-count** — live word/character count in the status bar (example of the
  `statusbar` slot).
