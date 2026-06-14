import type { Store } from '@core/Store';

const FORMAT_KEY = 'settings.clock.format'; // '24h' | '12h'
const SECONDS_KEY = 'settings.clock.showSeconds';

export class Clock {
    private clockElement: HTMLElement | null;
    private intervalId: ReturnType<typeof setInterval> | null;
    private store: Store | null;

    constructor(store: Store | null = null) {
        this.clockElement = document.getElementById('clock');
        this.intervalId = null;
        this.store = store;

        // Re-render immediately when clock settings change.
        this.store?.subscribe(FORMAT_KEY, () => this.updateTime());
        this.store?.subscribe(SECONDS_KEY, () => this.updateTime());

        if (this.clockElement) {
            this.start();
        }
    }

    start(): void {
        if (this.intervalId) return; // already ticking
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

        const use12h = this.store?.get<string>(FORMAT_KEY, '24h') === '12h';
        const showSeconds = this.store?.get<boolean>(SECONDS_KEY, true) ?? true;

        const options: Intl.DateTimeFormatOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: use12h,
        };
        if (showSeconds) {
            options.second = '2-digit';
        }

        const now = new Date();
        this.clockElement.textContent = now.toLocaleTimeString('cs-CZ', options);
    }
}
