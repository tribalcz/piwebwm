import './style.css';
import './styles/global.css';
import './styles/startMenu.css';
import './styles/context-menu.css';

import { WindowManager } from './core/WindowManager.js';
import { DragDropManager } from './core/DragDropManager.js';
import { StateManager } from './core/StateManager.js';

// Import components
import { TaskBar } from './components/TaskBar.js';
import { StartMenu } from './components/StartMenu.js';
import { Clock } from './components/Clock.js';

console.log('🚀 WebDesk OS starting...');

document.addEventListener('DOMContentLoaded', () => {

    const stateManager = new StateManager();
    const windowManager = new WindowManager();
    const dragDropManager = new DragDropManager(windowManager);

    const taskBar = new TaskBar(windowManager);
    const startMenu = new StartMenu(windowManager);
    const clock = new Clock();

    clock.start();

    console.log('✅ WebDesk WM initialized');
});