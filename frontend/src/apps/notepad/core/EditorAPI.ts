import type { Editor } from '../components/Editor';
import type { EditorAPI } from './types';

/**
 * Wraps an Editor into the narrow EditorAPI handed to modules. This keeps
 * host-only methods (setHTML, destroy) out of a module's reach.
 */
export function createEditorAPI(editor: Editor): EditorAPI {
    return {
        getText: () => editor.getText(),
        setText: (text) => editor.setText(text),
        getHTML: () => editor.getHTML(),
        getSelectionText: () => editor.getSelectionText(),
        replaceSelection: (text) => editor.replaceSelection(text),
        applyFormat: (command, value) => editor.applyFormat(command, value),
        focus: () => editor.focus(),
        onChange: (cb) => editor.onChange(cb),
        onSelectionChange: (cb) => editor.onSelectionChange(cb),
    };
}
