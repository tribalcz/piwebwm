import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';
import type { WindowConfig, WindowData } from '@core/types';

export interface WindowManagerStats {
    total: number;
    active: string | null;
    minimized: number;
    maximized: number;
    normal: number;
    zIndex: number;
}

export class WindowManager {
    private eventBus: EventBus | null;
    private store: Store | null;
    private windows: Map<string, WindowData>;
    private activeWindow: string | null;
    private zIndex: number;
    private nextWindowId: number;

    constructor(eventBus: EventBus | null = null, store: Store | null = null) {
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

    createWindow(config: WindowConfig): string {
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
        windowEl.style.zIndex = String(++this.zIndex);

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

        const desktop = document.getElementById('desktop');
        if (!desktop) {
            throw new Error('Desktop element (#desktop) not found');
        }
        desktop.appendChild(windowEl);

        // Create taskbar button
        const taskbarButton = document.createElement('button');
        taskbarButton.className = 'taskbar-button active';
        taskbarButton.textContent = config.title;
        taskbarButton.dataset.windowId = id;

        const taskbarWindows = document.getElementById('taskbar-windows');
        if (!taskbarWindows) {
            throw new Error('Taskbar element (#taskbar-windows) not found');
        }
        taskbarWindows.appendChild(taskbarButton);

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

        const onCreated = config.onCreated;
        if (onCreated && typeof onCreated === 'function') {
            setTimeout(() => onCreated(id, windowEl), 0);
        }

        if (this.eventBus) {
            this.eventBus.emit('window:created', {
                windowId: id,
                title: config.title,
                x: config.x,
                y: config.y
            });
        }

        return id;
    }

    focusWindow(id: string): void {
        const window = this.windows.get(id);
        if (!window) return;

        // Remove active class from all windows and taskbar buttons
        this.windows.forEach((win) => {
            win.element.classList.remove('active');
            win.taskbarButton.classList.remove('active');
        });

        // Add active class to this window
        window.element.classList.add('active');
        window.element.style.zIndex = String(++this.zIndex);
        window.taskbarButton.classList.add('active');
        this.activeWindow = id;

        if (this.eventBus) {
            this.eventBus.emit('window:focused', {
                windowId: id
            });
        }

        if (this.store) {
            this.store.set('windows.active', id);
        }

        if (this.store) {
            const allWindows = Array.from(this.windows.keys());
            this.store.set('windows.all', allWindows);
            this.store.set('windows.count', allWindows.length);
        }
    }

    minimizeWindow(id: string): void {
        const window = this.windows.get(id);
        if (!window) return;

        window.element.classList.add('minimized');
        window.minimized = true;
        window.taskbarButton.classList.remove('active');

        if (this.eventBus) {
            this.eventBus.emit('window:minimized', {
                windowId: id
            });
        }
    }

    maximizeWindow(id: string): void {
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

            if (this.eventBus) {
                this.eventBus.emit('window:restored', {
                    windowId: id
                });
            }
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

            if (this.eventBus) {
                this.eventBus.emit('window:maximized', {
                    windowId: id
                });
            }
        }
    }

    toggleWindow(id: string): void {
        const window = this.windows.get(id);
        if (!window) return;

        if (window.minimized) {
            window.element.classList.remove('minimized');
            window.minimized = false;
            this.focusWindow(id);

            if (this.eventBus) {
                this.eventBus.emit('window:restored', {
                    windowId: id
                });
            }
        } else if (this.activeWindow === id) {
            this.minimizeWindow(id);
        } else {
            this.focusWindow(id);
        }
    }

    closeWindow(id: string): void {
        const window = this.windows.get(id);
        if (!window) return;

        window.element.style.animation = 'windowOpen 0.2s ease-out reverse';
        setTimeout(() => {
            window.element.remove();
            window.taskbarButton.remove();
            this.windows.delete(id);

            if (this.eventBus) {
                this.eventBus.emit('window:closed', {
                    windowId: id
                });
            }

            if (this.store) {
                const allWindows = Array.from(this.windows.keys());
                this.store.set('windows.all', allWindows);
                this.store.set('windows.count', allWindows.length);

                if (this.store.get('windows.active') === id) {
                    this.store.set('windows.active', null);
                }
            }
        }, 200);
    }

    getWindow(id: string): WindowData | undefined {
        return this.windows.get(id);
    }

    getAllWindows(): Map<string, WindowData> {
        return this.windows;
    }

    getActiveWindow(): string | null {
        return this.activeWindow;
    }

    /**
     * Get window statistics
     */
    getStats(): WindowManagerStats {
        let minimized = 0;
        let maximized = 0;
        let normal = 0;

        this.windows.forEach((win) => {
            if (win.minimized) minimized++;
            else if (win.maximized) maximized++;
            else normal++;
        });

        return {
            total: this.windows.size,
            active: this.activeWindow,
            minimized,
            maximized,
            normal,
            zIndex: this.zIndex
        };
    }
}
