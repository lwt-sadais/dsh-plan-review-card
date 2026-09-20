import { type SidebarContext } from './sidebar-bridge.js';
/** Slot registry face used by the plugin: keyed tool views plus list-slot dock entries. */
interface SlotRegistry {
    inject(name: string, factory: () => unknown): void;
    register<P>(options: {
        name: string;
        key?: string;
        id?: string;
        order?: number;
    }, component: (props: P) => JSX.Element | null): unknown;
}
interface ClientContext extends SidebarContext {
    slots: SlotRegistry;
    sessions: {
        list: {
            getSnapshot(): {
                current?: string;
            };
            subscribe(listener: () => void): () => void;
        };
    };
    effect(callback: () => () => void, label: string): () => void;
}
/** Register the keyed card renderer, the composer toolbar entry, and the optional unified-sidebar result page. */
export declare function apply(ctx: ClientContext): void;
export declare const inject: string[];
export {};
