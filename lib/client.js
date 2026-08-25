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

//#region src/contract.ts
const RESULT_CARD_TOOL = "present_result_card";

//#endregion
//#region src/client/index.tsx
const STYLE_ID = "dsh-plan-review-card";
const KIND_LABELS = {
	plan: "实施方案",
	evaluation: "评估报告",
	report: "分析报告"
};
const STYLE_TEXT = `
.dprc-card{margin:4px 0 4px 4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-primary)}
.dprc-card[data-state="waiting"]{border-color:var(--dsw-alias-state-warn-secondary)}
.dprc-card[data-state="approved"]{border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l1))}
.dprc-summary-row{display:flex;min-height:52px;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;outline:none}
.dprc-summary-row:hover,.dprc-summary-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dprc-icon{display:grid;width:28px;height:28px;flex:none;place-items:center;border-radius:8px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:15px}
.dprc-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.dprc-heading{display:flex;align-items:center;gap:7px;min-width:0}
.dprc-kind{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px}.dprc-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.dprc-status{flex:none;border-radius:999px;padding:2px 8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}
.dprc-card[data-state="waiting"] .dprc-status{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary)}.dprc-card[data-state="approved"] .dprc-status{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dprc-card[data-state="adjustment-requested"] .dprc-status,.dprc-card[data-state="rejected"] .dprc-status,.dprc-card[data-state="failed"] .dprc-status{background:var(--dsw-alias-state-error-tertiary);color:var(--dsw-alias-state-error-primary)}
.dprc-chevron{width:16px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center}.dprc-detail{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.dprc-markdown{max-height:min(60vh,620px);padding:16px 18px;overflow:auto;font-size:14px;line-height:24px}.dprc-actions{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px}
.dprc-button{min-height:32px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px}.dprc-button-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:white}.dprc-button:hover{filter:brightness(.96)}
@media(max-width:720px){.dprc-summary{display:none}.dprc-status{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dprc-actions{flex-wrap:wrap}.dprc-button-primary{width:100%}}
`;
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
		if (value.outcome === "approved" || value.outcome === "rejected" || value.outcome === "adjustment-requested") return value.outcome;
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
/** Prevent action buttons from toggling their parent disclosure row. */
function isolate(event) {
	event.stopPropagation();
}
/** Render a persistent structured-result card for one present_result_card call. */
function ResultCard({ block, inspect }) {
	const model = (0, react.useMemo)(() => cardModel(block), [block]);
	const [expanded, setExpanded] = (0, react.useState)(false);
	const [copied, setCopied] = (0, react.useState)(false);
	const toggle = () => setExpanded((value) => !value);
	const toggleFromKeyboard = (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		toggle();
	};
	const copy = (event) => {
		isolate(event);
		copyMarkdown(model.content).then(() => {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		}).catch(() => setCopied(false));
	};
	const download = (event) => {
		isolate(event);
		downloadMarkdown(model.title, model.content);
	};
	const review = (event) => {
		isolate(event);
		focusReview();
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
		className: "dprc-card",
		"data-state": model.state,
		"data-tool": RESULT_CARD_TOOL,
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
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dprc-heading",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-kind",
							children: KIND_LABELS[model.kind]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dprc-title",
							children: model.title
						})]
					}), !expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
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
					children: expanded ? "⌃" : "⌄"
				})
			]
		}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dprc-detail",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dprc-markdown",
				children: model.content === "" ? "无法读取完整内容。" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(__deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: model.content })
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dprc-actions",
				children: [
					inspect !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dprc-button",
						onClick: (event) => {
							isolate(event);
							inspect();
						},
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
						onClick: download,
						children: "导出 Markdown"
					}),
					model.state === "waiting" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dprc-button dprc-button-primary",
						onClick: review,
						children: "批准、拒绝或批注"
					})
				]
			})]
		})]
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
/** Register the keyed card renderer through DSH's public client Slot boundary. */
function apply(ctx) {
	ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
		name: "tool.call.toolview",
		key: RESULT_CARD_TOOL
	}, ResultCard));
	ctx.effect(installStyle, "dsh-plan-review-card: stylesheet");
}
const inject = ["slots"];

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map