/**
 * Welcome App - Introduction to WebDesk WM
 */
export default class Welcome {
    constructor(context) {
        this.context = context;
        this.windowManager = context.windowManager;
        this.eventBus = context.eventBus || null;
        this.store = context.store || null;
        this.manifest = context.manifest;

        this.windowId = null;

        console.log('Welcome App initialized');
    }

    async init() {
        console.log("Welcome App init");
    }
    async open() {
       const windowCount = this.windowManager.getAllWindows().size;

       this.windowId = this.windowManager.createWindow({
           title: 'Welcome to WebDesk WM',
           x: 100 + (windowCount * 30),
           y: 100 + (windowCount * 30),
           width: this.manifest?.window?.defaultWidth || 500,
           height: this.manifest?.window?.defaultHeight || 350,
           persistent: this.manifest?.window?.persistent || true,
           content: this.createContent()
       });

       if (this.eventBus) {
           this.eventBus.emit('app:opened', {
               appId: this.manifest.id,
               windowId: this.windowId,
           });
       }
    }

    async close() {
        if (this.windowId) {
            this.windowManager.closeWindow(this.windowId);
        }

        if (this.eventBus) {
            this.eventBus.emit('app:closed', {
                appId: this.manifest.id,
            });
        }

        console.log('Welcome App closed');
    }

    createContent() {
        return `
            <div style="padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
                <h2 style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    🖥️ WebDesk OS
                </h2>
                <p style="margin-bottom: 16px; color: #666; line-height: 1.5;">
                    A modern web-based desktop environment for headless Linux systems.
                </p>
                
                <h3 style="margin-bottom: 12px; font-size: 16px;">✨ Available Features:</h3>
                <ul style="margin-left: 20px; margin-bottom: 20px; line-height: 1.8;">
                    <li><strong>File Manager</strong> - Browse your filesystem</li>
                    <li><strong>Window Management</strong> - Drag, resize, minimize</li>
                    <li><strong>Start Menu</strong> - Quick access to applications</li>
                    <li><strong>Process Monitor</strong> - View system activity</li>
                    <li><strong>Event System</strong> - Real-time communication</li>
                    <li><strong>State Management</strong> - Persistent sessions</li>
                </ul>
                
                <h3 style="margin-bottom: 12px; font-size: 16px;">🚀 Coming Soon:</h3>
                <ul style="margin-left: 20px; line-height: 1.8; color: #888;">
                    <li>Terminal Emulator</li>
                    <li>Text Editor</li>
                    <li>System Settings</li>
                    <li>Network Manager</li>
                </ul>
                
                <div style="margin-top: 20px; padding: 12px; background: #f0f0f0; border-radius: 6px; font-size: 13px; color: #666;">
                    💡 <strong>Tip:</strong> Right-click on the desktop for quick actions!
                </div>
            </div>
        `;
    }
}