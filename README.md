# Kimi Code Output Reader

A VS Code: extension that reads the Kimi Code output-channel logs stored on disk and presents them in a dedicated sidebar + webview panel.

## What it does

- Discovers all `*-Kimi Code.log` files under `%APPDATA%\Code\logs`.
- Shows each log session in the **Kimi Output** activity-bar view.
- Structures each session into **Turn → Step → Event**.
- Opens a webview panel with three tabs:
  - **Raw Log** – line-numbered output, with search-in-page via `Ctrl/Cmd+F`.
  - **Events** – clickable timeline of `ToolCall`, `ToolResult`, `StatusUpdate`, etc.
  - **Turns** – user input + token usage summary per turn.
- Auto-refreshes every ~1.5 s when the current log is still growing.
- **每日用量** 生成按北京时间的堆叠柱状图，柱顶显示当日总 token 数。
- 统计结果会自动合并并持久化到扩展存储的 `dailyUsage.json`，即使 Kimi Code 原日志被删除，历史每日总量仍会保留。
- 提供 **清空本地用量统计** 命令手动删除持久化数据。
- 可自定义 Kimi Code 日志目录（设置 `kimiOutputReader.logsDir`，留空则自动探测）。
- 界面已本地化为中文。

## Usage

1. Install the extension (`kimi-output-reader-0.1.0.vsix`) and reload VS Code:.
2. Click the **Kimi Output** icon in the activity bar.
3. Expand a session, a turn, and a step to browse events.
4. Click any session/event to open the webview panel.

## Configuration

| 设置项 | 默认值 | 说明 |
|---|---|---|
| `kimiOutputReader.logsDir` | `''` | Kimi Code 日志目录，留空时自动使用 `%APPDATA%\Code\logs` |

## Commands

| 命令 | 作用 |
|---|---|
| `Kimi Output: 显示每日用量` | 打开用量图表并自动合并/持久化每日 token 统计 |
| `Kimi Output: 清空本地用量统计` | 删除持久化的 `dailyUsage.json` |

## Development

```bash
npm install
npm run watch      # or npm run compile
# Press F5 in VS Code: to launch the Extension Development Host
```

## Log location

Kimi Code writes its Output channel to files like:

```
%APPDATA%\Code\logs\<session>\<window>\exthost\output_logging_<timestamp>\<n>-Kimi Code.log
```

This extension reads those files directly; it does not intercept the live Output channel.
