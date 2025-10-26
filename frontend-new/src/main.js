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
import {AppManager} from "@core/AppManager.js";

console.log('WebDesk WM starting...');

document.addEventListener('DOMContentLoaded', () => {
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

    const taskBar = new TaskBar(windowManager);
    const startMenu = new StartMenu(windowManager);
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
});