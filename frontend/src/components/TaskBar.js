export class TaskBar {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.setupTaskbarButtonHandlers();
    }

    setupTaskbarButtonHandlers() {
        const taskbarWindows = document.getElementById('taskbar-windows');
        if (!taskbarWindows) return;

        taskbarWindows.addEventListener('click', (e) => {
            if (e.target.classList.contains('taskbar-button')) {
                const windowId = e.target.dataset.windowId;
                if (windowId) {
                    this.windowManager.toggleWindow(windowId);
                }
            }
        });
    }
}