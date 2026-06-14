import type { Editor } from '../components/Editor';
import type { EditorAPI } from './types';

/**
 * Wraps an Editor into the narrow EditorAPI handed to modules. This keeps
 * host-only methods (destroy) out of a module's reach.
 */
export function createEditorAPI(editor: Editor): EditorAPI {
    return {
        getText: () => editor.getText(),
        setText: (text) => editor.setText(text),
        getHTML: () => editor.getHTML(),
        setHTML: (html) => editor.setHTML(html),
        getSelectionText: () => editor.getSelectionText(),
        replaceSelection: (text) => editor.replaceSelection(text),
        applyFormat: (command, value) => editor.applyFormat(command, value),
        focus: () => editor.focus(),
        setLineNumbers: (enabled) => editor.setLineNumbers(enabled),
        search: {
            find: (query, opts) => editor.search(query, opts),
            next: () => editor.findNext(),
            prev: () => editor.findPrev(),
            replace: (replacement) => editor.replaceCurrent(replacement),
            replaceAll: (query, replacement, opts) => editor.replaceAll(query, replacement, opts),
            clear: () => editor.clearSearch(),
        },
        onChange: (cb) => editor.onChange(cb),
        onSelectionChange: (cb) => editor.onSelectionChange(cb),
    };
}
