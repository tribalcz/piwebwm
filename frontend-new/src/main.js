import './style.css';
import '@css/global.css';
import '@css/startMenu.css';
import '@css/context-menu.css';

import { WindowManager } from '@core/WindowManager.js';
import { DragDropManager } from '@core/DragDropManager.js';
import { StateManager } from '@core/StateManager.js';
import { AppRegistry} from "@core/AppRegistry.js";

// Import components
import { TaskBar } from '@components/TaskBar.js';
import { StartMenu } from '@components/StartMenu.js';
import { Clock } from '@components/Clock.js';

console.log('🚀 WebDesk OS starting...');

function testRegistry(){
    console.log('Testing AppRegistry...');

    const registry = new AppRegistry();

    const mockManifest = {
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        ui: {
            category: 'applications',
            displayName: 'Test App',
            keywords: ['test', 'app'],
        }
    };

    registry.register(mockManifest);
    console.log('Registered manifest:', registry.get('test-app'));

    const result = registry.search('test');
    console.log('Search results:', result);

    const categories = registry.getCategorie();
    console.log('Categories:', categories);

    console.log('AppRegistry test completed.');
}

document.addEventListener('DOMContentLoaded', () => {

    const stateManager = new StateManager();
    const windowManager = new WindowManager();
    const dragDropManager = new DragDropManager(windowManager);

    const taskBar = new TaskBar(windowManager);
    const startMenu = new StartMenu(windowManager);
    const clock = new Clock();

    clock.start();
    testRegistry();

    console.log('✅ WebDesk WM initialized');
});