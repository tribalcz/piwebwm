# 📊 Process Monitor

Real-time system monitoring application for WebDesk OS. Provides detailed statistics about running applications, windows, events, and system state with modular architecture and comprehensive visualizations.

## Features

### 📱 Applications Monitoring
- **Running apps** - Count and list of active applications
- **App instances** - Track multiple instances per app
- **Launch tracking** - Monitor app launch events
- **Cleanup detection** - Identify when apps close

### 🪟 Window Statistics
- **Window count** - Total active windows
- **Window states** - Minimized, maximized, normal
- **Position tracking** - Window coordinates and dimensions
- **Z-index management** - Focus order tracking

### 📡 EventBus Monitoring
- **Event count** - Total events emitted
- **Event types** - Breakdown by event category
- **Recent events** - Latest 10 events with details
- **Event rate** - Events per second calculation

### 💾 Store Inspection
- **State tree** - Complete store state visualization
- **Key-value pairs** - All stored data
- **Persistence status** - LocalStorage sync status
- **State changes** - Real-time updates

### 📊 Statistics Export
- **JSON export** - Download all statistics
- **Timestamp** - Export time included
- **Complete data** - All monitoring categories

### ⏯️ Controls
- **Pause/Resume** - Freeze monitoring updates
- **Clear** - Reset statistics
- **Export** - Save data to file
- **Refresh** - Manual update trigger

## Architecture

### Modular Components

**Header** (`components/Header.js`)
- Title and icon display
- Control buttons (pause, clear, export)
- Status indicators

**AppStats** (`components/AppStats.js`)
- Running applications list
- App count display
- Instance tracking

**WindowStats** (`components/WindowStats.js`)
- Window count and states
- Active window highlighting
- Position information

**EventStats** (`components/EventStats.js`)
- Event count and types
- Recent events list
- Event details display

**StoreStats** (`components/StoreStats.js`)
- State tree visualization
- Key-value display
- JSON formatting

**StatsDisplay** (`components/StatsDisplay.js`)
- Overall statistics summary
- Category organization
- Update coordination

**Controls** (`components/Controls.js`)
- Button group management
- Action handlers
- State feedback

### Main Application

The main `index.js` coordinates:
- Component initialization and management
- Automatic updates (1 second interval)
- Event subscriptions
- Data collection and aggregation
- Export functionality

## User Interface

### Layout Structure

```
┌─────────────────────────────────┐
│ Header (Title + Controls)        │
├─────────────────────────────────┤
│                                  │
│  Statistics Display              │
│  ┌────────────┬────────────┐   │
│  │ App Stats  │ Window     │   │
│  │            │ Stats      │   │
│  ├────────────┼────────────┤   │
│  │ Event      │ Store      │   │
│  │ Stats      │ Stats      │   │
│  └────────────┴────────────┘   │
│                                  │
└─────────────────────────────────┘
```

### Visual Elements

- **Cards** - Each stat category in separate card
- **Icons** - Visual indicators for categories
- **Badges** - Highlight important numbers
- **Lists** - Scrollable event and app lists
- **JSON viewer** - Formatted code display

## Statistics Categories

### Application Statistics

```javascript
{
  registered: number,           // Total registered apps
  running: number,             // Currently running apps
  runningApps: string[],       // Array of app IDs
  categories: object           // Apps grouped by category
}
```

### Window Statistics

```javascript
{
  count: number,              // Total windows
  minimized: number,          // Minimized windows
  maximized: number,          // Maximized windows
  normal: number,            // Normal state windows
  windows: [                 // Detailed window info
    {
      id: string,
      title: string,
      x: number,
      y: number,
      width: number,
      height: number,
      state: string
    }
  ]
}
```

### Event Statistics

```javascript
{
  totalEvents: number,        // All events emitted
  eventTypes: object,         // Count per event type
  recentEvents: [            // Last 10 events
    {
      type: string,
      data: object,
      timestamp: number
    }
  ]
}
```

### Store Statistics

```javascript
{
  keys: string[],            // All store keys
  values: object,            // Complete state tree
  size: number              // Approximate size in bytes
}
```

## Update Mechanism

### Automatic Updates

Process Monitor updates every 1 second (configurable):

```javascript
this.updateInterval = setInterval(() => {
    if (!this.isPaused) {
        this.updateStats();
    }
}, 1000);
```

### Manual Updates

Users can trigger immediate updates via:
- Refresh button
- Resume after pause
- Component focus

### Event Subscriptions

Real-time updates via EventBus:

```javascript
// Subscribe to relevant events
eventBus.on('app:launched', this.handleAppLaunch);
eventBus.on('window:created', this.handleWindowCreated);
eventBus.on('store:changed', this.handleStoreChanged);
```

## Export Functionality

### Export Format

```json
{
  "timestamp": "2025-01-15T12:34:56.789Z",
  "system": {
    "apps": { /* App statistics */ },
    "windows": { /* Window statistics */ },
    "events": { /* Event statistics */ },
    "store": { /* Store state */ }
  }
}
```

### Export Process

1. Collect all current statistics
2. Format as JSON with timestamp
3. Create blob with data
4. Trigger browser download
5. Filename: `webdesk-stats-{timestamp}.json`

## Performance Considerations

### Update Optimization

- **Debouncing** - Limit update frequency
- **Conditional rendering** - Only update changed data
- **Pagination** - Limit displayed items
- **Virtual scrolling** - For large lists (future)

### Memory Management

- **Circular buffers** - Limit event history
- **Cleanup** - Clear intervals on close
- **Subscription cleanup** - Unsubscribe from events
- **Component destruction** - Proper lifecycle management

## Configuration

### Update Interval

Modify refresh rate:

```javascript
this.updateInterval = 1000; // milliseconds
```

### Display Limits

Control displayed items:

```javascript
const MAX_RECENT_EVENTS = 10;
const MAX_RUNNING_APPS = 20;
```

### Export Settings

Configure export behavior:

```javascript
const EXPORT_FILENAME_PREFIX = 'webdesk-stats';
const EXPORT_FORMAT = 'json';
```

## Development

### Adding New Statistics

1. Create new stats component
2. Add data collection method
3. Integrate into StatsDisplay
4. Update export functionality
5. Add tests

### Component Structure

Each stat component follows:

```javascript
export class StatComponent {
    constructor(container, appManager) {
        this.container = container;
        this.appManager = appManager;
        this.render();
    }
    
    render() {
        // Initial HTML structure
    }
    
    update(data) {
        // Update displayed data
    }
    
    destroy() {
        // Cleanup
    }
}
```

### Testing

Test categories:
- [ ] Statistics accuracy
- [ ] Real-time updates
- [ ] Pause/Resume functionality
- [ ] Clear operation
- [ ] Export format
- [ ] Memory leak prevention
- [ ] Component cleanup

## Permissions

The Process Monitor requires no special permissions. It monitors system state through exposed APIs and doesn't access restricted resources.

## Technical Details

### Dependencies

- `@core/AppManager` - Access to app statistics
- `@core/WindowManager` - Window information
- `@core/EventBus` - Event monitoring
- `@core/Store` - State inspection
- `@utils/Icons` - Visual elements

### File Structure

```
apps/process-monitor/
├── meta/
│   ├── manifest.json
│   ├── README.md
│   └── CHANGELOG.md
├── components/
│   ├── Header.js
│   ├── AppStats.js
│   ├── WindowStats.js
│   ├── EventStats.js
│   ├── StoreStats.js
│   ├── StatsDisplay.js
│   └── Controls.js
├── styles/
│   └── styles.css
└── index.js
```

### Code Organization

- **Header** - 89 lines
- **AppStats** - 97 lines
- **WindowStats** - 115 lines
- **EventStats** - 128 lines
- **StoreStats** - 106 lines
- **StatsDisplay** - 142 lines
- **Controls** - 78 lines
- **Main** - 187 lines

Total: ~942 lines across 8 files

## Known Limitations

- **Event history** - Limited to last 10 events
- **Update frequency** - Fixed 1 second interval
- **Large state trees** - May be slow to render
- **Export size** - No compression

## Future Enhancements

- **Graphs** - Visual charts for trends
- **Filtering** - Filter events by type
- **History** - Long-term statistics tracking
- **Alerts** - Threshold-based notifications
- **Comparison** - Compare stats over time
- **Search** - Search through events and state
- **Real-time graphs** - Live updating charts
- **Performance profiling** - CPU/memory usage

## Troubleshooting

### Stats Not Updating

1. Check if monitoring is paused
2. Verify EventBus connection
3. Check browser console for errors
4. Try manual refresh

### Export Not Working

1. Check browser download permissions
2. Verify JSON formatting
3. Check available disk space
4. Try different browser

### High Memory Usage

1. Clear statistics regularly
2. Reduce update frequency
3. Limit event history size
4. Close when not needed

## Version

Current version: **1.0.0**

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

**Process Monitor** - Real-time system monitoring for WebDesk OS