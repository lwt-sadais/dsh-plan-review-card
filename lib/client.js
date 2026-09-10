window.__ModuleLoader__.load({ id: "dsh-plan-review-card", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react);
let react_dom = require("react-dom");
react_dom = __toESM(react_dom);
let react_dom_client = require("react-dom/client");
react_dom_client = __toESM(react_dom_client);
let __deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
__deepseek_ai_dsh_client_ui_primitives = __toESM(__deepseek_ai_dsh_client_ui_primitives);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/contract.ts
const RESULT_CARD_TOOL = "present_result_card";
/** Display labels for the three structured-result categories. */
const RESULT_KIND_LABELS = {
	plan: "实施方案",
	evaluation: "评估报告",
	report: "分析报告"
};
/** Title fallback when card arguments cannot be parsed at all. */
const FALLBACK_CARD_TITLE = "结构化结果";
/** Review-status presentation shared by the replay client and the host card route. */
const WAITING_STATUS = "等待审查";
const INTERRUPTED_STATUS = "审查中断";
const INCOMPLETE_STATUS = "审查未完成";
const REVIEW_OUTCOME_STATUS = {
	approved: "已批准",
	rejected: "已拒绝",
	"adjustment-requested": "需调整",
	cancelled: "已取消"
};
/** Normalize parsed card arguments into the replay-stable view the UI renders. */
function normalizeCardArgs(value) {
	const kind = value.kind === "plan" || value.kind === "evaluation" || value.kind === "report" ? value.kind : "report";
	return {
		kind,
		title: typeof value.title === "string" && value.title.trim() !== "" ? value.title : RESULT_KIND_LABELS[kind],
		summary: typeof value.summary === "string" ? value.summary : "",
		content: typeof value.content === "string" ? value.content : ""
	};
}

//#endregion
//#region src/client/result-registry.ts
/** Build the collision-free in-memory identity of one session-owned result card. */
function recordKey(sessionId, callId) {
	return JSON.stringify([sessionId, callId]);
}
/** In-memory bridge between durable ToolRow models and better-sidebar tab views. */
var ResultCardRegistry = class {
	entries = /* @__PURE__ */ new Map();
	changeListeners = /* @__PURE__ */ new Set();
	/** Publish the latest replay-derived model and notify the corresponding sidebar view. */
	publish(sessionId, callId, record) {
		const key = recordKey(sessionId, callId);
		const current = this.entries.get(key);
		if (current === void 0) {
			this.entries.set(key, {
				sessionId,
				callId,
				record,
				listeners: /* @__PURE__ */ new Set()
			});
			this.notifyChanges();
			return;
		}
		current.record = record;
		for (const listener of current.listeners) listener();
		this.notifyChanges();
	}
	/** Read the latest model for one session and tool-call identity. */
	get(sessionId, callId) {
		return this.entries.get(recordKey(sessionId, callId))?.record;
	}
	/** List the known cards of one session in first-known (message) order. */
	records(sessionId) {
		const refs = [];
		for (const entry of this.entries.values()) {
			if (entry.sessionId !== sessionId || entry.record === void 0) continue;
			refs.push({
				callId: entry.callId,
				record: entry.record
			});
		}
		return refs;
	}
	/** Subscribe to every registry mutation so list surfaces re-read their snapshot. */
	subscribeChanges(listener) {
		this.changeListeners.add(listener);
		return () => {
			this.changeListeners.delete(listener);
		};
	}
	/** Notify list surfaces after a mutation completes. */
	notifyChanges() {
		for (const listener of this.changeListeners) listener();
	}
	/** Subscribe to model changes for one sidebar result tab. */
	subscribe(sessionId, callId, listener) {
		const key = recordKey(sessionId, callId);
		let entry = this.entries.get(key);
		if (entry === void 0) {
			entry = {
				sessionId,
				callId,
				listeners: /* @__PURE__ */ new Set()
			};
			this.entries.set(key, entry);
		}
		entry.listeners.add(listener);
		return () => {
			entry?.listeners.delete(listener);
			if (entry !== void 0 && entry.listeners.size === 0 && entry.record === void 0) this.entries.delete(key);
		};
	}
	/** Remove a ToolRow-bound inspect callback while retaining its durable display model. */
	removeInspect(sessionId, callId, inspect) {
		const entry = this.entries.get(recordKey(sessionId, callId));
		if (entry?.record?.inspect !== inspect) return;
		const { inspect: _inspect,...record } = entry.record;
		entry.record = record;
		for (const listener of entry.listeners) listener();
		this.notifyChanges();
	}
	/** Clear all transient records and notify mounted views before lifecycle disposal. */
	clear() {
		for (const entry of this.entries.values()) {
			delete entry.record;
			for (const listener of entry.listeners) listener();
		}
		this.entries.clear();
		this.notifyChanges();
	}
};

//#endregion
//#region src/client/sidebar-bridge.ts
const RESULT_TAB_TYPE = "dsh-plan-review-card:result";
/** Validate the only persisted result-tab payload: a durable tool call identity. */
function resultCallId(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const callId = meta.callId;
	return typeof callId === "string" && callId !== "" ? callId : void 0;
}
/** Register the hidden result tab whenever the optional better-sidebar service is composed. */
function registerResultSidebar(ctx, component) {
	ctx.inject?.(["betterSidebar"], (sidebarCtx) => {
		sidebarCtx.effect?.(() => sidebarCtx.betterSidebar.registerTab({
			id: RESULT_TAB_TYPE,
			title: "结构化结果",
			hidden: true,
			dedupeKey: (tab) => tab.id,
			component
		}), "dsh-plan-review-card: result sidebar tab");
	});
}
/** Open one card in the current session's unified sidebar, or report capability absence. */
function openResultSidebar(ctx, sessionId, callId, title) {
	const sidebar = ctx.get?.("betterSidebar");
	if (sidebar === void 0 || sidebar.getTab(RESULT_TAB_TYPE) === void 0 || !sidebar.isTabEnabled(RESULT_TAB_TYPE)) return false;
	sidebar.openTab({
		type: RESULT_TAB_TYPE,
		id: `result-card:${callId}`,
		title,
		path: `result-card:${callId}`,
		meta: { callId }
	}, { sessionId });
	return true;
}

//#endregion
//#region src/client/index.tsx
const MARKDOWN_LABELS = {
	code: {
		copyLabel: "复制代码",
		copiedLabel: "已复制"
	},
	footnotes: "脚注"
};
const STYLE_ID = "dsh-plan-review-card";
const PANEL_WIDTH_STORAGE_KEY = "dsh-plan-review-card:panel-width";
const DEFAULT_PANEL_WIDTH = 480;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 760;
const PANEL_VIEWPORT_RATIO = .65;
const PANEL_WIDTH_STEP = 24;
const PANEL_OPEN_EVENT = "dsh-plan-review-card:open-panel";
const REMOTE_OPEN_EVENT = "dsh-plan-review-card:remote-open";
const CARDS_ROUTE = "/plan-review-card/api/cards";
const LIST_POSITION_STORAGE_KEY = "dsh-plan-review-card:list-position";
/** The official session-log export capsule (CSS Modules hash prefix may drift; match the stable suffix). */
const SESSION_LOG_BUTTON_SELECTOR = "button[class*=\"sessionLogButton\"]";
/** Horizontal gap between the quick finder and the Session-log capsule when anchored. */
const FAB_ANCHOR_GAP = 8;
/** Fallback interval for re-reading the anchored capsule's geometry. */
const FAB_ANCHOR_POLL_INTERVAL = 600;
const STYLE_TEXT = `
.dprc-card{margin:4px 16px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-primary)}
.dprc-card[data-state="waiting"]{border-color:var(--dsw-alias-state-warn-secondary)}
.dprc-card[data-state="approved"]{border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l1))}
.dprc-summary-row{display:flex;min-height:52px;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;outline:none}
.dprc-summary-row:hover,.dprc-summary-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dprc-icon{display:grid;width:28px;height:28px;flex:none;place-items:center;border-radius:8px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:15px}
.dprc-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.dprc-heading{display:flex;align-items:center;gap:7px;min-width:0}
.dprc-kind{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px}.dprc-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.dprc-status{flex:none;border-radius:999px;padding:2px 8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}
.dprc-card[data-state="waiting"] .dprc-status{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary)}.dprc-card[data-state="approved"] .dprc-status{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dprc-card[data-state="adjustment-requested"] .dprc-status,.dprc-card[data-state="rejected"] .dprc-status,.dprc-card[data-state="failed"] .dprc-status{background:var(--dsw-alias-state-error-tertiary);color:var(--dsw-alias-state-error-primary)}.dprc-card[data-state="cancelled"] .dprc-status{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dprc-chevron{width:16px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center}.dprc-panel-layer{position:fixed;z-index:1000;top:0;right:0;height:100%;pointer-events:none}.dprc-panel{position:relative;display:flex;width:var(--dprc-panel-width);height:100%;pointer-events:auto;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);box-shadow:-12px 0 32px rgba(0,0,0,.14);animation:dprc-slide-in 180ms ease-out}.dprc-resize-handle{position:absolute;z-index:2;top:0;bottom:0;left:-5px;width:10px;cursor:col-resize;touch-action:none;outline:none}.dprc-resize-handle:after{position:absolute;top:50%;left:4px;width:3px;height:44px;border-radius:999px;background:var(--dsw-alias-border-l2);content:"";opacity:0;transform:translateY(-50%);transition:opacity 120ms ease}.dprc-resize-handle:hover:after,.dprc-resize-handle:focus-visible:after,.dprc-panel[data-resizing="true"] .dprc-resize-handle:after{opacity:1}
.dprc-panel-header{display:flex;min-height:72px;align-items:center;gap:12px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:12px 16px}.dprc-panel-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.dprc-panel-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:24px;text-overflow:ellipsis;white-space:nowrap}.dprc-panel-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.dprc-close{display:grid;width:44px;height:44px;flex:none;cursor:pointer;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:22px}.dprc-close:hover,.dprc-close:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dprc-markdown{min-height:0;flex:1;padding:20px 24px;overflow:auto;font-size:14px;line-height:24px}.dprc-actions{display:flex;flex:none;justify-content:flex-end;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding:12px 16px}.dprc-button{min-height:36px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:6px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px}.dprc-button-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:white}.dprc-button:hover{filter:brightness(.96)}
.dprc-sidebar{display:flex;width:100%;height:100%;min-height:0;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}.dprc-sidebar-header{display:flex;flex:none;align-items:center;gap:10px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:12px 14px}.dprc-sidebar-empty{display:grid;min-height:180px;place-items:center;padding:24px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:22px;text-align:center}
@keyframes dprc-slide-in{from{transform:translateX(24px);opacity:.72}to{transform:translateX(0);opacity:1}}@media(max-width:720px){.dprc-summary{display:none}.dprc-status{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dprc-panel-layer{left:0}.dprc-panel{width:100%;border-left:0}.dprc-resize-handle{display:none}.dprc-panel-header{padding-top:max(12px,env(safe-area-inset-top))}.dprc-markdown{padding:16px}.dprc-actions{flex-wrap:wrap;padding-bottom:max(12px,env(safe-area-inset-bottom))}.dprc-button-primary{width:100%}}@media(prefers-reduced-motion:reduce){.dprc-panel{animation:none}}
.dprc-fab-layer{position:fixed;z-index:26;left:var(--dprc-fab-left,auto);top:var(--dprc-fab-top,60px);right:var(--dprc-fab-right,12px);display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.dprc-fab-layer[data-anchored="true"]{right:auto}
.dprc-fab{position:relative;display:grid;width:40px;height:40px;place-items:center;cursor:pointer;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:16px;box-shadow:0 4px 16px rgba(0,0,0,.12)}
.dprc-fab:hover,.dprc-fab:focus-visible{filter:brightness(.96);outline:none}
.dprc-fab-badge{position:absolute;top:-6px;right:-6px;min-width:18px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-state-business-primary);color:#fff;font-size:11px;line-height:18px;text-align:center}
.dprc-fab-list{position:fixed;width:320px;max-height:min(60vh,480px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 8px 28px rgba(0,0,0,.16)}
.dprc-fab-list-header{display:flex;flex:none;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:10px 12px 10px 14px;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:grab;user-select:none;touch-action:none}
.dprc-fab-list-header:active{cursor:grabbing}
.dprc-fab-list-header[data-dragging="true"]{cursor:grabbing;background:var(--dsw-alias-interactive-bg-hover)}
.dprc-fab-list-reset{flex:none;cursor:pointer;border:0;border-radius:6px;padding:2px 6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px}
.dprc-fab-list-reset:hover,.dprc-fab-list-reset:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dprc-fab-items{margin:0;padding:4px;list-style:none;overflow-y:auto}
.dprc-fab-item{display:flex;width:100%;align-items:center;gap:10px;cursor:pointer;border:0;border-radius:10px;padding:8px 10px;background:transparent;color:inherit;font:inherit;text-align:left}
.dprc-fab-item:hover,.dprc-fab-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dprc-fab-item-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}
.dprc-fab-item-heading{display:flex;min-width:0;align-items:center;gap:7px}
.dprc-fab-item-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-fab-item-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:720px){.dprc-fab-list{width:min(320px,calc(100vw - 24px))}}
`;
let activeContext;
let activeRegistry;
/** Read the current conversation identity through the sessions list observable. */
function useCurrentSessionId() {
	const sessions = activeContext?.sessions;
	return (0, react.useSyncExternalStore)((0, react.useMemo)(() => sessions === void 0 ? () => () => {} : (listener) => sessions.list.subscribe(listener), [sessions]), (0, react.useCallback)(() => sessions?.list.getSnapshot().current, [sessions]));
}
/** Parse complete card arguments from a running or settled tool snapshot. */
function parseArgs(block) {
	const raw = "kind" in block ? block.call?.argsRaw : block.argsRaw;
	try {
		return normalizeCardArgs(JSON.parse(raw ?? ""));
	} catch {
		return {
			kind: "report",
			title: FALLBACK_CARD_TITLE,
			summary: "",
			content: ""
		};
	}
}
/** Parse the canonical review outcome from a settled tool result. */
function settledOutcome(block) {
	const text = block.content.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
	try {
		const value = JSON.parse(text);
		if (value.outcome === "approved" || value.outcome === "rejected" || value.outcome === "adjustment-requested" || value.outcome === "cancelled") return value.outcome;
	} catch {}
}
/** Derive one replay-stable card model from durable call and result data. */
function cardModel(block) {
	const args = parseArgs(block);
	if (!("kind" in block)) return {
		...args,
		state: "waiting",
		status: WAITING_STATUS
	};
	if (block.isError) return {
		...args,
		state: "failed",
		status: INTERRUPTED_STATUS
	};
	const outcome = settledOutcome(block);
	if (outcome === void 0) return {
		...args,
		state: "failed",
		status: INCOMPLETE_STATUS
	};
	return {
		...args,
		state: outcome,
		status: REVIEW_OUTCOME_STATUS[outcome]
	};
}
/** Focus DSH's authoritative question panel instead of duplicating its response transport. */
function focusReview() {
	const review = document.querySelector("[data-question-key], [data-plan-review-key]");
	if (review === null) return;
	review.scrollIntoView({
		behavior: "smooth",
		block: "center"
	});
	review.querySelector("button, textarea, input")?.focus();
}
/** Copy complete Markdown using the browser clipboard API. */
async function copyMarkdown(content) {
	await navigator.clipboard.writeText(content);
}
/** Download complete Markdown without requiring a Host filesystem permission. */
function downloadMarkdown(title, content) {
	const safeName = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "structured-result";
	const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${safeName}.md`;
	anchor.click();
	URL.revokeObjectURL(url);
}
/** Shared complete-result body used by the unified sidebar and Portal fallback. */
function ResultContent(props) {
	const { model, inspect, onReview } = props;
	const [copied, setCopied] = (0, react.useState)(false);
	/** Copy the report while keeping transient confirmation local to this view. */
	const copy = () => {
		copyMarkdown(model.content).then(() => {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		}).catch(() => setCopied(false));
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dprc-markdown",
		children: model.content === "" ? "无法读取完整内容。" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
			text: model.content,
			labels: MARKDOWN_LABELS
		})
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
		className: "dprc-actions",
		onClick: (event) => {
			event.stopPropagation();
		},
		children: [
			inspect !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dprc-button",
				onClick: inspect,
				children: "查看调用"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dprc-button",
				onClick: copy,
				children: copied ? "已复制" : "复制 Markdown"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dprc-button",
				onClick: () => {
					downloadMarkdown(model.title, model.content);
				},
				children: "导出 Markdown"
			}),
			model.state === "waiting" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dprc-button dprc-button-primary",
				onClick: onReview,
				children: "批准、拒绝或批注"
			})
		]
	})] });
}
/** Render one persisted better-sidebar result tab from the transient ToolRow registry. */
function ResultCardSidebarView({ scope, tab }) {
	const callId = resultCallId(tab.meta);
	const registry = activeRegistry;
	const record = (0, react.useSyncExternalStore)((0, react.useMemo)(() => (listener) => {
		if (registry === void 0 || callId === void 0) return () => {};
		return registry.subscribe(scope.sessionId, callId, listener);
	}, [
		registry,
		scope.sessionId,
		callId
	]), (0, react.useCallback)(() => {
		if (registry === void 0 || callId === void 0) return void 0;
		return registry.get(scope.sessionId, callId);
	}, [
		registry,
		scope.sessionId,
		callId
	]));
	if (record === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dprc-sidebar-empty",
		children: [
			"正在从会话记录恢复完整内容…",
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
			"请在消息流中加载或点击对应结果卡。"
		]
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dprc-sidebar",
		"aria-label": record.model.title,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
			className: "dprc-sidebar-header",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-icon",
					"aria-hidden": "true",
					children: "▤"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dprc-panel-copy",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-kind",
							children: RESULT_KIND_LABELS[record.model.kind]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-panel-title",
							children: record.model.title
						}),
						record.model.summary !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-panel-summary",
							children: record.model.summary
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-status",
					children: record.model.status
				})
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultContent, {
			model: record.model,
			inspect: record.inspect,
			onReview: focusReview
		})]
	});
}
/** Keep the desktop panel inside readable and interaction-safe viewport bounds. */
function clampPanelWidth(width) {
	const viewportMaximum = Math.floor(window.innerWidth * PANEL_VIEWPORT_RATIO);
	return Math.min(Math.max(width, MIN_PANEL_WIDTH), Math.min(MAX_PANEL_WIDTH, viewportMaximum));
}
/** Restore the last valid desktop width without trusting stale browser storage. */
function initialPanelWidth() {
	const saved = Number.parseFloat(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY) ?? "");
	return clampPanelWidth(Number.isFinite(saved) ? saved : DEFAULT_PANEL_WIDTH);
}
/** Shared slide-in reading panel: width memory, edge resize, and the complete-result body. */
function ResultPanel(props) {
	const { model, inspect, panelId, onReview, onClose } = props;
	const [panelWidth, setPanelWidth] = (0, react.useState)(initialPanelWidth);
	const [resizing, setResizing] = (0, react.useState)(false);
	const dragRef = (0, react.useRef)();
	const panelTitleId = panelId === void 0 ? void 0 : `${panelId}-title`;
	(0, react.useEffect)(() => {
		/** Keep Escape available without changing focus or blocking native input. */
		const closeFromEscape = (event) => {
			if (event.key === "Escape") onClose();
		};
		/** Re-clamp a saved or dragged width when the application viewport shrinks. */
		const fitToViewport = () => setPanelWidth((current) => clampPanelWidth(current));
		document.addEventListener("keydown", closeFromEscape);
		window.addEventListener("resize", fitToViewport);
		return () => {
			document.removeEventListener("keydown", closeFromEscape);
			window.removeEventListener("resize", fitToViewport);
		};
	}, [onClose]);
	/** Start pointer-captured resizing from the panel's left edge. */
	const startResize = (event) => {
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startWidth: panelWidth
		};
		event.currentTarget.setPointerCapture(event.pointerId);
		setResizing(true);
	};
	/** Resize leftward to grow and rightward to shrink within safe viewport bounds. */
	const resize = (event) => {
		const drag = dragRef.current;
		if (drag === void 0 || drag.pointerId !== event.pointerId) return;
		setPanelWidth(clampPanelWidth(drag.startWidth + drag.startX - event.clientX));
	};
	/** Persist the final width when pointer capture ends. */
	const finishResize = (event) => {
		const drag = dragRef.current;
		if (drag === void 0 || drag.pointerId !== event.pointerId) return;
		const next = clampPanelWidth(drag.startWidth + drag.startX - event.clientX);
		dragRef.current = void 0;
		setPanelWidth(next);
		setResizing(false);
		window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next));
	};
	/** Support keyboard resizing and a predictable Home reset. */
	const resizeFromKeyboard = (event) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
		event.preventDefault();
		const next = event.key === "Home" ? clampPanelWidth(DEFAULT_PANEL_WIDTH) : clampPanelWidth(panelWidth + (event.key === "ArrowLeft" ? PANEL_WIDTH_STEP : -PANEL_WIDTH_STEP));
		setPanelWidth(next);
		window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next));
	};
	/** Restore the default width from the resize handle. */
	const resetPanelWidth = () => {
		const next = clampPanelWidth(DEFAULT_PANEL_WIDTH);
		setPanelWidth(next);
		window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next));
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dprc-panel-layer",
		style: { "--dprc-panel-width": `${panelWidth}px` },
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
			id: panelId,
			className: "dprc-panel",
			role: "complementary",
			"aria-labelledby": panelTitleId,
			"aria-label": model.title,
			"data-resizing": resizing || void 0,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dprc-resize-handle",
					role: "separator",
					tabIndex: 0,
					"aria-label": "调整完整内容侧栏宽度",
					"aria-orientation": "vertical",
					"aria-valuemin": MIN_PANEL_WIDTH,
					"aria-valuemax": Math.min(MAX_PANEL_WIDTH, Math.floor(window.innerWidth * PANEL_VIEWPORT_RATIO)),
					"aria-valuenow": Math.round(panelWidth),
					onPointerDown: startResize,
					onPointerMove: resize,
					onPointerUp: finishResize,
					onPointerCancel: finishResize,
					onKeyDown: resizeFromKeyboard,
					onDoubleClick: resetPanelWidth
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "dprc-panel-header",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-icon",
							"aria-hidden": "true",
							children: "▤"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dprc-panel-copy",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dprc-kind",
									children: RESULT_KIND_LABELS[model.kind]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									id: panelTitleId,
									className: "dprc-panel-title",
									children: model.title
								}),
								model.summary !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dprc-panel-summary",
									children: model.summary
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-status",
							children: model.status
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dprc-close",
							"aria-label": "关闭完整内容",
							onClick: onClose,
							children: "×"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultContent, {
					model,
					inspect,
					onReview
				})
			]
		})
	});
}
/** Render a persistent structured-result card that opens its complete content in a side panel. */
function ResultCard({ block, inspect }) {
	const model = (0, react.useMemo)(() => cardModel(block), [block]);
	const sessionId = useCurrentSessionId();
	const [open, setOpen] = (0, react.useState)(false);
	const panelId = `dprc-panel-${block.callId}`;
	(0, react.useEffect)(() => {
		const registry = activeRegistry;
		if (registry === void 0 || sessionId === void 0) return;
		registry.publish(sessionId, block.callId, {
			model,
			...inspect === void 0 ? {} : { inspect }
		});
		return () => {
			if (inspect !== void 0) registry.removeInspect(sessionId, block.callId, inspect);
		};
	}, [
		sessionId,
		block.callId,
		model,
		inspect
	]);
	/** Open this card in the unified sidebar, falling back to the legacy Portal. */
	const showPanel = () => {
		if (sessionId !== void 0 && activeContext !== void 0 && openResultSidebar(activeContext, sessionId, block.callId, model.title)) return;
		window.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: block.callId }));
		setOpen(true);
	};
	/** Close the side panel without stealing focus from the conversation composer. */
	const closePanel = () => setOpen(false);
	/** Open the side panel from keyboard activation keys. */
	const openFromKeyboard = (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		showPanel();
	};
	(0, react.useEffect)(() => {
		/** Keep only one result panel visible across all persistent card instances. */
		const closeForAnotherCard = (event) => {
			if (event.detail !== block.callId) setOpen(false);
		};
		window.addEventListener(PANEL_OPEN_EVENT, closeForAnotherCard);
		return () => window.removeEventListener(PANEL_OPEN_EVENT, closeForAnotherCard);
	}, [block.callId]);
	(0, react.useEffect)(() => {
		/** Reveal this card when the floating quick finder targets it. */
		const openFromFinder = (event) => {
			if (event.detail !== block.callId) return;
			setOpen(true);
		};
		window.addEventListener(REMOTE_OPEN_EVENT, openFromFinder);
		return () => window.removeEventListener(REMOTE_OPEN_EVENT, openFromFinder);
	}, [block.callId]);
	const panel = open ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultPanel, {
		panelId,
		model,
		inspect,
		onClose: closePanel,
		onReview: () => {
			setOpen(false);
			window.setTimeout(focusReview, 0);
		}
	}), document.body) : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "dprc-card",
		"data-state": model.state,
		"data-tool": RESULT_CARD_TOOL,
		"data-dprc-call-id": block.callId,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dprc-summary-row",
			role: "button",
			tabIndex: 0,
			"aria-controls": panelId,
			"aria-expanded": open,
			onClick: showPanel,
			onKeyDown: openFromKeyboard,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-icon",
					"aria-hidden": "true",
					children: "▤"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dprc-copy",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dprc-heading",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-kind",
							children: RESULT_KIND_LABELS[model.kind]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-title",
							children: model.title
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dprc-summary",
						children: model.summary || "点击查看完整内容"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-status",
					children: model.status
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-chevron",
					"aria-hidden": "true",
					children: "›"
				})
			]
		}), panel]
	});
}
/** Install card styles once for the plugin lifecycle. */
function installStyle() {
	if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {};
	const style = document.createElement("style");
	style.dataset.pluginCss = STYLE_ID;
	style.textContent = STYLE_TEXT;
	document.head.appendChild(style);
	return () => style.remove();
}
/** Read a persisted viewport position without trusting stale or malformed storage. */
function loadFloatingPosition(key) {
	try {
		const saved = JSON.parse(window.localStorage.getItem(key) ?? "");
		if (typeof saved?.left !== "number" || !Number.isFinite(saved.left) || typeof saved.top !== "number" || !Number.isFinite(saved.top)) return void 0;
		return {
			left: saved.left,
			top: saved.top
		};
	} catch {
		return;
	}
}
/** Persist one viewport position, clamped inside the current viewport. */
function saveFloatingPosition(key, position) {
	const clamped = {
		left: Math.min(Math.max(position.left, 8), Math.max(window.innerWidth - 56, 8)),
		top: Math.min(Math.max(position.top, 8), Math.max(window.innerHeight - 56, 8))
	};
	window.localStorage.setItem(key, JSON.stringify(clamped));
}
/** Drop the persisted geometry so the surface returns to its anchored placement. */
function clearFloatingPosition(key) {
	window.localStorage.removeItem(key);
}
/** Clamp a list position so its window stays reachable inside the viewport. */
function clampListPosition(position, listWidth, listHeight) {
	return {
		left: Math.min(Math.max(position.left, 8), Math.max(window.innerWidth - listWidth - 8, 8)),
		top: Math.min(Math.max(position.top, 8), Math.max(window.innerHeight - Math.min(listHeight, window.innerHeight - 16) - 8, 8))
	};
}
/**
* Track the Session-log export capsule's viewport geometry — the quick finder
* anchors to its left edge. Polling covers layout shifts that neither
* ResizeObserver nor window resize reports (sidebar toggles repaint the
* header without resizing it).
*/
function useSessionLogAnchor(enabled) {
	const [anchor, setAnchor] = (0, react.useState)();
	(0, react.useEffect)(() => {
		if (!enabled) return;
		/** Read the capsule's rect and mirror it into finder coordinates. */
		const read = () => {
			const capsule = document.querySelector(SESSION_LOG_BUTTON_SELECTOR);
			if (capsule === null) {
				setAnchor(void 0);
				return;
			}
			const rect = capsule.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) {
				setAnchor(void 0);
				return;
			}
			setAnchor({
				left: rect.left - 40 - FAB_ANCHOR_GAP,
				top: rect.top + (rect.height - 40) / 2
			});
		};
		read();
		const observer = new ResizeObserver(read);
		if (document.querySelector(SESSION_LOG_BUTTON_SELECTOR) !== null) observer.observe(document.querySelector(SESSION_LOG_BUTTON_SELECTOR));
		const interval = window.setInterval(read, FAB_ANCHOR_POLL_INTERVAL);
		window.addEventListener("resize", read);
		return () => {
			observer.disconnect();
			window.clearInterval(interval);
			window.removeEventListener("resize", read);
		};
	}, [enabled]);
	return anchor;
}
/** Session-keyed guard so repeated opens never duplicate the durable backfill fetch. */
const backfillInFlight = /* @__PURE__ */ new Set();
/** Backfill durable cards the conversation has not mounted yet from the host route. */
async function backfillHostCards(sessionId) {
	const registry = activeRegistry;
	if (registry === void 0 || backfillInFlight.has(sessionId)) return;
	backfillInFlight.add(sessionId);
	try {
		const response = await fetch(CARDS_ROUTE, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ sessionId })
		});
		if (!response.ok) return;
		const data = await response.json();
		for (const card of data.cards ?? []) {
			if (typeof card.callId !== "string" || card.callId === "") continue;
			if (registry.get(sessionId, card.callId) !== void 0) continue;
			const model = card.model;
			if (typeof model?.title !== "string" || typeof model.content !== "string") continue;
			const kind = model.kind === "plan" || model.kind === "evaluation" || model.kind === "report" ? model.kind : "report";
			const state = model.state === "waiting" || model.state === "failed" || model.state === "approved" || model.state === "rejected" || model.state === "adjustment-requested" || model.state === "cancelled" ? model.state : "waiting";
			registry.publish(sessionId, card.callId, { model: {
				kind,
				title: model.title,
				summary: typeof model.summary === "string" ? model.summary : "",
				content: model.content,
				state,
				status: typeof model.status === "string" ? model.status : WAITING_STATUS
			} });
		}
	} catch {} finally {
		backfillInFlight.delete(sessionId);
	}
}
/** Floating quick finder anchored left of the Session-log capsule, listing every known card. */
function FloatingCardList() {
	const registry = activeRegistry;
	const sessionId = useCurrentSessionId();
	const [open, setOpen] = (0, react.useState)(false);
	const [entries, setEntries] = (0, react.useState)([]);
	const [panelCallId, setPanelCallIdState] = (0, react.useState)();
	const panelCallIdRef = (0, react.useRef)();
	/** Free position the user dragged the list to; undefined = pop up under the finder. */
	const [freeList, setFreeList] = (0, react.useState)(() => loadFloatingPosition(LIST_POSITION_STORAGE_KEY));
	const [draggingList, setDraggingList] = (0, react.useState)(false);
	const listRef = (0, react.useRef)(null);
	const dragRef = (0, react.useRef)();
	const anchor = useSessionLogAnchor(true);
	/** Keep the ref aligned so panel-exclusivity listeners always read the live value. */
	const setPanelCallId = (0, react.useCallback)((callId) => {
		panelCallIdRef.current = callId;
		setPanelCallIdState(callId);
	}, []);
	/** Re-read the registry snapshot on every mutation and session switch. */
	const sync = (0, react.useCallback)(() => {
		if (registry === void 0) return;
		setEntries(registry.records(sessionId ?? "").map((ref) => ({
			callId: ref.callId,
			model: ref.record.model
		})));
	}, [registry, sessionId]);
	(0, react.useEffect)(() => {
		if (registry === void 0) return;
		sync();
		return registry.subscribeChanges(sync);
	}, [registry, sync]);
	(0, react.useEffect)(() => {
		if (sessionId === void 0) return;
		/** Fill the list with durable history even before the message rows mount. */
		backfillHostCards(sessionId);
	}, [sessionId]);
	(0, react.useEffect)(() => {
		if (!open) return;
		/** Close the dropdown on outside presses or Escape without stealing focus. */
		const closeOnOutsidePointer = (event) => {
			if (event.target?.closest?.("[data-dprc-floating]") === null) setOpen(false);
		};
		const closeFromEscape = (event) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsidePointer);
		document.addEventListener("keydown", closeFromEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
			document.removeEventListener("keydown", closeFromEscape);
		};
	}, [open]);
	(0, react.useEffect)(() => {
		/** Card-row panels outrank the finder panel: close when any other panel opens. */
		const closeForCardPanel = (event) => {
			if (event.detail !== panelCallIdRef.current) setPanelCallId(void 0);
		};
		window.addEventListener(PANEL_OPEN_EVENT, closeForCardPanel);
		return () => window.removeEventListener(PANEL_OPEN_EVENT, closeForCardPanel);
	}, [setPanelCallId]);
	/** Start dragging the list from its header with pointer capture. */
	const startListDrag = (event) => {
		const list = listRef.current;
		if (list === null || event.button !== 0) return;
		const rect = list.getBoundingClientRect();
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			baseLeft: rect.left,
			baseTop: rect.top
		};
		event.currentTarget.setPointerCapture(event.pointerId);
		setDraggingList(true);
	};
	/** Move the list freely within viewport-safe bounds while dragging. */
	const moveListDrag = (event) => {
		const drag = dragRef.current;
		const list = listRef.current;
		if (drag === void 0 || list === null || drag.pointerId !== event.pointerId) return;
		const rect = list.getBoundingClientRect();
		const next = clampListPosition({
			left: drag.baseLeft + event.clientX - drag.startX,
			top: drag.baseTop + event.clientY - drag.startY
		}, rect.width, rect.height);
		list.style.left = `${next.left}px`;
		list.style.top = `${next.top}px`;
	};
	/** Persist the final free position when the drag ends. */
	const finishListDrag = (event) => {
		const drag = dragRef.current;
		const list = listRef.current;
		if (drag === void 0 || list === null || drag.pointerId !== event.pointerId) return;
		dragRef.current = void 0;
		setDraggingList(false);
		const rect = list.getBoundingClientRect();
		const next = clampListPosition({
			left: rect.left,
			top: rect.top
		}, rect.width, rect.height);
		setFreeList(next);
		saveFloatingPosition(LIST_POSITION_STORAGE_KEY, next);
	};
	/** Drop the persisted list geometry and pop the list back under the finder. */
	const resetListPosition = () => {
		dragRef.current = void 0;
		setDraggingList(false);
		setFreeList(void 0);
		clearFloatingPosition(LIST_POSITION_STORAGE_KEY);
	};
	/** Open one card: sidebar first, then reveal the mounted row, else read in place. */
	const openCard = (0, react.useCallback)((entry) => {
		setOpen(false);
		if (sessionId !== void 0 && activeContext !== void 0 && openResultSidebar(activeContext, sessionId, entry.callId, entry.model.title)) return;
		window.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: entry.callId }));
		const row = document.querySelector(`[data-dprc-call-id="${CSS.escape(entry.callId)}"]`);
		if (row !== null) {
			row.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
			window.dispatchEvent(new CustomEvent(REMOTE_OPEN_EVENT, { detail: entry.callId }));
			setPanelCallId(void 0);
			return;
		}
		setPanelCallId(entry.callId);
	}, [sessionId, setPanelCallId]);
	if (registry === void 0 || sessionId === void 0 || entries.length === 0) return null;
	const panelRecord = panelCallId === void 0 ? void 0 : registry.get(sessionId, panelCallId);
	const anchored = anchor !== void 0;
	const fabStyle = anchored ? {
		"--dprc-fab-left": `${anchor.left}px`,
		"--dprc-fab-top": `${anchor.top}px`,
		"--dprc-fab-right": "auto"
	} : void 0;
	const listStyle = freeList !== void 0 ? {
		left: `${freeList.left}px`,
		top: `${freeList.top}px`
	} : void 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dprc-fab-layer",
		"data-dprc-floating": "",
		"data-anchored": anchored || void 0,
		style: fabStyle,
		children: [open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			ref: listRef,
			className: "dprc-fab-list",
			role: "group",
			"aria-label": "结果卡片列表",
			style: listStyle,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dprc-fab-list-header",
				"data-dragging": draggingList || void 0,
				onPointerDown: startListDrag,
				onPointerMove: moveListDrag,
				onPointerUp: finishListDrag,
				onPointerCancel: finishListDrag,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
					"结果卡片（",
					entries.length,
					"）"
				] }), freeList !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dprc-fab-list-reset",
					"aria-label": "列表位置复位",
					title: "复位列表位置",
					onClick: resetListPosition,
					children: "复位"
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dprc-fab-items",
				children: entries.slice().reverse().map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dprc-fab-item",
					"data-state": entry.model.state,
					onClick: () => openCard(entry),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-icon",
							"aria-hidden": "true",
							children: "▤"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dprc-fab-item-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dprc-fab-item-heading",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dprc-kind",
									children: RESULT_KIND_LABELS[entry.model.kind]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dprc-fab-item-title",
									children: entry.model.title
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dprc-fab-item-summary",
								children: entry.model.summary || "点击查看完整内容"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-status",
							children: entry.model.status
						})
					]
				}) }, entry.callId))
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "dprc-fab",
			"aria-label": "结果卡片列表",
			"aria-expanded": open,
			onClick: () => setOpen(!open),
			children: ["▤", entries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dprc-fab-badge",
				children: entries.length
			})]
		})]
	}), panelCallId !== void 0 && panelRecord !== void 0 && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultPanel, {
		model: panelRecord.model,
		inspect: panelRecord.inspect,
		onClose: () => setPanelCallId(void 0),
		onReview: focusReview
	}), document.body)] });
}
/** Register the keyed card renderer and optional unified-sidebar result page. */
function apply(ctx) {
	const registry = new ResultCardRegistry();
	activeContext = ctx;
	activeRegistry = registry;
	registerResultSidebar(ctx, ResultCardSidebarView);
	ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
		name: "tool.call.toolview",
		key: RESULT_CARD_TOOL
	}, ResultCard));
	ctx.effect(installStyle, "dsh-plan-review-card: stylesheet");
	ctx.effect(() => {
		/** Mount the floating quick finder on a body-level host the plugin lifecycle owns. */
		const host = document.createElement("div");
		host.dataset.dprcFloatingHost = "";
		document.body.appendChild(host);
		const root = (0, react_dom_client.createRoot)(host);
		root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingCardList, {}));
		return () => {
			root.unmount();
			host.remove();
		};
	}, "dsh-plan-review-card: floating finder host");
	ctx.effect(() => () => {
		registry.clear();
		if (activeRegistry === registry) activeRegistry = void 0;
		if (activeContext === ctx) activeContext = void 0;
	}, "dsh-plan-review-card: client state");
}
const inject = ["slots", "sessions"];

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map