import type { Store } from '@core/Store';
import type { EventBus } from '@core/EventBus';

export type ThemeName = 'light' | 'dark';
export type BackgroundPreset = 'default' | 'ocean' | 'forest' | 'sunset';

const THEME_KEY = 'settings.appearance.theme';
const BACKGROUND_KEY = 'settings.appearance.background';
const DRAG_OPACITY_KEY = 'settings.appearance.windowDragOpacity';

export const BACKGROUND_PRESETS: BackgroundPreset[] = ['default', 'ocean', 'forest', 'sunset'];

/** Window-drag opacity bounds (1 = opaque). */
export const DRAG_OPACITY_MIN = 0.5;
export const DRAG_OPACITY_MAX = 1;
export const DRAG_OPACITY_DEFAULT = 0.9;

/**
 * Applies the visual theme. Theming is implemented purely with CSS custom
 * properties (see the token block in style.css): this manager only flips
 * data-theme / data-background attributes on <html> and persists the choice.
 * Because the tokens cascade from the root, every window, the taskbar, menus
 * and overlays follow automatically — no WindowManager involvement needed.
 */
export class ThemeManager {
    private store: Store | null;
    private eventBus: EventBus | null;

    constructor(store: Store | null = null, eventBus: EventBus | null = null) {
        this.store = store;
        this.eventBus = eventBus;
    }

    /** Apply the persisted (or default) theme. Call early, before first paint. */
    init(): void {
        this.apply(this.getTheme(), this.getBackground());
        this.applyWindowDragOpacity(this.getWindowDragOpacity());
        console.log(`ThemeManager initialized (theme: ${this.getTheme()}, background: ${this.getBackground()})`);
    }

    getTheme(): ThemeName {
        const value = this.store?.get<ThemeName>(THEME_KEY, 'light') ?? 'light';
        return value === 'dark' ? 'dark' : 'light';
    }

    setTheme(theme: ThemeName): void {
        this.store?.set(THEME_KEY, theme);
        this.apply(theme, this.getBackground());
        this.eventBus?.emit('theme:changed', { theme });
    }

    getBackground(): BackgroundPreset {
        const value = this.store?.get<BackgroundPreset>(BACKGROUND_KEY, 'default') ?? 'default';
        return BACKGROUND_PRESETS.includes(value) ? value : 'default';
    }

    setBackground(preset: BackgroundPreset): void {
        this.store?.set(BACKGROUND_KEY, preset);
        this.apply(this.getTheme(), preset);
    }

    /** Opacity applied to a window while it is being dragged (0.5–1). */
    getWindowDragOpacity(): number {
        const value = this.store?.get<number>(DRAG_OPACITY_KEY, DRAG_OPACITY_DEFAULT) ?? DRAG_OPACITY_DEFAULT;
        return clampOpacity(value);
    }

    setWindowDragOpacity(value: number): void {
        const v = clampOpacity(value);
        this.store?.set(DRAG_OPACITY_KEY, v);
        this.applyWindowDragOpacity(v);
    }

    private applyWindowDragOpacity(value: number): void {
        document.documentElement.style.setProperty('--window-drag-opacity', String(value));
    }

    private apply(theme: ThemeName, background: BackgroundPreset): void {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.dataset.theme = 'dark';
        } else {
            delete root.dataset.theme;
        }

        if (background !== 'default') {
            root.dataset.background = background;
        } else {
            delete root.dataset.background;
        }
    }
}

function clampOpacity(value: number): number {
    if (!Number.isFinite(value)) return DRAG_OPACITY_DEFAULT;
    return Math.min(DRAG_OPACITY_MAX, Math.max(DRAG_OPACITY_MIN, value));
}
