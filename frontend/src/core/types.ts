import type { WindowManager } from '@core/WindowManager';
import type { EventBus } from '@core/EventBus';
import type { Store } from '@core/Store';

/**
 * Application manifest (src/apps/<id>/meta/manifest.json)
 */
export interface AppManifest {
    id: string;
    name: string;
    version: string;
    entryPoint: string;
    description?: string;
    author?: string;
    styles?: string[];
    permissions?: string[];
    dependencies?: Record<string, string>;
    status?: string;
    enabled?: boolean;
    /** Whether the app can be uninstalled from the App Store. Defaults to true. */
    removable?: boolean;
    ui?: {
        displayName?: string;
        icon?: string;
        category?: string;
        keywords?: string[];
    };
    window?: {
        defaultWidth?: number;
        defaultHeight?: number;
        minWidth?: number;
        minHeight?: number;
        resizable?: boolean;
        persistent?: boolean;
    };
}

/**
 * Context handed to every application on launch
 */
export interface AppContext {
    windowManager: WindowManager;
    manifest: AppManifest;
    eventBus: EventBus | null;
    store: Store | null;
    logger: Console;
    appId: string;
}

/**
 * Lifecycle contract every application may implement
 */
export interface WebDeskApp {
    init?(): void | Promise<void>;
    open?(): void | Promise<void>;
    close?(): void | Promise<void>;
}

/**
 * Shape of an application's entry-point default export
 */
export type WebDeskAppConstructor = new (context: AppContext) => WebDeskApp;

/**
 * Window creation config
 */
export interface WindowConfig {
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    persistent?: boolean;
    onCreated?: (id: string, element: HTMLElement) => void;
}

/**
 * Internal record kept by WindowManager for each window
 */
export interface WindowData {
    element: HTMLDivElement;
    config: WindowConfig;
    taskbarButton: HTMLButtonElement;
    minimized: boolean;
    maximized: boolean;
    originalPos: {
        left: string;
        top: string;
        width: string;
        height: string;
    } | null;
}

/**
 * Known system events and their payloads.
 * Apps may emit their own events; those fall back to an `unknown` payload.
 */
export interface WebDeskEventMap {
    'window:created': { windowId: string; title: string; x: number; y: number };
    'window:focused': { windowId: string };
    'window:minimized': { windowId: string };
    'window:maximized': { windowId: string };
    'window:restored': { windowId: string };
    'window:closed': { windowId: string };
    'app:launching': { appId: string; manifest: AppManifest };
    'app:launched': { appId: string; manifest: AppManifest; timestamp: number };
    'app:closing': { appId: string };
    'app:closed': { appId: string; timestamp: number };
    'app:opened': { appId: string; windowId: string };
    'app:error': { appId: string; error: string; phase: 'launch' | 'close'; timestamp: number };
    'app:installed': { appId: string };
    'app:uninstalled': { appId: string };
    'theme:changed': { theme: 'light' | 'dark' };
    'error': { event: string; error: unknown; data: unknown };
}

/** Known event names keep autocomplete; arbitrary strings stay allowed for app-defined events. */
export type EventName = keyof WebDeskEventMap | (string & {});

/** Payload for a known event, `unknown` for app-defined ones. */
export type EventPayload<E extends EventName> =
    E extends keyof WebDeskEventMap ? WebDeskEventMap[E] : unknown;
