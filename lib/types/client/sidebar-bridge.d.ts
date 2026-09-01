import type { ComponentType } from 'react';
export declare const RESULT_TAB_TYPE = "dsh-plan-review-card:result";
export interface ResultTabMeta {
    callId: string;
}
export interface ResultTabProps {
    scope: {
        sessionId: string;
    };
    tab: {
        id: string;
        title: string;
        meta?: unknown;
    };
    visible: boolean;
}
interface ResultTabSeed {
    type: string;
    id: string;
    title: string;
    meta: ResultTabMeta;
}
interface BetterSidebarService {
    registerTab(descriptor: {
        id: string;
        title: string;
        hidden: boolean;
        dedupeKey: (tab: {
            id: string;
        }) => string;
        component: ComponentType<ResultTabProps>;
    }): () => void;
    getTab(id: string): unknown;
    isTabEnabled(id: string): boolean;
    openTab(seed: ResultTabSeed, scope?: {
        sessionId: string;
    }): void;
}
export interface SidebarContext {
    get?(name: string): unknown;
    inject?(services: string[], callback: (ctx: SidebarContext & {
        betterSidebar: BetterSidebarService;
    }) => void): void;
    effect?(callback: () => () => void, label: string): unknown;
}
/** Validate the only persisted result-tab payload: a durable tool call identity. */
export declare function resultCallId(meta: unknown): string | undefined;
/** Register the hidden result tab whenever the optional better-sidebar service is composed. */
export declare function registerResultSidebar(ctx: SidebarContext, component: ComponentType<ResultTabProps>): void;
/** Open one card in the current session's unified sidebar, or report capability absence. */
export declare function openResultSidebar(ctx: SidebarContext, sessionId: string, callId: string, title: string): boolean;
export {};
