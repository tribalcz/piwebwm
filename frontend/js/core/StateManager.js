export class StateManager {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.storageKey = 'desktop-state';
        this.saveTimeout = null;

        this.initAutoSave();
    }

    saveState() {
        const windows = this.windowManager.getAllWindows();

        const state = {
            windows: Array.from(windows.entries()).map(([id, win]) => ({
                id: id,
                title: win.config.title,
                content: win.config.content,
                x: parseInt(win.element.style.left) || 0,
                y: parseInt(win.element.style.top) || 0,
                width: parseInt(win.element.style.width) || 400,
                height: parseInt(win.element.style.height) || 300,
                minimized: win.minimized,
                maximized: win.maximized,
                originalPos: win.originalPos
            })),
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    restoreState() {
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) return;

        try {
            const state = JSON.parse(saved);

            if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(this.storageKey);
                return;
            }

            // Restore windows
            state.windows.forEach(win => {
                // Create window with saved config
                const windowId = this.windowManager.createWindow({
                    title: win.title,
                    x: win.x || 100,
                    y: win.y || 100,
                    width: win.width || 400,
                    height: win.height || 300,
                    content: win.content
                });

                const windowData = this.windowManager.getWindow(windowId);

                // Restore minimized/maximized state
                if (win.minimized) {
                    this.windowManager.minimizeWindow(windowId);
                }
                if (win.maximized) {
                    // First restore original position if saved
                    if (win.originalPos) {
                        windowData.originalPos = win.originalPos;
                    }
                    this.windowManager.maximizeWindow(windowId);
                }
            });
        } catch (error) {
            console.error('Failed to restore state:', error);
            localStorage.removeItem(this.storageKey);
        }
    }

    clearState() {
        localStorage.removeItem(this.storageKey);
    }

    debouncedSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveState(), 500);
    }

    initAutoSave() {
        window.addEventListener('windowMoved', () => this.debouncedSave());
        window.addEventListener('windowResized', () => this.debouncedSave());
        window.addEventListener('windowClosed', () => this.debouncedSave());
        window.addEventListener('windowMinimized', () => this.debouncedSave());
        window.addEventListener('windowMaximized', () => this.debouncedSave());

        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }

    wrapWindowManagerMethods() {
        const originalClose = this.windowManager.closeWindow.bind(this.windowManager);
        this.windowManager.closeWindow = (id) => {
            originalClose(id);
            window.dispatchEvent(new CustomEvent('windowClosed'));
        };

        const originalMinimize = this.windowManager.minimizeWindow.bind(this.windowManager);
        this.windowManager.minimizeWindow = (id) => {
            originalMinimize(id);
            window.dispatchEvent(new CustomEvent('windowMinimized'));
        };

        const originalMaximize = this.windowManager.maximizeWindow.bind(this.windowManager);
        this.windowManager.maximizeWindow = (id) => {
            originalMaximize(id);
            window.dispatchEvent(new CustomEvent('windowMaximized'));
        };
    }
}