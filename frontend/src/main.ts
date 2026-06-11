import './style.css';
import '@css/startMenu.css';
import '@css/context-menu.css';

// Import modules
import { WindowManager } from '@core/WindowManager';
import { DragDropManager } from '@core/DragDropManager';
import { StateManager } from '@core/StateManager';
import { EventBus } from '@core/EventBus';
import { Store } from '@core/Store';
import { AppManager } from '@core/AppManager';
import { requireAuth } from '@core/AuthGate';

// Import components
import { TaskBar } from '@components/TaskBar';
import { StartMenu } from '@components/StartMenu';
import { Clock } from '@components/Clock';

declare global {
    interface Window {
        webdesk: {
            eventBus: EventBus;
            store: Store;
            windowManager: WindowManager;
            appManager: AppManager;
            stateManager: StateManager;
        };
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Gate the desktop behind authentication. Resolves once a session exists.
    const user = await requireAuth();
    console.log(`Authenticated as ${user.username}`);

    console.log('Init EventBus...');
    const eventBus = new EventBus();

    console.log('Init Store...');
    const store = new Store();

    store.restore();

    store.enableAutoPersist({ debounce: 500 });

    console.log('Init WindowManager...');
    const windowManager = new WindowManager(eventBus, store);

    console.log('Init DragDropManager...');
    new DragDropManager(windowManager, eventBus);

    console.log('Init StateManager...');
    const stateManager = new StateManager(windowManager, eventBus, store);

    console.log('Init AppManager...');
    const appManager = new AppManager(eventBus, store, windowManager);

    console.log('Running app discovery...');
    await appManager.discovery();

    console.log('Discovered apps:', appManager.registry.getAll().map(a => a.id).join(', '));

    new TaskBar(windowManager);
    new StartMenu(windowManager, appManager);
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
