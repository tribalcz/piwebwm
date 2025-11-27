# 📁 File Explorer

A fully-featured file manager for browsing and managing files and folders in WebDesk OS. Built with modular architecture and separated components for maintainability.

## Features

### 🗂️ Navigation
- **Directory browsing** - Navigate through filesystem hierarchy
- **Breadcrumb trail** - Visual path display with clickable navigation
- **Back/Up buttons** - Quick navigation controls
- **Home shortcut** - Return to home directory instantly

### 📋 File Operations
- **Copy** (Ctrl+C) - Copy files and folders to clipboard
- **Cut** (Ctrl+X) - Move files and folders
- **Paste** (Ctrl+V) - Paste from clipboard
- **Delete** (Delete key) - Remove files and folders with confirmation
- **Rename** (F2) - Rename files and folders
- **Create** - New files and folders via context menu

### 🖱️ User Interface
- **Context menu** - Right-click for file operations
- **File list** - Grid view with name, size, and modified date
- **Status bar** - Shows item count and operation status
- **Toolbar** - Navigation buttons and refresh
- **Keyboard shortcuts** - Full keyboard support

### 📄 File Viewing
- **Text files** - Built-in viewer for plain text
- **File properties** - Detailed file information dialog
- **Icon system** - Type-specific icons for files and folders

## Architecture

### Modular Components

**Toolbar** (`components/Toolbar.js`)
- Navigation buttons (back, up, refresh)
- Breadcrumb trail with clickable path segments
- Home button for quick navigation

**FileList** (`components/FileList.js`)
- Grid display of files and folders
- Selection handling
- Context menu support
- Sorting and filtering

**StatusBar** (`components/StatusBar.js`)
- Item count display
- Operation status messages
- Loading indicators

**FileOperations** (`utils/FileOperations.js`)
- API wrapper for filesystem operations
- Error handling
- Async operation support

### Main Application

The main `index.js` coordinates components and manages:
- Window lifecycle
- Component initialization
- Event handling
- State management
- Clipboard operations

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy selected item |
| `Ctrl+X` | Cut selected item |
| `Ctrl+V` | Paste from clipboard |
| `Delete` | Delete selected item |
| `F2` | Rename selected item |
| `F5` | Refresh current directory |
| `Enter` | Open selected item |

## Permissions

Required permissions in manifest:

```json
"permissions": [
  "filesystem:read:/home/**",
  "filesystem:read:/media/**",
  "filesystem:write:/home/*/Documents/**",
  "filesystem:write:/tmp/**",
  "filesystem:delete:/tmp/**",
  "clipboard"
]
```

### Permission Patterns

- `filesystem:read:/home/**` - Read access to home directory and subdirectories
- `filesystem:write:/path/*` - Write access to immediate children only
- `filesystem:write:/path/**` - Recursive write access
- `clipboard` - Access to system clipboard

## File Types

Supported file type icons:

- **Documents**: txt, md, pdf, doc, docx
- **Spreadsheets**: xls, xlsx
- **Images**: jpg, jpeg, png, gif
- **Audio**: mp3, wav
- **Video**: mp4, avi
- **Archives**: zip, tar, gz
- **Code**: sh, py, js, html, css
- **Folders**: Directory icon with special styling

## API Integration

File Explorer communicates with the backend via REST API:

### Endpoints

**List Directory**
```
GET /api/files/list?path=/home/user
```

**Read File**
```
GET /api/files/read?path=/home/user/file.txt
```

**Create File/Folder**
```
POST /api/files/create
Body: { path: string, content: string, isDir: boolean }
```

**Move/Rename**
```
POST /api/files/move
Body: { from: string, to: string }
```

**Delete**
```
DELETE /api/files/delete?path=/home/user/file.txt
```

## Component Details

### Toolbar Component

**Responsibilities:**
- Render navigation buttons
- Display breadcrumb path
- Handle navigation events
- Emit callbacks to parent

**Props:**
```javascript
{
  onBack: Function,      // Back button handler
  onUp: Function,        // Up button handler
  onRefresh: Function,   // Refresh button handler
  onNavigate: Function,  // Breadcrumb navigation
  onHome: Function       // Home button handler
}
```

### FileList Component

**Responsibilities:**
- Display files in grid layout
- Handle file selection
- Emit click/double-click events
- Show context menu
- Display loading/error states

**Props:**
```javascript
{
  onClick: Function,         // Single click handler
  onDoubleClick: Function,   // Double click handler
  onContextMenu: Function    // Right-click handler
}
```

**Methods:**
```javascript
update(files)              // Update displayed files
getSelectedItem()          // Get current selection
clearSelection()           // Clear selection
showLoading()             // Show loading state
showError(message)        // Show error message
```

### StatusBar Component

**Responsibilities:**
- Display status messages
- Show item counts
- Loading indicators
- Error notifications

**Methods:**
```javascript
setStatus(text)           // Set custom status
showLoading()            // Show loading
showReady()              // Show ready state
showItemCount(count)     // Show item count
showError(error)         // Show error
```

## Error Handling

All operations include proper error handling:

- **Network errors** - Display user-friendly messages
- **Permission errors** - Show permission denied dialog
- **File not found** - Clear error indication
- **Invalid operations** - Prevent with validation

## State Management

File Explorer maintains local state:

- `currentPath` - Current directory path
- `selectedItem` - Currently selected file/folder
- `components` - Component instances
- `windowId` - Window identifier

State is ephemeral and not persisted between sessions.

## Styling

Styles are scoped to prevent conflicts:

```css
.file-explorer { }
.explorer-toolbar { }
.explorer-content { }
.file-list { }
.file-item { }
.explorer-statusbar { }
```

All styles use specific class prefixes and are loaded automatically from manifest.

## Development

### Adding New Features

1. Identify target component
2. Add method to component
3. Update parent coordination
4. Test thoroughly
5. Update documentation

### Testing Checklist

- [ ] Navigate to different directories
- [ ] Copy/paste files
- [ ] Cut/paste files
- [ ] Delete files (with confirmation)
- [ ] Rename files
- [ ] Create new files
- [ ] Create new folders
- [ ] Open files in viewer
- [ ] Check keyboard shortcuts
- [ ] Verify context menu
- [ ] Test error scenarios

## Known Limitations

- **Binary files** - Cannot view binary file content
- **Large files** - May be slow to load in viewer
- **Nested operations** - Deep recursion limited by stack
- **Permissions** - Respects system-level restrictions

## Future Enhancements

- File upload functionality
- Drag-and-drop support
- Multi-file selection
- Thumbnail previews for images
- Search within directory
- Sort by name/size/date
- View modes (list, grid, details)
- File tagging system

## Technical Details

- **Language**: JavaScript (ES6+)
- **Module System**: ES Modules
- **Component Pattern**: Class-based
- **Event Handling**: Callbacks
- **Async**: Promises/async-await
- **Error Handling**: Try-catch with user feedback

## Dependencies

- `@components/ContextMenu` - Right-click menus
- `@components/PropertiesDialog` - File properties
- `@utils/Icons` - Icon system
- `@utils/Clipboard` - Clipboard manager

## Version

Current version: **1.0.0**

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

**File Explorer** - Full-featured file management for WebDesk OS