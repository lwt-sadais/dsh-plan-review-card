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
let __deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
__deepseek_ai_dsh_client_ui_primitives = __toESM(__deepseek_ai_dsh_client_ui_primitives);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/contract.ts
const RESULT_CARD_TOOL = "present_result_card";

//#endregion
//#region src/client/result-registry.ts
/** Build the collision-free in-memory identity of one session-owned result card. */
function recordKey(sessionId, callId) {
	return JSON.stringify([sessionId, callId]);
}
/** In-memory bridge between durable ToolRow models and better-sidebar tab views. */
var ResultCardRegistry = class {
	entries = /* @__PURE__ */ new Map();
	/** Publish the latest replay-derived model and notify the corresponding sidebar view. */
	publish(sessionId, callId, record) {
		const key = recordKey(sessionId, callId);
		const current = this.entries.get(key);
		if (current === void 0) {
			this.entries.set(key, {
				record,
				listeners: /* @__PURE__ */ new Set()
			});
			return;
		}
		current.record = record;
		for (const listener of current.listeners) listener();
	}
	/** Read the latest model for one session and tool-call identity. */
	get(sessionId, callId) {
		return this.entries.get(recordKey(sessionId, callId))?.record;
	}
	/** Subscribe to model changes for one sidebar result tab. */
	subscribe(sessionId, callId, listener) {
		const key = recordKey(sessionId, callId);
		let entry = this.entries.get(key);
		if (entry === void 0) {
			entry = { listeners: /* @__PURE__ */ new Set() };
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
	}
	/** Clear all transient records and notify mounted views before lifecycle disposal. */
	clear() {
		for (const entry of this.entries.values()) {
			delete entry.record;
			for (const listener of entry.listeners) listener();
		}
		this.entries.clear();
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
const KIND_LABELS = {
	plan: "实施方案",
	evaluation: "评估报告",
	report: "分析报告"
};
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
		const value = JSON.parse(raw ?? "");
		const kind = value.kind === "plan" || value.kind === "evaluation" || value.kind === "report" ? value.kind : "report";
		return {
			kind,
			title: typeof value.title === "string" && value.title.trim() !== "" ? value.title : KIND_LABELS[kind],
			summary: typeof value.summary === "string" ? value.summary : "",
			content: typeof value.content === "string" ? value.content : ""
		};
	} catch {
		return {
			kind: "report",
			title: "结构化结果",
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
		status: "等待审查"
	};
	if (block.isError) return {
		...args,
		state: "failed",
		status: "审查中断"
	};
	const outcome = settledOutcome(block);
	if (outcome === "approved") return {
		...args,
		state: outcome,
		status: "已批准"
	};
	if (outcome === "rejected") return {
		...args,
		state: outcome,
		status: "已拒绝"
	};
	if (outcome === "adjustment-requested") return {
		...args,
		state: outcome,
		status: "需调整"
	};
	if (outcome === "cancelled") return {
		...args,
		state: outcome,
		status: "已取消"
	};
	return {
		...args,
		state: "failed",
		status: "审查未完成"
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
							children: KIND_LABELS[record.model.kind]
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
/** Render a persistent structured-result card that opens its complete content in a side panel. */
function ResultCard({ block, inspect }) {
	const model = (0, react.useMemo)(() => cardModel(block), [block]);
	const sessionId = useCurrentSessionId();
	const [open, setOpen] = (0, react.useState)(false);
	const [panelWidth, setPanelWidth] = (0, react.useState)(initialPanelWidth);
	const [resizing, setResizing] = (0, react.useState)(false);
	const dragRef = (0, react.useRef)();
	const panelId = `dprc-panel-${block.callId}`;
	const panelTitleId = `${panelId}-title`;
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
		setPanelWidth(initialPanelWidth());
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
	(0, react.useEffect)(() => {
		/** Keep only one result panel visible across all persistent card instances. */
		const closeForAnotherCard = (event) => {
			if (event.detail !== block.callId) setOpen(false);
		};
		window.addEventListener(PANEL_OPEN_EVENT, closeForAnotherCard);
		return () => window.removeEventListener(PANEL_OPEN_EVENT, closeForAnotherCard);
	}, [block.callId]);
	(0, react.useEffect)(() => {
		if (!open) return;
		/** Keep Escape available without changing focus or blocking native input. */
		const closeFromEscape = (event) => {
			if (event.key === "Escape") closePanel();
		};
		/** Re-clamp a saved or dragged width when the application viewport shrinks. */
		const fitToViewport = () => setPanelWidth((current) => clampPanelWidth(current));
		document.addEventListener("keydown", closeFromEscape);
		window.addEventListener("resize", fitToViewport);
		return () => {
			document.removeEventListener("keydown", closeFromEscape);
			window.removeEventListener("resize", fitToViewport);
		};
	}, [open]);
	const panelStyle = { "--dprc-panel-width": `${panelWidth}px` };
	const panel = open ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dprc-panel-layer",
		style: panelStyle,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
			id: panelId,
			className: "dprc-panel",
			role: "complementary",
			"aria-labelledby": panelTitleId,
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
									children: KIND_LABELS[model.kind]
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
							onClick: closePanel,
							children: "×"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResultContent, {
					model,
					inspect,
					onReview: () => {
						setOpen(false);
						window.setTimeout(focusReview, 0);
					}
				})
			]
		})
	}), document.body) : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "dprc-card",
		"data-state": model.state,
		"data-tool": RESULT_CARD_TOOL,
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
							children: KIND_LABELS[model.kind]
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