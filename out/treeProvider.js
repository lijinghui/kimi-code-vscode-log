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
exports.KimiOutputTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const logDiscovery_1 = require("./logDiscovery");
const logParser_1 = require("./logParser");
class KimiOutputTreeProvider {
    context;
    _onDidChange = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChange.event;
    cache = new Map();
    constructor(context) {
        this.context = context;
    }
    refresh() {
        this.cache.clear();
        this._onDidChange.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            const files = (0, logDiscovery_1.discoverLogFiles)();
            return Promise.resolve(files.map((f) => new LogSessionItem(f)));
        }
        if (element instanceof LogSessionItem) {
            const parsed = this.getParsed(element.info.path);
            return Promise.resolve(parsed.turns.map((t) => new TurnItem(t, element.info.path)));
        }
        if (element instanceof TurnItem) {
            return Promise.resolve(element.turn.steps.map((s) => new StepItem(s, element.turn, element.filePath)));
        }
        if (element instanceof StepItem) {
            return Promise.resolve(element.step.events.map((e) => new EventItem(e, element.filePath)));
        }
        return Promise.resolve([]);
    }
    getParsed(filePath) {
        if (!this.cache.has(filePath)) {
            this.cache.set(filePath, (0, logParser_1.parseLogFile)(filePath));
        }
        return this.cache.get(filePath);
    }
}
exports.KimiOutputTreeProvider = KimiOutputTreeProvider;
class TreeItem extends vscode.TreeItem {
}
class LogSessionItem extends TreeItem {
    info;
    constructor(info) {
        super(`${info.sessionTime} • ${info.window}`, vscode.TreeItemCollapsibleState.Collapsed);
        this.info = info;
        this.description = `${formatSize(info.size)} • ${info.outputTime}`;
        this.tooltip = info.path;
        this.contextValue = 'logSession';
        this.iconPath = new vscode.ThemeIcon('output');
        this.command = {
            command: 'kimiOutputReader.openLog',
            title: '在面板中打开日志',
            arguments: [info.path]
        };
    }
}
class TurnItem extends TreeItem {
    turn;
    filePath;
    constructor(turn, filePath) {
        const input = turn.userInput || `回合 ${turn.index}`;
        const label = input.length > 40 ? input.slice(0, 40) + '…' : input;
        super(`回合 ${turn.index}: ${label}`, vscode.TreeItemCollapsibleState.Collapsed);
        this.turn = turn;
        this.filePath = filePath;
        this.description = tokenDesc(turn.lastTokenUsage, turn.lastContextUsage);
        this.tooltip = turn.userInput || '';
        this.iconPath = new vscode.ThemeIcon('comment');
    }
}
class StepItem extends TreeItem {
    step;
    turn;
    filePath;
    constructor(step, turn, filePath) {
        super(`步骤 ${step.number}`, vscode.TreeItemCollapsibleState.Collapsed);
        this.step = step;
        this.turn = turn;
        this.filePath = filePath;
        this.description = `${step.events.length} 个事件`;
        this.iconPath = new vscode.ThemeIcon('debug-step-over');
    }
}
class EventItem extends TreeItem {
    record;
    filePath;
    constructor(record, filePath) {
        const type = record.eventType || (record.direction === 'send' ? '请求' : record.direction === 'recv' ? '事件' : '日志');
        let label = type;
        if (record.event?.type === 'ToolCall') {
            label = `🛠 ${record.event.payload?.function?.name || '工具调用'}`;
        }
        else if (record.event?.type === 'ToolResult') {
            label = `✅ 工具结果`;
        }
        else if (record.event?.type === 'StatusUpdate') {
            label = `📊 状态更新`;
        }
        else if (record.event?.type === 'ContentPart') {
            label = `📝 内容片段`;
        }
        else if (record.event?.type === 'text') {
            label = `💬 文本`;
        }
        super(label, vscode.TreeItemCollapsibleState.None);
        this.record = record;
        this.filePath = filePath;
        this.description = record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : '';
        this.tooltip = record.raw.slice(0, 800);
        this.iconPath = new vscode.ThemeIcon('symbol-event');
        this.command = {
            command: 'kimiOutputReader.openLog',
            title: '打开事件',
            arguments: [filePath, record.line]
        };
    }
}
function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function tokenDesc(usage, ctx) {
    if (!usage) {
        return '';
    }
    const total = (usage.input_other || 0) + (usage.input_cache_read || 0) + (usage.output || 0);
    const parts = [`tok ${total.toLocaleString()}`];
    if (typeof ctx === 'number') {
        parts.push(`ctx ${(ctx * 100).toFixed(1)}%`);
    }
    return parts.join(' • ');
}
//# sourceMappingURL=treeProvider.js.map