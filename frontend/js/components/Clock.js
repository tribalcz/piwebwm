export class Clock {
    constructor() {
        this.clockElement = document.getElementById('clock');
        this.intervalId = null;

        if (this.clockElement) {
            this.start();
        }
    }

    start() {
        this.updateTime();
        this.intervalId = setInterval(() => this.updateTime(), 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    updateTime() {
        const now = new Date();
        const time = now.toLocaleTimeString('cs-CZ');
        this.clockElement.textContent = time;
    }

    setFormat(format) {
        this.format = format;
        this.updateTime();
    }
}