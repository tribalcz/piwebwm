import type { EventBus } from '@core/EventBus';
import type { WindowManager } from '@core/WindowManager';

interface ResizeData {
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
    direction: string;
}

export class DragDropManager {
    private windowManager: WindowManager;
    private eventBus: EventBus | null;
    private draggedWindow: HTMLElement | null;
    private dragOffset: { x: number; y: number };
    private resizingWindow: HTMLElement | null;
    private resizeData: ResizeData | null;

    constructor(windowManager: WindowManager, eventBus: EventBus | null = null) {
        this.windowManager = windowManager;

        this.eventBus = eventBus;

        this.draggedWindow = null;
        this.dragOffset = { x: 0, y: 0 };
        this.resizingWindow = null;
        this.resizeData = null;

        this.initEventHandlers();

        if (this.eventBus) {
            console.log('  ↳ DragDropManager connected to EventBus');
        }
    }

    private initEventHandlers(): void {
        // Double click to maximize
        document.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

        // Mouse down for drag and resize
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));

        // Mouse move for drag and resize
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        // Mouse up to stop drag and resize
        document.addEventListener('mouseup', () => this.handleMouseUp());
    }

    private handleDoubleClick(e: MouseEvent): void {
        if (!(e.target instanceof HTMLElement)) return;

        if (e.target.classList.contains('window-header')) {
            const windowEl = e.target.parentElement;
            const windowId = windowEl?.dataset.id;
            if (!windowId) return;

            this.windowManager.maximizeWindow(windowId);
            e.preventDefault();
        }
    }

    private handleMouseDown(e: MouseEvent): void {
        if (!(e.target instanceof HTMLElement)) return;

        // Handle resize
        if (e.target.classList.contains('resize-handle')) {
            this.startResize(e, e.target);
            return;
        }

        // Handle window header dragging
        if (e.target.classList.contains('window-header')) {
            this.startDrag(e, e.target);
            return;
        }

        // Handle window control buttons
        if (e.target.hasAttribute('data-action')) {
            this.handleControlButton(e, e.target);
            return;
        }

        // Focus window on click
        const windowEl = e.target.closest<HTMLElement>('.window');
        if (windowEl && !e.target.hasAttribute('data-action')) {
            const windowId = windowEl.dataset.id;
            if (windowId) {
                this.windowManager.focusWindow(windowId);
            }
        }
    }

    private startResize(e: MouseEvent, target: HTMLElement): void {
        const windowEl = target.parentElement;
        if (!windowEl) return;

        const windowId = windowEl.dataset.id;
        const windowData = windowId ? this.windowManager.getWindow(windowId) : undefined;

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
            direction: target.className.split(' ')[1]
        };

        e.preventDefault();
    }

    private startDrag(e: MouseEvent, target: HTMLElement): void {
        const windowEl = target.parentElement;
        if (!windowEl) return;

        const windowId = windowEl.dataset.id;
        if (!windowId) return;

        const windowData = this.windowManager.getWindow(windowId);

        // If maximized, restore on drag
        if (windowData && windowData.maximized) {
            const headerRect = target.getBoundingClientRect();
            const relativeX = e.clientX - headerRect.left;
            const relativeRatio = relativeX / headerRect.width;

            // Restore window
            this.windowManager.maximizeWindow(windowId);

            // Update window data after restore
            const restoredRect = windowEl.getBoundingClientRect();

            // Position window so mouse stays at the same relative position
            const newLeft = e.clientX - (restoredRect.width * relativeRatio);
            const newTop = e.clientY - 15;

            windowEl.style.left = `${Math.max(0, newLeft)}px`;
            windowEl.style.top = `${Math.max(0, newTop)}px`;

            // Start dragging
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

        this.windowManager.focusWindow(windowId);
        e.preventDefault();
    }

    private handleControlButton(e: MouseEvent, target: HTMLElement): void {
        e.stopPropagation();
        const action = target.getAttribute('data-action');
        const windowEl = target.closest<HTMLElement>('.window');
        const windowId = windowEl?.dataset.id;
        if (!windowId) return;

        switch (action) {
            case 'minimize':
                this.windowManager.minimizeWindow(windowId);
                break;
            case 'maximize':
                this.windowManager.maximizeWindow(windowId);
                break;
            case 'close':
                this.windowManager.closeWindow(windowId);
                break;
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (this.resizingWindow && this.resizeData) {
            this.performResize(e);
        }

        if (this.draggedWindow) {
            this.performDrag(e);
        }
    }

    private performResize(e: MouseEvent): void {
        const windowEl = this.resizingWindow;
        const resizeData = this.resizeData;
        if (!windowEl || !resizeData) return;

        const deltaX = e.clientX - resizeData.startX;
        const deltaY = e.clientY - resizeData.startY;
        const dir = resizeData.direction;

        let newWidth = resizeData.startWidth;
        let newHeight = resizeData.startHeight;
        let newLeft = resizeData.startLeft;
        let newTop = resizeData.startTop;

        // Handle horizontal resize
        if (dir.includes('e')) {
            newWidth = Math.max(400, resizeData.startWidth + deltaX);
        }
        if (dir.includes('w')) {
            newWidth = Math.max(400, resizeData.startWidth - deltaX);
            newLeft = resizeData.startLeft + (resizeData.startWidth - newWidth);
        }

        // Handle vertical resize
        if (dir.includes('s')) {
            newHeight = Math.max(300, resizeData.startHeight + deltaY);
        }
        if (dir.includes('n')) {
            newHeight = Math.max(300, resizeData.startHeight - deltaY);
            newTop = resizeData.startTop + (resizeData.startHeight - newHeight);
        }

        // Apply new dimensions
        windowEl.style.width = `${newWidth}px`;
        windowEl.style.height = `${newHeight}px`;
        windowEl.style.left = `${newLeft}px`;
        windowEl.style.top = `${newTop}px`;
    }

    private performDrag(e: MouseEvent): void {
        const windowEl = this.draggedWindow;
        if (!windowEl) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        windowEl.style.left = `${Math.max(0, x)}px`;
        windowEl.style.top = `${Math.max(0, y)}px`;
    }

    private handleMouseUp(): void {
        if (this.draggedWindow) {
            this.draggedWindow.classList.remove('dragging');
            this.draggedWindow = null;

            // Trigger save state event
            window.dispatchEvent(new CustomEvent('windowMoved'));
        }

        if (this.resizingWindow) {
            this.resizingWindow = null;
            this.resizeData = null;

            // Trigger save state event
            window.dispatchEvent(new CustomEvent('windowResized'));
        }
    }
}
