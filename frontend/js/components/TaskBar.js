import { FileExplorer } from '../apps/FileExplorer.js';

export class TaskBar {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.initStartButton();
        this.setupTaskbarButtonHandlers();
    }

    initStartButton() {
        const startButton = document.getElementById('startBtn');
        if (!startButton) return;

        startButton.addEventListener('click', () => {
            this.showStartMenu();
        });
    }

    showStartMenu() {
        // Create start menu window
        const menuContent = `
            <div class="start-menu">
                <h3 style="margin-bottom: 16px;">Applications</h3>
                <div class="app-list">
                    <button class="app-item" data-app="file-explorer">
                        <span class="app-icon">📁</span>
                        <span class="app-name">File Explorer</span>
                    </button>
                    <button class="app-item" data-app="welcome">
                        <span class="app-icon">ℹ️</span>
                        <span class="app-name">Welcome</span>
                    </button>
                </div>
            </div>
        `;

        const menuId = this.windowManager.createWindow({
            title: 'Start Menu',
            x: 50,
            y: window.innerHeight - 400,
            width: 300,
            height: 300,
            content: menuContent
        });

        // Setup app launchers
        setTimeout(() => {
            const menuWindow = document.querySelector(`[data-id="${menuId}"]`);
            if (!menuWindow) return;

            menuWindow.querySelectorAll('.app-item').forEach(item => {
                item.addEventListener('click', () => {
                    const app = item.dataset.app;
                    this.launchApp(app);
                    // Close start menu
                    this.windowManager.closeWindow(menuId);
                });
            });
        }, 100);
    }

    launchApp(appName) {
        switch(appName) {
            case 'file-explorer':
                const fileExplorer = new FileExplorer(this.windowManager);
                fileExplorer.open();
                break;
            case 'welcome':
                this.createWelcomeWindow();
                break;
            default:
                console.warn('Unknown app:', appName);
        }
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
                <p>Features:</p>
                <ul style="margin-left: 20px;">
                    <li>✅ File Explorer</li>
                    <li>⏳ Terminal (coming soon)</li>
                    <li>⏳ Text Editor (coming soon)</li>
                    <li>⏳ System Monitor (coming soon)</li>
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
}