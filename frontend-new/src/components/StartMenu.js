import { getIcon} from "@utils/Icons.js";

export class StartMenu {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.menuElement = null;
        this.isOpen = false;
        this.getIcon = getIcon;

        this.initMenu();
        this.setupEventListeners();
    }

    initMenu() {
        // Create menu element
        const menu = document.createElement('div');
        menu.id = 'start-menu';
        menu.className = 'start-menu hidden';

        menu.innerHTML = `
            <div class="start-menu-header">
                <input type="text" class="start-menu-search" placeholder="Search applications..." />
            </div>
            
            <div class="start-menu-content">
                <div class="menu-section">
                    <div class="menu-section-title">Applications</div>
                    <button class="menu-item" data-app="file-explorer">
                        <span class="menu-icon">${getIcon('fileManager')}</span>
                        <span class="menu-label">File Manager</span>
                    </button>
                    <button class="menu-item" data-app="terminal">
                        <span class="menu-icon">${getIcon('terminal')}</span>
                        <span class="menu-label">Terminal</span>
                        <span class="menu-badge">Soon</span>
                    </button>
                    <button class="menu-item" data-app="text-editor">
                        <span class="menu-icon">📝</span>
                        <span class="menu-label">Text Editor</span>
                        <span class="menu-badge">Soon</span>
                    </button>
                </div>
                
                <div class="menu-separator"></div>
                
                <div class="menu-section">
                    <div class="menu-section-title">System</div>
                    <button class="menu-item" data-app="system-monitor">
                        <span class="menu-icon">${getIcon('systemMonitor')}</span>
                        <span class="menu-label">System Monitor</span>
                        <span class="menu-badge">Soon</span>
                    </button>
                    <button class="menu-item" data-app="settings">
                        <span class="menu-icon">${getIcon('settings')}</span>
                        <span class="menu-label">Settings</span>
                        <span class="menu-badge">Soon</span>
                    </button>
                </div>
                
                <div class="menu-separator"></div>
                
                <div class="menu-section">
                    <div class="menu-section-title">About</div>
                    <button class="menu-item" data-app="welcome">
                        <span class="menu-icon">${getIcon('welcome')}</span>
                        <span class="menu-label">Welcome</span>
                    </button>
                </div>
            </div>
            
            <div class="start-menu-footer">
                <button class="menu-footer-item" data-action="logout">
                    <span>${getIcon('logout', 16)}</span> Logout
                </button>
                <button class="menu-footer-item" data-action="restart">
                    <span>${getIcon('restart', 16)}</span> Restart
                </button>
                <button class="menu-footer-item" data-action="shutdown">
                    <span>${getIcon('shutdown', 16)}</span> Shutdown
                </button>
            </div>
        `;

        document.body.appendChild(menu);
        this.menuElement = menu;
    }

    setupEventListeners() {
        // Toggle menu on start button click
        const startButton = document.getElementById('startBtn');
        if (startButton) {
            startButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.menuElement.contains(e.target)) {
                this.close();
            }
        });

        // Handle menu item clicks
        this.menuElement.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const app = e.currentTarget.dataset.app;
                const badge = e.currentTarget.querySelector('.menu-badge');

                if (badge) {
                    // App not available yet
                    return;
                }

                this.launchApp(app);
                this.close();
            });
        });

        // Handle footer actions
        this.menuElement.querySelectorAll('.menu-footer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleSystemAction(action);
            });
        });

        // Search functionality
        const searchInput = this.menuElement.querySelector('.start-menu-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterMenu(e.target.value);
            });
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.menuElement.classList.remove('hidden');
        this.menuElement.classList.add('visible');
        this.isOpen = true;

        // Position menu above taskbar
        const startButton = document.getElementById('startBtn');
        if (startButton) {
            const rect = startButton.getBoundingClientRect();
            this.menuElement.style.left = `${rect.left}px`;
            this.menuElement.style.bottom = `${window.innerHeight - rect.top + 5}px`;
        }

        // Focus search input
        const searchInput = this.menuElement.querySelector('.start-menu-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    close() {
        this.menuElement.classList.remove('visible');
        this.menuElement.classList.add('hidden');
        this.isOpen = false;

        // Clear search
        const searchInput = this.menuElement.querySelector('.start-menu-search');
        if (searchInput) {
            searchInput.value = '';
            this.filterMenu('');
        }
    }

    filterMenu(query) {
        const lowerQuery = query.toLowerCase();
        const items = this.menuElement.querySelectorAll('.menu-item');

        items.forEach(item => {
            const label = item.querySelector('.menu-label').textContent.toLowerCase();
            if (label.includes(lowerQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        // Hide sections if all items are hidden
        const sections = this.menuElement.querySelectorAll('.menu-section');
        sections.forEach(section => {
            const visibleItems = section.querySelectorAll('.menu-item[style*="flex"]');
            if (visibleItems.length === 0 && query !== '') {
                section.style.display = 'none';
            } else {
                section.style.display = 'block';
            }
        });
    }

    launchApp(appName) {
        switch(appName) {
            case 'file-explorer':
                // Dynamic import to avoid circular dependency
                import('../apps/FileExplorer.js').then(module => {
                    const fileExplorer = new module.FileExplorer(this.windowManager);
                    fileExplorer.open();
                });
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
            title: 'Welcome to WebDesk OS',
            x: 100 + (windowCount * 30),
            y: 100 + (windowCount * 30),
            width: 500,
            height: 350,
            persistent: true,
            content: `
                <div style="padding: 20px;">
                    <h2 style="margin-bottom: 16px;">🖥️ WebDesk OS</h2>
                    <p style="margin-bottom: 16px; color: #666;">
                        A modern web-based desktop environment for headless Linux systems.
                    </p>
                    
                    <h3 style="margin-bottom: 12px; font-size: 16px;">Available Features:</h3>
                    <ul style="margin-left: 20px; margin-bottom: 20px; line-height: 1.8;">
                        <li>✅ <strong>File Manager</strong> - Browse your filesystem</li>
                        <li>✅ <strong>Window Management</strong> - Drag, resize, minimize</li>
                        <li>✅ <strong>Start Menu</strong> - Quick access to applications</li>
                    </ul>
                    
                    <h3 style="margin-bottom: 12px; font-size: 16px;">Coming Soon:</h3>
                    <ul style="margin-left: 20px; line-height: 1.8;">
                        <li>⏳ Terminal Emulator</li>
                        <li>⏳ Text Editor</li>
                        <li>⏳ System Monitor</li>
                        <li>⏳ Settings Panel</li>
                    </ul>
                </div>
            `
        });
    }

    handleSystemAction(action) {
        switch(action) {
            case 'logout':
                if (confirm('Are you sure you want to logout?')) {
                    // Clear state and reload
                    localStorage.clear();
                    location.reload();
                }
                break;

            case 'restart':
                if (confirm('Are you sure you want to restart?')) {
                    alert('Restart simulation - page will reload');
                    location.reload();
                }
                break;

            case 'shutdown':
                if (confirm('Are you sure you want to shutdown?')) {
                    // Show shutdown screen
                    document.body.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; 
                                    height: 100vh; background: #1a1a1a; color: white; 
                                    font-family: sans-serif; flex-direction: column; gap: 20px;">
                            <h1 style="font-size: 48px;">⏻</h1>
                            <h2>System Shutdown</h2>
                            <p style="color: #888;">You can close this tab now</p>
                        </div>
                    `;
                }
                break;
        }

        this.close();
    }
}