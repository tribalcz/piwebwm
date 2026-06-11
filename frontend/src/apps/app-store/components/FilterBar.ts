import { getIcon } from '@utils/Icons';

export type FilterType = 'all' | 'app' | 'notepad-module';

export interface FilterState {
    query: string;
    type: FilterType;
}

export interface FilterBarCallbacks {
    onChange: (state: FilterState) => void;
}

const SEGMENTS: { type: FilterType; label: string }[] = [
    { type: 'all', label: 'All' },
    { type: 'app', label: 'Applications' },
    { type: 'notepad-module', label: 'Modules' },
];

/** Search field plus a segmented type filter. */
export class FilterBar {
    private container: Element;
    private callbacks: FilterBarCallbacks;
    private query = '';
    private type: FilterType = 'all';

    constructor(container: Element, callbacks: FilterBarCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.render();
        this.setupEventListeners();
    }

    private render(): void {
        const segments = SEGMENTS.map(s =>
            `<button class="store-segment${s.type === this.type ? ' active' : ''}" data-type="${s.type}">${s.label}</button>`
        ).join('');

        this.container.innerHTML = `
            <div class="store-filterbar">
                <div class="store-search">
                    <span class="store-search-icon">${getIcon('search', 16)}</span>
                    <input type="text" class="store-search-input" placeholder="Search…" autocomplete="off" />
                </div>
                <div class="store-segments">${segments}</div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        const input = this.container.querySelector<HTMLInputElement>('.store-search-input');
        input?.addEventListener('input', () => {
            this.query = input.value;
            this.emit();
        });

        this.container.querySelectorAll<HTMLElement>('.store-segment').forEach(btn => {
            btn.addEventListener('click', () => {
                this.type = (btn.dataset.type as FilterType) ?? 'all';
                this.container.querySelectorAll('.store-segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.emit();
            });
        });
    }

    private emit(): void {
        this.callbacks.onChange({ query: this.query, type: this.type });
    }
}
