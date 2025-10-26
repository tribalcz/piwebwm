 export class DragDropManager {
     constructor(windowManager, eventBus = null) {
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

     initEventHandlers() {
         // Double click to maximize
         document.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

         // Mouse down for drag and resize
         document.addEventListener('mousedown', (e) => this.handleMouseDown(e));

         // Mouse move for drag and resize
         document.addEventListener('mousemove', (e) => this.handleMouseMove(e));

         // Mouse up to stop drag and resize
         document.addEventListener('mouseup', () => this.handleMouseUp());
     }

     handleDoubleClick(e) {
         if (e.target.classList.contains('window-header')) {
             const windowEl = e.target.parentElement;
             const windowId = windowEl.dataset.id;

             this.windowManager.maximizeWindow(windowId);
             e.preventDefault();
         }
     }

     handleMouseDown(e) {
         // Handle resize
         if (e.target.classList.contains('resize-handle')) {
             this.startResize(e);
             return;
         }

         // Handle window header dragging
         if (e.target.classList.contains('window-header')) {
             this.startDrag(e);
             return;
         }

         // Handle window control buttons
         if (e.target.hasAttribute('data-action')) {
             this.handleControlButton(e);
             return;
         }

         // Focus window on click
         const window = e.target.closest('.window');
         if (window && !e.target.hasAttribute('data-action')) {
             this.windowManager.focusWindow(window.dataset.id);
         }
     }

     startResize(e) {
         const windowEl = e.target.parentElement;
         const windowData = this.windowManager.getWindow(windowEl.dataset.id);

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
             direction: e.target.className.split(' ')[1]
         };

         e.preventDefault();
     }

     startDrag(e) {
         const windowEl = e.target.parentElement;
         const windowData = this.windowManager.getWindow(windowEl.dataset.id);

         // If maximized, restore on drag
         if (windowData && windowData.maximized) {
             const headerRect = e.target.getBoundingClientRect();
             const relativeX = e.clientX - headerRect.left;
             const relativeRatio = relativeX / headerRect.width;

             // Restore window
             this.windowManager.maximizeWindow(windowEl.dataset.id);

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

         this.windowManager.focusWindow(windowEl.dataset.id);
         e.preventDefault();
     }

     handleControlButton(e) {
         e.stopPropagation();
         const action = e.target.getAttribute('data-action');
         const windowEl = e.target.closest('.window');
         const windowId = windowEl.dataset.id;

         switch(action) {
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

     handleMouseMove(e) {
         if (this.resizingWindow && this.resizeData) {
             this.performResize(e);
         }

         if (this.draggedWindow) {
             this.performDrag(e);
         }
     }

     performResize(e) {
         const deltaX = e.clientX - this.resizeData.startX;
         const deltaY = e.clientY - this.resizeData.startY;
         const dir = this.resizeData.direction;

         let newWidth = this.resizeData.startWidth;
         let newHeight = this.resizeData.startHeight;
         let newLeft = this.resizeData.startLeft;
         let newTop = this.resizeData.startTop;

         // Handle horizontal resize
         if (dir.includes('e')) {
             newWidth = Math.max(400, this.resizeData.startWidth + deltaX);
         }
         if (dir.includes('w')) {
             newWidth = Math.max(400, this.resizeData.startWidth - deltaX);
             newLeft = this.resizeData.startLeft + (this.resizeData.startWidth - newWidth);
         }

         // Handle vertical resize
         if (dir.includes('s')) {
             newHeight = Math.max(300, this.resizeData.startHeight + deltaY);
         }
         if (dir.includes('n')) {
             newHeight = Math.max(300, this.resizeData.startHeight - deltaY);
             newTop = this.resizeData.startTop + (this.resizeData.startHeight - newHeight);
         }

         // Apply new dimensions
         this.resizingWindow.style.width = `${newWidth}px`;
         this.resizingWindow.style.height = `${newHeight}px`;
         this.resizingWindow.style.left = `${newLeft}px`;
         this.resizingWindow.style.top = `${newTop}px`;
     }

     performDrag(e) {
         const x = e.clientX - this.dragOffset.x;
         const y = e.clientY - this.dragOffset.y;

         this.draggedWindow.style.left = `${Math.max(0, x)}px`;
         this.draggedWindow.style.top = `${Math.max(0, y)}px`;
     }

     handleMouseUp() {
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