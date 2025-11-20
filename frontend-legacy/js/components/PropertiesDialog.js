import { getIcon } from '../utils/Icons.js';
export class PropertiesDialog {
    static show(windowManager, fileInfo) {
        const content = this.renderContent(fileInfo);

        windowManager.createWindow({
            title: 'Properties - ' + fileInfo.name,
            x: 250,
            y: 150,
            width: 400,
            height: 500,
            content: content,
            persistent: false
        });
    }

    static renderContent(file) {
        const type = file.is_dir ? 'Folder' : 'File';
        const size = file.is_dir ? '-' : this.formatSize(file.size);
        const modified = new Date(file.modified * 1000).toLocaleString('cs-CZ');
        const permissions = file.permissions;

        return `
            <div class="properties-dialog">
                <div class="properties-header">
                    <span class="properties-icon">${file.is_dir ? getIcon('file') : getIcon('txt')}</span>
                    <h3>${this.escapeHtml(file.name)}</h3>
                </div>
                
                <div class="properties-content">
                    <div class="property-row">
                        <span class="property-label">Type:</span>
                        <span class="property-value">${type}</span>
                    </div>
                    
                    <div class="property-row">
                        <span class="property-label">Location:</span>
                        <span class="property-value">${this.escapeHtml(file.path)}</span>
                    </div>
                    
                    <div class="property-row">
                        <span class="property-label">Size:</span>
                        <span class="property-value">${size}</span>
                    </div>
                    
                    <div class="property-row">
                        <span class="property-label">Modified:</span>
                        <span class="property-value">${modified}</span>
                    </div>
                    
                    <div class="property-row">
                        <span class="property-label">Permissions:</span>
                        <span class="property-value">${permissions}</span>
                    </div>
                </div>
                
                <div class="properties-footer">
                    <button class="btn-primary" onclick="window.closeCurrentWindow()">Close</button>
                </div>
            </div>
        `;
    }

    static formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}