export class WindowManager {
    constructor(eventBus = null, store = null) {
        this.eventBus = eventBus;
        this.store = store;
        this.windows = new Map();
        this.activeWindow = null;
        this.zIndex = 100;
        this.nextWindowId = 1;

        if (this.eventBus) {
            console.log('  ↳ WindowManager connected to EventBus');
        }
        if (this.store) {
            console.log('  ↳ WindowManager connected to Store');
        }
    }

    createWindow(config) {
        const id = Date.now().toString();

        const windowEl = document.createElement('div');
        windowEl.className = 'window active';
        windowEl.dataset.id = id;
        windowEl.style.left = `${config.x}px`;
        windowEl.style.top = `${config.y}px`;
        windowEl.style.width = `${config.width}px`;
        windowEl.style.height = `${config.height}px`;
        windowEl.style.minHeight = `300px`;
        windowEl.style.minWidth = `400px`;
        windowEl.style.zIndex = ++this.zIndex;

        windowEl.innerHTML = `
            <div class="window-header">
                <span class="window-title">${config.title}</span>
                <div class="window-controls">
                    <button data-action="minimize">_</button>
                    <button data-action="maximize">□</button>
                    <button class="close" data-action="close">×</button>
                </div>
            </div>
            <div class="window-content">
                ${config.content}
            </div>
            <!-- Resize handles -->
            <div class="resize-handle resize-n"></div>
            <div class="resize-handle resize-s"></div>
            <div class="resize-handle resize-e"></div>
            <div class="resize-handle resize-w"></div>
            <div class="resize-handle resize-ne"></div>
            <div class="resize-handle resize-nw"></div>
            <div class="resize-handle resize-se"></div>
            <div class="resize-handle resize-sw"></div>
        `;

        document.getElementById('desktop').appendChild(windowEl);

        // Create taskbar button
        const taskbarButton = document.createElement('button');
        taskbarButton.className = 'taskbar-button active';
        taskbarButton.textContent = config.title;
        taskbarButton.dataset.windowId = id;
        document.getElementById('taskbar-windows').appendChild(taskbarButton);

        // Store window data
        this.windows.set(id, {
            element: windowEl,
            config,
            taskbarButton,
            minimized: false,
            maximized: false,
            originalPos: null
        });

        this.focusWindow(id);

        if (config.onCreated && typeof config.onCreated === 'function') {
            setTimeout(() => config.onCreated(id, windowEl), 0);
        }

        return id;
    }

    focusWindow(id) {
        const window = this.windows.get(id);
        if (!window) return;

        // Remove active class from all windows and taskbar buttons
        this.windows.forEach((win) => {
            win.element.classList.remove('active');
            win.taskbarButton.classList.remove('active');
        });

        // Add active class to this window
        window.element.classList.add('active');
        window.element.style.zIndex = ++this.zIndex;
        window.taskbarButton.classList.add('active');
        this.activeWindow = id;
    }

    minimizeWindow(id) {
        const window = this.windows.get(id);
        if (!window) return;

        window.element.classList.add('minimized');
        window.minimized = true;
        window.taskbarButton.classList.remove('active');
    }

    maximizeWindow(id) {
        const window = this.windows.get(id);
        if (!window) return;

        if (window.maximized) {
            // Restore
            window.element.classList.remove('maximized');
            if (window.originalPos) {
                window.element.style.left = window.originalPos.left;
                window.element.style.top = window.originalPos.top;
                window.element.style.width = window.originalPos.width;
                window.element.style.height = window.originalPos.height;
            }
            window.maximized = false;
        } else {
            // Save current position
            window.originalPos = {
                left: window.element.style.left,
                top: window.element.style.top,
                width: window.element.style.width,
                height: window.element.style.height
            };

            // Maximize
            window.element.classList.add('maximized');
            window.maximized = true;
        }
    }

    toggleWindow(id) {
        const window = this.windows.get(id);
        if (!window) return;

        if (window.minimized) {
            window.element.classList.remove('minimized');
            window.minimized = false;
            this.focusWindow(id);
        } else if (this.activeWindow === id) {
            this.minimizeWindow(id);
        } else {
            this.focusWindow(id);
        }
    }

    closeWindow(id) {
        const window = this.windows.get(id);
        if (!window) return;

        window.element.style.animation = 'windowOpen 0.2s ease-out reverse';
        setTimeout(() => {
            window.element.remove();
            window.taskbarButton.remove();
            this.windows.delete(id);
        }, 200);
    }

    getWindow(id) {
        return this.windows.get(id);
    }

    getAllWindows() {
        return this.windows;
    }

    getActiveWindow() {
        return this.activeWindow;
    }
}