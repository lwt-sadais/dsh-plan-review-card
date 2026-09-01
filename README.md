# DSH 结构化结果卡片

面向 DeepSeek Harness Desktop 的方案、评估与分析报告卡片插件。用户要求输出实施方案、可行性评估、对比分析、审计报告等结构化结果时，模型会调用 `present_result_card`，将完整 Markdown 结果持久化为消息流卡片，而不是只发送普通长文本。

## 功能

- 支持三类结果：实施方案、评估报告、通用分析报告。
- 卡片显示类型、标题、摘要和审查状态。
- 安装 `dsh-better-sidebar >= 0.17.1` 时，点击卡片会把完整 Markdown 打开为统一侧边栏 Tab，支持会话隔离、分屏、拖拽和自由窗口；同一卡片重复点击只聚焦已有 Tab。
- 未安装或尚未加载 better-sidebar 时，自动降级到原有非阻塞 Portal 阅读栏，可继续操作会话和输入框。
- Portal 降级模式可拖动阅读栏左边缘调整宽度，并自动记忆宽度偏好。
- 一键复制完整 Markdown。
- 一键导出 `.md` 文件。
- 用户可以批准、拒绝，或输入批注要求模型调整。
- 要求调整后，模型读取批注、生成完整新版本并再次提交卡片。
- 历史卡片来自持久化的 `tool/call` 与 `tool/result`，刷新或恢复会话后仍可显示；侧边栏 Tab 仅持久化 `callId`，完整 Markdown 不会重复写入 localStorage。
- 仅主 Agent 可使用结果卡片；子 Agent 不加载该工具及其触发提示，避免并发任务要求用户逐个审批。
- 使用 DSH 官方 Bundle、Tool、User Questions 与 Client Slot 扩展点，不修改 DSH Desktop 源码。

## 工作方式

插件在 Host 注册 `present_result_card` 工具，并向模型注入语义触发规则。当用户将以下内容作为最终交付物时，模型应使用该工具：

- 实施计划、改造方案、技术方案；
- 可行性评估、风险评估、方案对比；
- 审计报告、分析报告等较完整的结构化长文。

工具提交完整内容后暂停当前任务，由 DSH 原生问题交互面板收集用户决定：

- **批准并接受**：接受当前完整内容；
- **拒绝**：拒绝当前结果并停止修订；
- **要求调整**：通过自定义输入填写批注，模型据此重写完整结果；
- **直接填写自定义内容**：同样作为调整意见返回模型。

普通短回答、执行进度和日常对话不会触发卡片。

## 安装到 DSH Desktop

从 GitHub 安装到 Desktop Profile：

```bash
dsh plugin add --profile desktop github:lwt-sadais/dsh-plan-review-card
```

本地开发安装：

```bash
dsh plugin add --profile desktop D:\\workspace\\dsh-plan-review-card
```

插件包声明了 `dsh.bundle`，安装命令会同时把它加入 Desktop Profile 的 Bundle 列表。首次安装后请完全退出并重新启动 DSH Desktop。

更新：

```bash
dsh plugin update --profile desktop dsh-plan-review-card
```

卸载：

```bash
dsh plugin remove --profile desktop dsh-plan-review-card
```

## 使用示例

```text
评估当前会话消息链路，并输出完整评估报告。
```

或：

```text
分析这个需求，最终给出可执行的技术改造方案。
```

预期结果是消息流出现结构化卡片，底部显示 DSH 原生审查面板。点击卡片后，若已安装兼容版本的 better-sidebar，全文会作为侧边栏 Tab 打开；否则使用内置 Portal 阅读栏。两种模式均可复制或导出，审查面板用于批准、拒绝和填写调整意见。

侧边栏布局恢复可能早于历史消息行加载；此时结果 Tab 会显示恢复提示，对应结果卡进入消息窗口后自动恢复全文。

## 本地开发

```bash
pnpm install
pnpm run check
```

构建产物输出到 `lib/`，并随 GitHub 包一同提交，安装时无需在用户机器上执行构建。

## 兼容性

兼容 DeepSeek Harness `0.1.1-rc.1` 至当前 `0.1.x` 的 Bundle、Tool、User Questions、Client Slot 与 Tool View 契约；当前开发与构建基线为 `0.1.1-rc.2`。

## 许可证

MIT
