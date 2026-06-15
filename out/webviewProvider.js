"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KimiOutputPanel = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const logParser_1 = require("./logParser");
const usageAggregator_1 = require("./usageAggregator");
const usageStorage_1 = require("./usageStorage");
class KimiOutputPanel {
    context;
    panel;
    currentPath;
    constructor(context) {
        this.context = context;
        this.setupMessageHandler();
    }
    reveal(column = vscode.ViewColumn.Two) {
        if (this.panel) {
            this.panel.reveal(column);
            return;
        }
        this.panel = vscode.window.createWebviewPanel('kimiOutputReader.panel', 'Kimi 输出', column, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }
    showLog(filePath, focusLine) {
        this.reveal();
        this.currentPath = filePath;
        this.update(filePath, focusLine);
    }
    update(filePath, focusLine) {
        if (!this.panel) {
            return;
        }
        this.currentPath = filePath;
        const parsed = (0, logParser_1.parseLogFile)(filePath);
        const rawTail = readTail(filePath, 500_000);
        const usage = computeUsage(this.context);
        const state = buildLogState(parsed, rawTail, focusLine, usage);
        this.panel.webview.html = renderHtml(state);
    }
    showUsage() {
        this.reveal();
        this.currentPath = undefined;
        const usage = computeUsage(this.context);
        const state = { mode: 'usage', usage, activeTab: '用量' };
        this.panel.webview.html = renderHtml(state);
    }
    get current() {
        return this.currentPath;
    }
    setupMessageHandler() {
        const disposable = vscode.workspace.onDidChangeConfiguration(() => {
            // placeholder for future theme-aware refresh
        });
        this.context.subscriptions.push(disposable);
    }
}
exports.KimiOutputPanel = KimiOutputPanel;
function readTail(filePath, maxBytes) {
    const buf = fs.readFileSync(filePath);
    const start = Math.max(0, buf.length - maxBytes);
    return buf.slice(start).toString('utf-8');
}
function computeUsage(context) {
    const logUsage = (0, usageAggregator_1.aggregateDailyUsage)(50);
    const persisted = (0, usageStorage_1.loadPersistedUsage)(context);
    const merged = (0, usageStorage_1.mergeUsage)(logUsage, persisted);
    (0, usageStorage_1.savePersistedUsage)(context, merged);
    return merged;
}
function buildLogState(parsed, rawTail, focusLine, usage) {
    const tailLines = rawTail.split(/\r?\n/);
    const events = parsed.records
        .filter((r) => r.event)
        .map((r) => ({
        line: r.line,
        time: r.timestamp,
        direction: r.direction,
        type: r.eventType,
        summary: summarize(r),
        raw: r.raw
    }));
    const turns = parsed.turns.map((t) => ({
        index: t.index,
        startLine: t.startLine,
        endLine: t.endLine,
        userInput: t.userInput,
        steps: t.steps.length,
        tokens: t.lastTokenUsage
            ? (t.lastTokenUsage.input_other || 0) +
                (t.lastTokenUsage.input_cache_read || 0) +
                (t.lastTokenUsage.output || 0)
            : undefined,
        context: t.lastContextUsage
    }));
    return {
        mode: 'log',
        path: parsed.path,
        size: parsed.size,
        lineCount: parsed.lineCount,
        tailStartLine: Math.max(1, parsed.lineCount - tailLines.length + 1),
        rawTail,
        focusLine,
        events,
        turns,
        usage,
        activeTab: '原始日志'
    };
}
function summarize(r) {
    if (!r.event) {
        return r.direction === 'send' ? '发送请求' : r.direction === 'recv' ? '接收事件' : '日志';
    }
    const p = r.event.payload || {};
    switch (r.event.type) {
        case 'ToolCall':
            return `${p.function?.name || '工具'}()`;
        case 'ToolResult':
            return `结果 ${p.return_value?.is_error ? '错误' : '成功'}`;
        case 'StatusUpdate': {
            const u = p.token_usage || {};
            return `tokens ${(u.input_other || 0) + (u.input_cache_read || 0) + (u.output || 0)}`;
        }
        case 'ContentPart':
            return p.type || '内容';
        default:
            return r.event.type;
    }
}
function renderHtml(state) {
    const nonce = getNonce();
    const tabIds = ['Raw', 'Events', 'Turns', 'Usage'];
    const tabLabels = {
        Raw: '原始日志',
        Events: '事件',
        Turns: '回合',
        Usage: '用量'
    };
    const activeTab = state.activeTab || '原始日志';
    const activeId = tabIds.find((id) => tabLabels[id] === activeTab) || 'Raw';
    const rawLines = state.rawTail
        ? state.rawTail
            .split(/\r?\n/)
            .map((line, idx) => {
            const lineNo = (state.tailStartLine || 1) + idx;
            const focus = lineNo === state.focusLine ? ' focus' : '';
            return `<div class="line${focus}" data-line="${lineNo}"><span class="ln">${lineNo}</span><span class="lc">${escapeHtml(line)}</span></div>`;
        })
            .join('')
        : '<div class="placeholder">选择一个日志会话以查看原始输出。</div>';
    const eventsHtml = state.events?.length
        ? state.events
            .map((e) => `
    <div class="event" data-line="${e.line}">
      <span class="etime">${e.time ? new Date(e.time).toLocaleTimeString() : ''}</span>
      <span class="edir">${e.direction === 'send' ? '➡️' : e.direction === 'recv' ? '⬅️' : '•'}</span>
      <span class="etype">${escapeHtml(e.type || '')}</span>
      <span class="esum">${escapeHtml(e.summary)}</span>
    </div>
  `)
            .join('')
        : '<div class="placeholder">未找到结构化事件。</div>';
    const turnsHtml = state.turns?.length
        ? state.turns
            .map((t) => `
    <div class="turn" data-start="${t.startLine}" data-end="${t.endLine || ''}">
      <b>回合 ${t.index}</b>: ${escapeHtml(t.userInput.slice(0, 80))}${t.userInput.length > 80 ? '…' : ''}
      <span class="meta">
        步骤 ${t.steps}${t.tokens ? ' • tokens ' + t.tokens.toLocaleString() : ''}${typeof t.context === 'number' ? ' • ctx ' + (t.context * 100).toFixed(1) + '%' : ''}
      </span>
    </div>
  `)
            .join('')
        : '<div class="placeholder">未找到回合。</div>';
    const usageHtml = state.usage
        ? renderUsageChart(state.usage)
        : '<div class="placeholder">运行 <b>Kimi Output: 显示每日用量</b> 生成跨会话图表。</div>';
    const tabButtons = tabIds
        .map((id) => `<button id="btn${id}" class="${activeId === id ? 'active' : ''}" data-tab="${id}">${tabLabels[id]}</button>`)
        .join('');
    const infoText = state.mode === 'log'
        ? `${escapeHtml(state.path || '')} • ${((state.size || 0) / 1024).toFixed(1)} KB • ${state.lineCount || 0} 行`
        : '按北京时间汇总的所有 Kimi Code 会话 token 用量';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin:0; padding:0; }
    .toolbar { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); position:sticky; top:0; z-index:10; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border:none; padding:4px 10px; cursor:pointer; border-radius:2px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.active { outline:1px solid var(--vscode-focusBorder); }
    .tab { display:none; height: calc(100vh - 44px); overflow:auto; }
    .tab.active { display:block; }
    .line { padding:1px 8px; font-family: var(--vscode-editor-font-family); white-space:pre-wrap; word-break:break-word; }
    .line:nth-child(even) { background: var(--vscode-editor-lineHighlightBackground); }
    .line.focus { background: var(--vscode-editor-selectionBackground); }
    .ln { color: var(--vscode-editorLineNumber-foreground); width:55px; display:inline-block; user-select:none; text-align:right; padding-right:10px; }
    .event, .turn { padding:6px 12px; border-bottom:1px solid var(--vscode-panel-border); cursor:pointer; }
    .event:hover, .turn:hover { background: var(--vscode-list-hoverBackground); }
    .etime { color: var(--vscode-descriptionForeground); margin-right:8px; font-family: var(--vscode-editor-font-family); }
    .edir { margin-right:6px; }
    .etype { display:inline-block; min-width:100px; color: var(--vscode-symbolIcon-eventForeground); }
    .esum { color: var(--vscode-foreground); }
    .turn .meta { color: var(--vscode-descriptionForeground); margin-left:8px; }
    .info { color: var(--vscode-descriptionForeground); margin-left:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:50%; }
    .placeholder { padding:20px; color: var(--vscode-descriptionForeground); }
    .chart-container { padding:20px; }
    .chart-bar { cursor:pointer; }
    .chart-bar:hover rect { filter: brightness(1.2); }
    .axis text { fill: var(--vscode-foreground); font-size:11px; }
    .legend text { fill: var(--vscode-foreground); font-size:12px; }
  </style>
</head>
<body>
  <div class="toolbar">
    ${tabButtons}
    <span class="info" title="${escapeHtml(state.path || '')}">${infoText}</span>
  </div>
  <div id="tabRaw" class="tab ${activeId === 'Raw' ? 'active' : ''}">${rawLines}</div>
  <div id="tabEvents" class="tab ${activeId === 'Events' ? 'active' : ''}">${eventsHtml}</div>
  <div id="tabTurns" class="tab ${activeId === 'Turns' ? 'active' : ''}">${turnsHtml}</div>
  <div id="tabUsage" class="tab ${activeId === 'Usage' ? 'active' : ''}">${usageHtml}</div>
  <script nonce="${nonce}">
    document.querySelectorAll('.toolbar button[data-tab]').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
        document.getElementById('tab' + tab).classList.add('active');
        btn.classList.add('active');
      };
    });

    function scrollToLine(line) {
      const el = document.querySelector('.line[data-line="' + line + '"]');
      if (el) { el.scrollIntoView({ behavior:'auto', block:'center' }); el.classList.add('focus'); }
    }

    document.querySelectorAll('.event').forEach(el => {
      el.onclick = () => {
        const line = el.dataset.line;
        const btn = document.getElementById('btnRaw');
        if (btn) btn.click();
        setTimeout(() => scrollToLine(line), 0);
      };
    });

    document.querySelectorAll('.turn').forEach(el => {
      el.onclick = () => {
        const line = el.dataset.start;
        const btn = document.getElementById('btnRaw');
        if (btn) btn.click();
        setTimeout(() => scrollToLine(line), 0);
      };
    });

    ${state.focusLine ? `setTimeout(() => scrollToLine(${state.focusLine}), 50);` : ''}
  </script>
</body>
</html>`;
}
function renderUsageChart(usage) {
    if (usage.length === 0) {
        return '<div class="placeholder">No token usage data found in the discovered logs.</div>';
    }
    const maxTotal = Math.max(...usage.map((d) => d.total)) || 1;
    const width = 720;
    const height = 320;
    const padLeft = 60;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 60;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const barGap = 8;
    const barW = Math.max(16, (chartW - barGap * (usage.length - 1)) / usage.length);
    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`;
    // Y-axis grid lines and labels
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
        const y = padTop + chartH - (i / gridCount) * chartH;
        const value = Math.round((i / gridCount) * maxTotal);
        svg += `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" style="stroke:var(--vscode-panel-border)" stroke-dasharray="2,2"/>`;
        svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" style="fill:var(--vscode-foreground);font-size:11px">${value.toLocaleString()}</text>`;
    }
    // Bars
    usage.forEach((d, i) => {
        const x = padLeft + i * (barW + barGap);
        const hIn = (d.inputOther / maxTotal) * chartH;
        const hCache = (d.inputCacheRead / maxTotal) * chartH;
        const hOut = (d.output / maxTotal) * chartH;
        const yOut = padTop + chartH - hOut;
        const yCache = yOut - hCache;
        const yIn = yCache - hIn;
        const tooltip = `${d.date}\\n输入：${d.inputOther.toLocaleString()}\\n缓存读取：${d.inputCacheRead.toLocaleString()}\\n输出：${d.output.toLocaleString()}\\n总计：${d.total.toLocaleString()}`;
        svg += `<g class="chart-bar">`;
        svg += `<title>${tooltip}</title>`;
        svg += `<rect x="${x}" y="${yIn}" width="${barW}" height="${hIn}" fill="#4fc1e9"/>`;
        svg += `<rect x="${x}" y="${yCache}" width="${barW}" height="${hCache}" fill="#a0d468"/>`;
        svg += `<rect x="${x}" y="${yOut}" width="${barW}" height="${hOut}" fill="#ed5565"/>`;
        svg += `</g>`;
        // Token total label above the bar
        if (d.total > 0) {
            const labelTop = Math.max(padTop, yIn - 4);
            svg += `<text x="${x + barW / 2}" y="${labelTop}" text-anchor="middle" style="fill:var(--vscode-foreground);font-size:10px">${d.total.toLocaleString()}</text>`;
        }
        // X-axis label
        const labelY = padTop + chartH + 18;
        svg += `<text x="${x + barW / 2}" y="${labelY}" text-anchor="middle" style="fill:var(--vscode-foreground);font-size:11px">${escapeHtml(d.displayDate)}</text>`;
    });
    // Axis lines
    svg += `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartH}" style="stroke:var(--vscode-foreground)"/>`;
    svg += `<line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" style="stroke:var(--vscode-foreground)"/>`;
    // Legend
    const legendY = padTop + chartH + 44;
    svg += `<g class="legend">`;
    svg += `<rect x="${padLeft}" y="${legendY - 10}" width="12" height="12" fill="#4fc1e9"/><text x="${padLeft + 18}" y="${legendY}" style="fill:var(--vscode-foreground);font-size:12px">输入</text>`;
    svg += `<rect x="${padLeft + 80}" y="${legendY - 10}" width="12" height="12" fill="#a0d468"/><text x="${padLeft + 98}" y="${legendY}" style="fill:var(--vscode-foreground);font-size:12px">缓存读取</text>`;
    svg += `<rect x="${padLeft + 190}" y="${legendY - 10}" width="12" height="12" fill="#ed5565"/><text x="${padLeft + 208}" y="${legendY}" style="fill:var(--vscode-foreground);font-size:12px">输出</text>`;
    svg += `</g>`;
    svg += `</svg>`;
    const totalTokens = usage.reduce((sum, d) => sum + d.total, 0);
    return `
    <div class="chart-container">
      <div style="margin-bottom:12px;font-weight:bold;">所有会话总 token：${totalTokens.toLocaleString()}</div>
      ${svg}
      <div style="margin-top:8px;color:var(--vscode-descriptionForeground);font-size:12px;">基于每个回合最后一次 StatusUpdate，按 Asia/Shanghai（UTC+8，北京时间）换算。</div>
    </div>
  `;
}
function escapeHtml(s) {
    return s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
function getNonce() {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
//# sourceMappingURL=webviewProvider.js.map