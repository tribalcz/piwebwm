export class TaskBar {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.initStartButton();
        this.setupTaskbarButtonHandlers();
    }

    initStartButton() {
        const startButton = document.getElementById('startBtn');
        if (!startBtn) return;

        startButton.addEventListener('click', () => {
            this.createWelcomeWindow();
        });
    }

    createWelcomeWindow() {
        const windowCount = this.windowManager.getAllWindows().size;

        this.windowManager.createWindow({
            title: 'Welcome',
            x: 100 + (windowCount * 30),
            y: 100 + (windowCount * 30),
            width: 400,
            height: 300,
            content: `
                <h2>RPi Web Desktop</h2>
                <p>Welcome to your web-based desktop environment!</p>
                <br>
                <p>Features coming soon:</p>
                <ul style="margin-left: 20px;">
                    <li>File Explorer</li>
                    <li>Terminal</li>
                    <li>Text Editor</li>
                    <li>System Monitor</li>
                </ul>
            `
        });
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

    addTaskbarButton(windowId, title) {
        const taskbarWindows = document.getElementById('taskbar-windows');
        if (!taskbarWindows) return null;

        const button = document.createElement('button');
        button.className = 'taskbar-button';
        button.textContent = title;
        button.dataset.windowId = windowId;
        taskbarWindows.appendChild(button);

        return button;
    }

    removeTaskbarButton(windowId) {
        const button = document.querySelector(`[data-window-id="${windowId}"]`);
        if (button) {
            button.remove();
        }
    }
}