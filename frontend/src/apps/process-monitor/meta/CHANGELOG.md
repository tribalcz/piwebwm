# Changelog

All notable changes to Process Monitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added
- Initial stable release with complete monitoring capabilities
- Modular architecture with 7 separate components
- Real-time monitoring with 1-second update interval
- Application statistics (running, registered, categories)
- Window statistics (count, states, positions)
- EventBus monitoring (total events, types, recent history)
- Store inspection (state tree, keys, values)
- Export functionality (JSON format with timestamp)
- Pause/Resume controls
- Clear statistics function
- Manual refresh capability
- Component-based architecture with proper separation

### Components
- `Header.js` - Title and controls (89 lines)
- `AppStats.js` - Application monitoring (97 lines)
- `WindowStats.js` - Window tracking (115 lines)
- `EventStats.js` - Event monitoring (128 lines)
- `StoreStats.js` - State inspection (106 lines)
- `StatsDisplay.js` - Overall coordination (142 lines)
- `Controls.js` - Action buttons (78 lines)
- `index.js` - Main application (187 lines)

### Technical
- Each component under 150 lines
- Proper cleanup in destroy methods
- Event subscription management
- Interval cleanup on close
- Memory leak prevention
- Scoped CSS styling

### UI/UX
- Card-based layout
- Icon indicators for categories
- Scrollable lists for events
- Formatted JSON display
- Visual feedback for actions
- Pause indicator

## [0.8.0] - 2025-01-12

### Added
- Export statistics to JSON file
- Timestamp in exported data
- Download trigger functionality

### Changed
- Improved data collection
- Better JSON formatting

## [0.7.0] - 2025-01-10

### Added
- Store state inspection
- Key-value display
- State tree visualization

### Changed
- Enhanced layout organization
- Better component structure

## [0.6.0] - 2025-01-08

### Added
- EventBus monitoring
- Event count tracking
- Recent events display
- Event type breakdown

### Fixed
- Event subscription leaks
- Memory cleanup issues

## [0.5.0] - 2025-01-05

### Added
- Window statistics
- Window state tracking
- Position information
- Active window highlighting

### Changed
- Improved update mechanism
- Better data aggregation

## [0.4.0] - 2025-01-03

### Added
- Application statistics
- Running apps list
- Category grouping
- App count display

### Technical
- Integration with AppManager
- Real-time data updates

## [0.3.0] - 2025-01-01

### Added
- Pause/Resume functionality
- Clear statistics button
- Manual refresh control

### Changed
- Control button layout
- Icon usage for actions

## [0.2.0] - 2024-12-28

### Added
- Basic statistics display
- Update interval (1 second)
- Component structure

### Technical
- Manifest configuration
- Window settings
- Basic styling

## [0.1.0] - 2024-12-25

### Added
- Initial project setup
- Basic monitoring structure
- App registration
- Lifecycle methods

---

## Release Notes

### Version 1.0.0 Highlights

**Complete Modular Architecture**
The refactoring into 7 separate components provides excellent code organization. Each component maintains a single responsibility and stays under 150 lines, making the codebase highly maintainable.

**Comprehensive Monitoring**
Process Monitor tracks all major system aspects: applications, windows, events, and state. The real-time updates (1-second interval) provide current information without excessive resource usage.

**Export Functionality**
The ability to export all statistics to JSON format enables:
- Debugging system issues
- Performance analysis
- Historical comparisons
- Data sharing with support

**Performance Optimizations**
Proper cleanup of intervals and event subscriptions prevents memory leaks. Component lifecycle management ensures resources are released when the application closes.

### Known Issues

- Large state trees may cause slight rendering delay
- Event history limited to last 10 events
- No compression for exported files

### Upgrade Guide

No breaking changes from 0.8.0. Applications using previous versions will continue to work without modifications.

### Performance Notes

**Resource Usage:**
- CPU: Minimal (updates only once per second)
- Memory: ~5-10MB depending on system state
- Network: None (no external requests)

**Recommended Usage:**
- Keep open for active monitoring
- Close when not needed to free resources
- Clear statistics periodically for long sessions
- Export data before clearing for records

---

## Development History

Process Monitor evolved from a simple statistics display into a comprehensive monitoring tool through iterative improvements:

1. **Phase 1** - Basic structure and statistics
2. **Phase 2** - Real-time updates and controls
3. **Phase 3** - Modular refactoring
4. **Phase 4** - Export and advanced features
5. **Phase 5** - Polish and optimization

Each phase maintained backward compatibility while adding new capabilities.

---

**Process Monitor** - Version 1.0.0 - Stable Release