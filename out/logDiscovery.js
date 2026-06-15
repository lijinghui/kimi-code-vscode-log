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
exports.getDefaultLogsDir = getDefaultLogsDir;
exports.getEffectiveLogsDir = getEffectiveLogsDir;
exports.discoverLogFiles = discoverLogFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const vscode = __importStar(require("vscode"));
function getDefaultLogsDir() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'logs');
}
function getEffectiveLogsDir() {
    const configured = vscode.workspace.getConfiguration('kimiOutputReader').get('logsDir', '').trim();
    if (configured) {
        // Expand simple ~ to home directory.
        if (configured.startsWith('~/') || configured.startsWith('~\\')) {
            return path.join(os.homedir(), configured.slice(2));
        }
        return configured;
    }
    return getDefaultLogsDir();
}
function discoverLogFiles() {
    const logsDir = getEffectiveLogsDir();
    if (!fs.existsSync(logsDir)) {
        return [];
    }
    const files = [];
    const sessions = listDirs(logsDir);
    for (const session of sessions) {
        const sessionPath = path.join(logsDir, session);
        const windows = listDirs(sessionPath).filter((d) => d.startsWith('window'));
        for (const w of windows) {
            const exthostPath = path.join(sessionPath, w, 'exthost');
            if (!fs.existsSync(exthostPath)) {
                continue;
            }
            const outputDirs = listDirs(exthostPath).filter((d) => d.startsWith('output_logging_'));
            for (const outDir of outputDirs) {
                const outPath = path.join(exthostPath, outDir);
                const logs = fs.readdirSync(outPath).filter((f) => f.endsWith('-Kimi Code.log'));
                for (const log of logs) {
                    files.push(path.join(outPath, log));
                }
            }
        }
    }
    const infos = files.map((filePath) => {
        const stat = fs.statSync(filePath);
        const rel = path.relative(logsDir, filePath);
        const parts = rel.split(path.sep);
        const sessionTime = parts[0] || '';
        const window = parts[1] || '';
        const outputTimeMatch = parts[3]?.match(/output_logging_(.+)/);
        const outputTime = outputTimeMatch ? outputTimeMatch[1] : '';
        return {
            path: filePath,
            sessionTime,
            window,
            outputTime,
            size: stat.size,
            mtime: stat.mtime
        };
    });
    infos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return infos;
}
function listDirs(dir) {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=logDiscovery.js.map