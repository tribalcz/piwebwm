import { WindowManager } from './core/WindowManager.js';
import { DragDropManager } from './core/DragDropManager.js';
import { StateManager } from './core/StateManager.js';
import { TaskBar } from './components/TaskBar.js';
import { Clock } from './components/Clock.js';

class Desktop{
    constructor() {
        //Init core managers
        this.windowManager = new WindowManager();
        this.dragDropManager = new DragDropManager(this.windowManager);
        this.stateManager = new StateManager(this.windowManager);

        //Init UI Components
        this.taskbar = new TaskBar(this.windowManager);
        this.clock = new Clock();

        this.stateManager.wrapWindowManagerMethods();

        this.stateManager.restoreState();

        console.log('Desktop environment initialized');
    }

    createWindow(config) {
        return this.windowManager.createWindow(config);
    }

    closeAllWindow() {
        const windows = this.windowManager.getAllWindows();
        windows.forEach((_, id) => {
            this.windowManager.closeWindow(id);
        });
    }

    resetState() {
        this.closeAllWindow();
        this.stateManager.clearState();
    }

}

 if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', () => {
        window.desktop = new Desktop();
     });
 } else {
     window.desktop = new Desktop();
 }

 export { Desktop };