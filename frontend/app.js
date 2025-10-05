class Desktop {
    constructor() {
        this.windows = new Map();
        this.initClock();
        this.initTaskbar();
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
        document.querySelector('.start-button').addEventListener('click', () => {
            // Prozatím jen test okno
            this.createWindow({
                title: 'Test Window',
                x: 100,
                y: 100,
                width: 400,
                height: 300,
                content: '<p>Hello from window!</p>'
            });
        });
    }

    createWindow(config) {
        const id = Date.now().toString();

        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = `window-${id}`;
        windowEl.style.left = `${config.x}px`;
        windowEl.style.top = `${config.y}px`;
        windowEl.style.width = `${config.width}px`;
        windowEl.style.height = `${config.height}px`;

        windowEl.innerHTML = `
            <div class="window-header">
                <span class="window-title">${config.title}</span>
                <div class="window-controls">
                    <button data-action="minimize">_</button>
                    <button data-action="maximize">□</button>
                    <button data-action="close">×</button>
                </div>
            </div>
            <div class="window-content">
                ${config.content}
            </div>
        `;

        document.getElementById('desktop').appendChild(windowEl);

        // Event handlery pro tlačítka
        windowEl.querySelector('[data-action="close"]').addEventListener('click', () => {
            this.closeWindow(id);
        });

        this.windows.set(id, { element: windowEl, config });
    }

    closeWindow(id) {
        const window = this.windows.get(id);
        if (window) {
            window.element.remove();
            this.windows.delete(id);
        }
    }
}

const desktop = new Desktop();