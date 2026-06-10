import type { WindowManager } from '@core/WindowManager';

export class TaskBar {
    private windowManager: WindowManager;

    constructor(windowManager: WindowManager) {
        this.windowManager = windowManager;
        this.setupTaskbarButtonHandlers();
    }

    private setupTaskbarButtonHandlers(): void {
        const taskbarWindows = document.getElementById('taskbar-windows');
        if (!taskbarWindows) return;

        taskbarWindows.addEventListener('click', (e) => {
            if (!(e.target instanceof HTMLElement)) return;

            if (e.target.classList.contains('taskbar-button')) {
                const windowId = e.target.dataset.windowId;
                if (windowId) {
                    this.windowManager.toggleWindow(windowId);
                }
            }
        });
    }
}
