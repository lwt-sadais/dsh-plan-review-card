/**
 * Native right-sidebar bridge: DSH 0.2.x exposes `ctx.sidebarRightTabs` for tab
 * types and `ctx.sidebarRight` for navigation. A card becomes one deduped
 * resource tab so repeated clicks focus the same occurrence, and the tab body
 * reuses the same result view as the legacy unified sidebar.
 */
import { type ComponentType } from 'react';
import type { ResultTabProps, SidebarContext } from './sidebar-bridge.js';
/** Identity of the native tab type; also the key its body registers under. */
export declare const NATIVE_RESULT_TAB_ID = "dsh-plan-review-card/result";
/** Kind recorded in the right-sidebar layout for every result tab. */
export declare const NATIVE_RESULT_TAB_KIND = "plan-review-card";
/** Resource address prefix that gives every card its own dedupe key. */
export declare const NATIVE_RESULT_ADDRESS_PREFIX = "dsh-resource://plan-review-card/";
/** Slot registry face needed to register the native tab body. */
export interface NativeSlotRegistry {
    inject(name: string, factory: () => unknown): (() => void) | void;
    register<P>(options: {
        name: string;
        key?: string;
        inject?: (sessionId: string) => Record<string, unknown>;
    }, component: ComponentType<P>): unknown;
}
/** Tab record fields the native body reads through the injected hook. */
export interface NativeTabInfo {
    tab: {
        id: string;
        kind: string;
        contentId: string;
        title: string;
        visible: boolean;
        navigation?: {
            params?: unknown;
        } | undefined;
    };
}
/** Props the native body receives from the slot runtime and its inject callback. */
export interface NativeResultTabProps {
    sessionId: string;
    useTabInfo: () => NativeTabInfo;
}
/** Build the per-card resource address that makes each card its own deduped tab. */
export declare function resultResourceAddress(sessionId: string, callId: string): string;
/** Decode one result resource address, or report that it is not one. */
export declare function parseResultResource(address: string): {
    sessionId: string;
    callId: string;
} | undefined;
/** Read the card identity from navigation params first, then from the restored address. */
export declare function nativeCallIdOf(tab: NativeTabInfo['tab']): string | undefined;
/**
 * Register the native result tab type and body when the right sidebar is
 * composed. The optional injection keeps older harness generations, which have
 * neither service, on their existing fallbacks.
 * @param ctx - the client plugin context carrying optional service injection.
 * @param slots - the slot registry used for the tab body seat.
 * @param view - the result view shared with the legacy unified sidebar.
 * @param titleOf - resolves a live card title for the tab chip.
 */
export declare function registerNativeResultSidebar(ctx: SidebarContext, slots: NativeSlotRegistry, view: ComponentType<ResultTabProps>, titleOf?: (sessionId: string, callId: string) => string | undefined): void;
/**
 * Open one card as a resource tab in the native right sidebar.
 * @param ctx - the client context that may provide `sidebarRight`.
 * @param sessionId - the conversation owning the card.
 * @param callId - the durable tool-call identity of the card.
 * @returns true when the native navigation accepted the tab, false to fall back.
 */
export declare function openNativeResultSidebar(ctx: SidebarContext, sessionId: string, callId: string): boolean;
