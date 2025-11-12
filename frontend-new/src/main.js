import './style.css';
import '@css/global.css';
import '@css/startMenu.css';
import '@css/context-menu.css';

// Import modules
import { WindowManager } from '@core/WindowManager.js';
import { DragDropManager } from '@core/DragDropManager.js';
import { StateManager } from '@core/StateManager.js';
import { AppRegistry} from "@core/AppRegistry.js";
import { EventBus } from '@core/EventBus.js';
import { Store } from '@core/Store.js';

// Import components
import { TaskBar } from '@components/TaskBar.js';
import { StartMenu } from '@components/StartMenu.js';
import { Clock } from '@components/Clock.js';
import { AppManager } from "@core/AppManager.js";

import ProcessMonitor from "@apps/process-monitor/index.js";
import { Index } from '@apps/fileExplorer/index.js';
import Welcome from '@apps/welcome/index.js';

import {getIcon} from "@utils/Icons.js";
console.log('WebDesk WM starting...');

document.addEventListener('DOMContentLoaded', async () => {  // ✅ async
    console.log('Init EventBus...');
    const eventBus = new EventBus();

    console.log('Init Store...');
    const store = new Store();

    store.restore();

    store.enableAutoPersist({debounce: 500});

    console.log('Init WindowManager...');
    const windowManager = new WindowManager(eventBus, store);

    console.log('Init DragDropManager...');
    const dragDropManager = new DragDropManager(windowManager, eventBus);

    console.log('Init StateManager...');
    const stateManager = new StateManager(windowManager, eventBus, store    );

    console.log('Init AppManager...');
    const appManager = new AppManager(eventBus, store);

    console.log('Running app discovery...');
    await appManager.discovery();

    console.log('Discovered apps:', appManager.registry.getAll().map(a => a.id).join(', '))

    const taskBar = new TaskBar(windowManager);
    const startMenu = new StartMenu(windowManager, appManager);
    const clock = new Clock();

    clock.start();

    window.webdesk = {
        eventBus,
        store,
        windowManager,
        appManager,
        stateManager,
    };

    console.log('WebDesk WM initialized.');
    console.log('Debug: window.webdesk available.');

    if (window.location.hostname === 'localhost') {
        eventBus.on('*', (data) => {
            console.log('Event:', data);
        });
    }

    const ctx = {
        windowManager: webdesk.windowManager,
        eventBus: webdesk.eventBus,
        store: webdesk.store,
        manifest: { id: 'file-explorer', window: { defaultWidth: 700, defaultHeight: 500 }}
    };
    const fe = new Index(ctx);
    await fe.init();
    await fe.open();

    // Process Monitor
    fetch('/src/apps/process-monitor/meta/manifest.json')
        .then(r => r.json())
        .then(m => console.log('✅ Process Monitor manifest:', m));

    await new Promise(resolve => setTimeout(resolve, 0));

    const ctxpm = {
        windowManager: webdesk.windowManager,
        eventBus: webdesk.eventBus,
        store: webdesk.store,
        appManager: webdesk.appManager,
        manifest: {
            id: 'process-monitor',
            window: { defaultWidth: 650, defaultHeight: 750, persistent: false }
        }
    };

    const pm = new ProcessMonitor(ctxpm);
    await pm.init();
    await pm.open();

});