# DSH 计划审查卡片

这是一个纯客户端 DeepSeek Harness 插件，将每次 `exit_plan_mode` 调用渲染为会话消息流中可持久化的计划卡片。

## 功能

- 从持久化的 `exit_plan_mode` 工具调用中读取完整 Markdown 计划。
- 在消息流中显示计划标题、摘要和审批状态。
- 点击卡片即可展开并查看完整计划。
- 待审批卡片可定位到 DSH 原生计划审查面板，供用户批准、拒绝或添加批注。
- 历史卡片保持只读，刷新页面或恢复会话后仍可重新显示。
- 不修改、不替换 DSH Desktop 源码。

## 实现方式

插件通过 DSH 官方扩展点 `tool.call.toolview`，为 `exit_plan_mode` 注册专属消息卡片。

审批响应仍交给 DSH 内置计划审查面板处理，因此 RPC 关联、断线重放、取消和防重复提交均继续由 Host 作为权威状态源管理。插件只负责持久化展示以及从卡片定位到原生审批界面。

## 本地开发

```bash
pnpm install
pnpm run check
```

构建产物生成到 `lib/`。浏览器入口使用 DSH Client Module Loader 包装，并通过 `package.json` 中的 `dsh.client` 声明自动发现。

## 安装到 DSH Desktop

从 GitHub 安装到 Desktop Profile：

```bash
dsh plugin --profile desktop add github:lwt-sadais/dsh-plan-review-card
```

本地开发时，也可以直接安装当前检出目录：

```bash
dsh plugin --profile desktop add D:\\workspace\\dsh-plan-review-card
```

首次安装后请重启 DSH Desktop。如果当前开发环境启用了 Client Plugin HMR，后续更新可能自动重载；否则更新插件后刷新现有 DSH Web GUI 页面。

更新插件：

```bash
dsh plugin --profile desktop update dsh-plan-review-card
```

卸载插件：

```bash
dsh plugin --profile desktop remove dsh-plan-review-card
```

## 使用方法

1. 在 DSH 会话中进入计划模式。
2. 模型调用 `exit_plan_mode` 后，消息流中会出现计划卡片。
3. 点击卡片查看完整 Markdown 计划。
4. 点击“前往批准、拒绝或批注”，定位到 DSH 原生计划审查面板。
5. 批准后卡片状态变为“已批准”；拒绝或添加批注后，模型会根据反馈调整并提交新版本计划。

## 兼容性

当前面向 DeepSeek Harness `0.1.1-rc.2` 的 Client Slot 与 Tool View 契约开发。

## 许可证

MIT
