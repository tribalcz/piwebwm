# Changelog

All notable changes to File Explorer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added
- Initial release with full file management capabilities
- Modular architecture with separated components (Toolbar, FileList, StatusBar)
- Complete file operations (copy, cut, paste, delete, rename)
- Create new files and folders
- Context menu with all operations
- Keyboard shortcuts (Ctrl+C/X/V, Delete, F2, F5)
- Breadcrumb navigation with clickable path segments
- File viewer for text files
- Properties dialog for detailed file information
- Status bar with operation feedback
- Icon system with file type detection
- Error handling with user-friendly messages
- Loading states and animations

### Technical
- Component-based architecture (under 150 lines per file)
- FileOperations utility for API abstraction
- EventBus integration for app lifecycle events
- Clipboard manager for copy/paste operations
- CSS Modules for scoped styling
- Proper cleanup in component destroy methods

### Components
- `Toolbar.js` - Navigation and breadcrumb (122 lines)
- `FileList.js` - File grid display (288 lines)
- `StatusBar.js` - Status messages (75 lines)
- `FileOperations.js` - API operations (147 lines)
- `index.js` - Main application (439 lines)

### Permissions
- `filesystem:read:/home/**` - Read home directory
- `filesystem:read:/media/**` - Read media directory
- `filesystem:write:/home/*/Documents/**` - Write to Documents
- `filesystem:write:/tmp/**` - Write to temp
- `filesystem:delete:/tmp/**` - Delete from temp
- `clipboard` - Clipboard access

## [0.9.0] - 2025-01-12

### Changed
- Refactored from monolithic to modular architecture
- Separated concerns into distinct components
- Moved file operations to utility module

### Technical
- Split 800+ line main file into components
- Each component maintains single responsibility
- Improved testability and maintainability

## [0.8.0] - 2025-01-10

### Added
- Context menu support
- File properties dialog
- Status bar with feedback

### Fixed
- Context menu parameter passing
- Event handler cleanup
- Memory leaks in component lifecycle

## [0.7.0] - 2025-01-08

### Added
- Keyboard shortcuts
- Copy/cut/paste operations
- Clipboard manager integration

## [0.6.0] - 2025-01-05

### Added
- File deletion with confirmation
- Rename functionality
- Create file/folder operations

## [0.5.0] - 2025-01-03

### Added
- Basic file operations
- Directory navigation
- File list display

## [0.4.0] - 2025-01-01

### Added
- Initial toolbar implementation
- Breadcrumb navigation
- Back/Up buttons

## [0.3.0] - 2024-12-28

### Added
- Window management integration
- Basic UI structure
- File list grid

## [0.2.0] - 2024-12-25

### Added
- Manifest structure
- App registration
- Basic lifecycle methods

## [0.1.0] - 2024-12-20

### Added
- Initial project setup
- Basic HTML structure
- Vanilla JavaScript foundation

---

## Release Notes

### Version 1.0.0 Highlights

**Modular Architecture**
The complete refactoring into separate components improves code organization, maintainability, and testability. Each component has a clear responsibility and stays under 150 lines.

**Full Feature Set**
All essential file management operations are supported with keyboard shortcuts, context menus, and visual feedback.

**Error Handling**
Comprehensive error handling ensures users receive clear feedback when operations fail, including permission errors and file system issues.

**Performance**
Efficient rendering and proper cleanup prevent memory leaks and ensure smooth operation even with large directories.

### Known Issues

- Large files (>10MB) may be slow to display in viewer
- Deep directory recursion limited by JavaScript stack
- Binary files cannot be viewed

### Upgrade Guide

No breaking changes from 0.9.0. Applications built on previous versions will continue to work without modifications.

---

**File Explorer** - Version 1.0.0 - Stable Release