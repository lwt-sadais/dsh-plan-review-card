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
let __deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
__deepseek_ai_dsh_client_ui_primitives = __toESM(__deepseek_ai_dsh_client_ui_primitives);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/client/index.tsx
const TOOL_NAME = "exit_plan_mode";
const STYLE_ID = "dsh-plan-review-card";
const STYLE_TEXT = `
.dprc-card{margin:4px 0 4px 4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-primary)}
.dprc-card[data-state="waiting"]{border-color:var(--dsw-alias-state-warn-secondary)}
.dprc-card[data-state="approved"]{border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l1))}
.dprc-summary-row{display:flex;min-height:48px;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;outline:none}
.dprc-summary-row:hover,.dprc-summary-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dprc-icon{display:grid;width:24px;height:24px;flex:none;place-items:center;border-radius:7px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:15px}
.dprc-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}
.dprc-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}
.dprc-status{flex:none;border-radius:999px;padding:2px 8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}
.dprc-card[data-state="waiting"] .dprc-status{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary)}
.dprc-card[data-state="approved"] .dprc-status{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dprc-card[data-state="adjusting"] .dprc-status,.dprc-card[data-state="failed"] .dprc-status{background:var(--dsw-alias-state-error-tertiary);color:var(--dsw-alias-state-error-primary)}
.dprc-chevron{width:16px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center}
.dprc-detail{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.dprc-markdown{max-height:min(56vh,560px);padding:16px 18px;overflow:auto;font-size:14px;line-height:24px}
.dprc-actions{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px}
.dprc-button{min-height:32px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px 12px;font:inherit;font-size:12px}
.dprc-button-secondary{background:transparent;color:var(--dsw-alias-label-secondary)}
.dprc-button-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:white}
.dprc-button:hover{filter:brightness(.96)}
@media(max-width:720px){.dprc-summary{display:none}.dprc-status{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dprc-actions{flex-direction:column-reverse}.dprc-button{width:100%}}
`;
/** Read the complete plan from either a running or settled tool-call snapshot. */
function parsePlan(block) {
	const raw = "kind" in block ? block.call?.argsRaw : block.argsRaw;
	if (raw === void 0 || raw === "") return "";
	try {
		const value = JSON.parse(raw);
		return typeof value.plan === "string" ? value.plan : "";
	} catch {
		return "";
	}
}
/** Derive a readable title from the plan's first Markdown heading. */
function planTitle(plan) {
	for (const line of plan.split("\n")) {
		const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
		if (heading?.[1] !== void 0) return heading[1];
	}
	return "执行方案";
}
/** Build a compact plain-text preview without losing the persisted full plan. */
function planSummary(plan) {
	const text = plan.replace(/^#{1,6}\s+/gm, "").replace(/[`*_>[\]()~-]/g, " ").replace(/\s+/g, " ").trim();
	return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}
/** Flatten the settled result into text for lifecycle classification. */
function resultText(block) {
	return block.content.map((item) => item.type === "text" ? item.text ?? "" : "").join("\n");
}
/** Map the durable tool lifecycle to the card's user-facing review state. */
function planState(block) {
	if (!("kind" in block)) return {
		state: "waiting",
		status: "待审批"
	};
	if (!block.isError) return {
		state: "approved",
		status: "已批准"
	};
	const code = block.error?.code;
	const text = resultText(block);
	if (code === "ASK_CANCELLED" || /dismissed|cancelled/i.test(text)) return {
		state: "cancelled",
		status: "已取消，等待用户消息"
	};
	if (/keep planning|feedback|revise the plan/i.test(text)) return {
		state: "adjusting",
		status: "需调整"
	};
	return {
		state: "failed",
		status: "审批未完成"
	};
}
/** Combine call arguments and result state into one immutable render model. */
function planCardModel(block) {
	const plan = parsePlan(block);
	return {
		plan,
		title: planTitle(plan),
		summary: planSummary(plan),
		...planState(block)
	};
}
/** Move focus to DSH's authoritative plan-review Composer without duplicating its response protocol. */
function focusPlanReview() {
	const review = document.querySelector("[data-plan-review-key]");
	if (review === null) return;
	review.scrollIntoView({
		behavior: "smooth",
		block: "center"
	});
	review.querySelector("button, textarea, input")?.focus();
}
/** Render a persistent, expandable plan card for one exit_plan_mode tool call. */
function PlanReviewCard({ block, inspect }) {
	const model = (0, react.useMemo)(() => planCardModel(block), [block]);
	const [expanded, setExpanded] = (0, react.useState)(false);
	const actionable = model.state === "waiting";
	const toggle = () => setExpanded((value) => !value);
	const toggleFromKeyboard = (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		toggle();
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "dprc-card",
		"data-state": model.state,
		"data-tool": TOOL_NAME,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dprc-summary-row",
			role: "button",
			tabIndex: 0,
			"aria-expanded": expanded,
			onClick: toggle,
			onKeyDown: toggleFromKeyboard,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-icon",
					"aria-hidden": "true",
					children: "▤"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dprc-copy",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dprc-title",
						children: model.title
					}), !expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dprc-summary",
						children: model.summary || "模型已提交一份计划供审批。"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-status",
					children: model.status
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dprc-chevron",
					"aria-hidden": "true",
					children: expanded ? "⌃" : "⌄"
				})
			]
		}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dprc-detail",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dprc-markdown",
				children: model.plan === "" ? "无法读取计划内容。" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: model.plan })
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dprc-actions",
				children: [inspect !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dprc-button dprc-button-secondary",
					onClick: inspect,
					children: "查看调用详情"
				}), actionable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dprc-button dprc-button-primary",
					onClick: focusPlanReview,
					children: "前往批准、拒绝或批注"
				})]
			})]
		})]
	});
}
/** Install the card stylesheet once and remove it with the plugin lifecycle. */
function installStyle() {
	if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {};
	const style = document.createElement("style");
	style.dataset.pluginCss = STYLE_ID;
	style.textContent = STYLE_TEXT;
	document.head.appendChild(style);
	return () => style.remove();
}
/** Register the exit_plan_mode keyed tool view through DSH's public client Slot boundary. */
function apply(ctx) {
	ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
		name: "tool.call.toolview",
		key: TOOL_NAME
	}, PlanReviewCard));
	ctx.effect(installStyle, "dsh-plan-review-card: stylesheet");
}
const inject = ["slots"];

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map