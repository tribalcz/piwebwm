class Desktop {
            constructor() {
                this.windows = new Map();
                this.activeWindow = null;
                this.zIndex = 100;
                this.draggedWindow = null;
                this.dragOffset = { x: 0, y: 0 };
                this.resizingWindow = null;
                this.resizeData = null;

                this.initClock();
                this.initTaskbar();
                this.initDragHandlers();
            }

            initClock() {
                const updateClock = () => {
                    const now = new Date();
                    const time = now.toLocaleTimeString('cs-CZ');
                    document.getElementById('clock').textContent = time;
                };

                updateClock();
                setInterval(updateClock, 1000);
            }

            initTaskbar() {
                document.getElementById('startBtn').addEventListener('click', () => {
                    this.createWindow({
                        title: 'Welcome',
                        x: 100 + (this.windows.size * 30),
                        y: 100 + (this.windows.size * 30),
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
                });
            }

            initDragHandlers() {
                document.addEventListener('dblclick', (e) => {
                    // Handle double click on window header
                    if (e.target.classList.contains('window-header')) {
                        const windowEl = e.target.parentElement;
                        const windowId = windowEl.dataset.id;

                        // Toggle maximize state
                        this.maximizeWindow(windowId);

                        e.preventDefault();
                    }
                });

                document.addEventListener('mousedown', (e) => {
                    // Handle resize
                    if (e.target.classList.contains('resize-handle')) {
                        const windowEl = e.target.parentElement;
                        const windowData = this.windows.get(windowEl.dataset.id);

                        // Prevent resizing if maximized
                        if (windowData && windowData.maximized) {
                            return;
                        }

                        this.resizingWindow = windowEl;
                        const rect = windowEl.getBoundingClientRect();

                        this.resizeData = {
                            startX: e.clientX,
                            startY: e.clientY,
                            startWidth: rect.width,
                            startHeight: rect.height,
                            startLeft: rect.left,
                            startTop: rect.top,
                            direction: e.target.className.split(' ')[1] // get resize direction
                        };

                        e.preventDefault();
                        return;
                    }

                    // Handle window header dragging
                    if (e.target.classList.contains('window-header')) {
                        const windowEl = e.target.parentElement;
                        const windowData = this.windows.get(windowEl.dataset.id);

                        // If maximized, restore on drag
                        if (windowData && windowData.maximized) {
                            // Calculate relative mouse position in the window header
                            const headerRect = e.target.getBoundingClientRect();
                            const relativeX = e.clientX - headerRect.left;
                            const relativeRatio = relativeX / headerRect.width;

                            // Restore window
                            this.maximizeWindow(windowEl.dataset.id); // This toggles maximize off

                            // Update window data after restore
                            const restoredRect = windowEl.getBoundingClientRect();

                            // Position window so mouse stays at the same relative position
                            const newLeft = e.clientX - (restoredRect.width * relativeRatio);
                            const newTop = e.clientY - 15; // 15px into the header

                            windowEl.style.left = `${Math.max(0, newLeft)}px`;
                            windowEl.style.top = `${Math.max(0, newTop)}px`;

                            // Now start dragging
                            this.draggedWindow = windowEl;
                            windowEl.classList.add('dragging');

                            this.dragOffset.x = e.clientX - newLeft;
                            this.dragOffset.y = e.clientY - newTop;

                            e.preventDefault();
                            return;
                        }

                        // Normal dragging for non-maximized windows
                        this.draggedWindow = windowEl;
                        windowEl.classList.add('dragging');

                        const rect = windowEl.getBoundingClientRect();
                        this.dragOffset.x = e.clientX - rect.left;
                        this.dragOffset.y = e.clientY - rect.top;

                        this.focusWindow(windowEl.dataset.id);
                        e.preventDefault();
                    }
                    
                    // Handle window control buttons
                    if (e.target.hasAttribute('data-action')) {
                        e.stopPropagation();
                        const action = e.target.getAttribute('data-action');
                        const windowEl = e.target.closest('.window');
                        const windowId = windowEl.dataset.id;

                        switch(action) {
                            case 'minimize':
                                this.minimizeWindow(windowId);
                                break;
                            case 'maximize':
                                this.maximizeWindow(windowId);
                                break;
                            case 'close':
                                this.closeWindow(windowId);
                                break;
                        }
                    }

                    // Focus window on click
                    const window = e.target.closest('.window');
                    if (window && !e.target.hasAttribute('data-action')) {
                        this.focusWindow(window.dataset.id);
                    }
                });

                document.addEventListener('mousemove', (e) => {
                    if (this.resizingWindow && this.resizeData) {
                        const deltaX = e.clientX - this.resizeData.startX;
                        const deltaY = e.clientY - this.resizeData.startY;
                        const dir = this.resizeData.direction;

                        let newWidth = this.resizeData.startWidth;
                        let newHeight = this.resizeData.startHeight;
                        let newLeft = this.resizeData.startLeft;
                        let newTop = this.resizeData.startTop;

                        // Handle horizontal resize
                        if (dir.includes('e')) {
                            newWidth = Math.max(300, this.resizeData.startWidth + deltaX);
                        }
                        if (dir.includes('w')) {
                            newWidth = Math.max(300, this.resizeData.startWidth - deltaX);
                            newLeft = this.resizeData.startLeft + (this.resizeData.startWidth - newWidth);
                        }

                        // Handle vertical resize
                        if (dir.includes('s')) {
                            newHeight = Math.max(200, this.resizeData.startHeight + deltaY);
                        }
                        if (dir.includes('n')) {
                            newHeight = Math.max(200, this.resizeData.startHeight - deltaY);
                            newTop = this.resizeData.startTop + (this.resizeData.startHeight - newHeight);
                        }

                        // Apply new dimensions
                        this.resizingWindow.style.width = `${newWidth}px`;
                        this.resizingWindow.style.height = `${newHeight}px`;
                        this.resizingWindow.style.left = `${newLeft}px`;
                        this.resizingWindow.style.top = `${newTop}px`;
                    }

                    if (this.draggedWindow) {
                        const x = e.clientX - this.dragOffset.x;
                        const y = e.clientY - this.dragOffset.y;

                        this.draggedWindow.style.left = `${Math.max(0, x)}px`;
                        this.draggedWindow.style.top = `${Math.max(0, y)}px`;
                    }
                });

                document.addEventListener('mouseup', () => {
                    if (this.draggedWindow) {
                        this.draggedWindow.classList.remove('dragging');
                        this.draggedWindow = null;
                    }
                    if (this.resizingWindow) {
                        this.resizingWindow = null;
                        this.resizeData = null;
                    }
                });
            }

            createWindow(config) {
                const id = Date.now().toString();

                const windowEl = document.createElement('div');
                windowEl.className = 'window';
                windowEl.dataset.id = id;
                windowEl.style.left = `${config.x}px`;
                windowEl.style.top = `${config.y}px`;
                windowEl.style.width = `${config.width}px`;
                windowEl.style.height = `${config.height}px`;
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

                // Add click handler to taskbar button
                taskbarButton.addEventListener('click', () => {
                    this.toggleWindow(id);
                });

                this.windows.set(id, {
                    element: windowEl,
                    config,
                    taskbarButton,
                    minimized: false,
                    maximized: false,
                    originalPos: null
                });

                this.focusWindow(id);
            }

            focusWindow(id) {
                const window = this.windows.get(id);
                if (!window) return;

                // Remove active class from all windows and taskbar buttons
                this.windows.forEach((win, winId) => {
                    win.element.classList.remove('active');
                    win.taskbarButton.classList.remove('active');
                });

                // Add active class to this window
                window.element.classList.add('active');
                window.element.style.zIndex = ++this.zIndex;
                window.taskbarButton.classList.add('active');
                this.activeWindow = id;

                // Deactivate all other windows
                this.windows.forEach((win, winId) => {
                    win.taskbarButton.classList.remove('active');
                });

                // Activate this window
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
        }

        // Start aplikace
        const desktop = new Desktop();