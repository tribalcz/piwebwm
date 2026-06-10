export class Clock {
    private clockElement: HTMLElement | null;
    private intervalId: ReturnType<typeof setInterval> | null;
    private format: string | null = null;

    constructor() {
        this.clockElement = document.getElementById('clock');
        this.intervalId = null;

        if (this.clockElement) {
            this.start();
        }
    }

    start(): void {
        this.updateTime();
        this.intervalId = setInterval(() => this.updateTime(), 1000);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    updateTime(): void {
        if (!this.clockElement) return;

        const now = new Date();
        const time = now.toLocaleTimeString('cs-CZ');
        this.clockElement.textContent = time;
    }

    setFormat(format: string): void {
        this.format = format;
        this.updateTime();
    }
}
