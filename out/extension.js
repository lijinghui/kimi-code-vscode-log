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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const treeProvider_1 = require("./treeProvider");
const webviewProvider_1 = require("./webviewProvider");
const logDiscovery_1 = require("./logDiscovery");
const usageStorage_1 = require("./usageStorage");
function activate(context) {
    const treeProvider = new treeProvider_1.KimiOutputTreeProvider(context);
    const panel = new webviewProvider_1.KimiOutputPanel(context);
    const treeView = vscode.window.createTreeView('kimiOutputReader.sessions', {
        treeDataProvider: treeProvider
    });
    context.subscriptions.push(treeView);
    const refreshCmd = vscode.commands.registerCommand('kimiOutputReader.refresh', () => {
        treeProvider.refresh();
    });
    const showPanelCmd = vscode.commands.registerCommand('kimiOutputReader.showPanel', () => {
        panel.reveal();
    });
    const openLogCmd = vscode.commands.registerCommand('kimiOutputReader.openLog', (filePath, line) => {
        if (!filePath) {
            const files = (0, logDiscovery_1.discoverLogFiles)();
            if (files.length === 0) {
                vscode.window.showInformationMessage('未找到 Kimi Code 输出日志。');
                return;
            }
            filePath = files[0].path;
        }
        panel.showLog(filePath, line);
    });
    const showDailyUsageCmd = vscode.commands.registerCommand('kimiOutputReader.showDailyUsage', () => {
        panel.showUsage();
    });
    const clearStoredUsageCmd = vscode.commands.registerCommand('kimiOutputReader.clearStoredUsage', () => {
        (0, usageStorage_1.clearPersistedUsage)(context);
        vscode.window.showInformationMessage('已清空本地保存的用量统计。');
    });
    context.subscriptions.push(refreshCmd, showPanelCmd, openLogCmd, showDailyUsageCmd, clearStoredUsageCmd);
    // Live refresh: detect size changes for the newest logs and update the panel/tree.
    const lastSizes = new Map();
    const interval = setInterval(() => {
        const files = (0, logDiscovery_1.discoverLogFiles)();
        let changed = false;
        for (const f of files.slice(0, 5)) {
            try {
                const stat = fs.statSync(f.path);
                if (stat.size !== lastSizes.get(f.path)) {
                    changed = true;
                    lastSizes.set(f.path, stat.size);
                }
            }
            catch {
                // ignore files that disappear
            }
        }
        if (changed) {
            const current = panel.current;
            if (current && lastSizes.has(current)) {
                panel.update(current);
            }
            treeProvider.refresh();
        }
    }, 1500);
    context.subscriptions.push({
        dispose: () => clearInterval(interval)
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map