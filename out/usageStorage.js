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
exports.loadPersistedUsage = loadPersistedUsage;
exports.savePersistedUsage = savePersistedUsage;
exports.clearPersistedUsage = clearPersistedUsage;
exports.mergeUsage = mergeUsage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const STORAGE_FILE = 'dailyUsage.json';
function getStoragePath(context) {
    return path.join(context.globalStorageUri.fsPath, STORAGE_FILE);
}
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function loadPersistedUsage(context) {
    const filePath = getStoragePath(context);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch {
        // ignore corrupted file
    }
    return [];
}
function savePersistedUsage(context, usage) {
    const filePath = getStoragePath(context);
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(usage, null, 2), 'utf-8');
}
function clearPersistedUsage(context) {
    const filePath = getStoragePath(context);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}
function mergeUsage(logUsage, persisted) {
    const map = new Map();
    for (const d of persisted) {
        map.set(d.date, { ...d });
    }
    for (const d of logUsage) {
        const existing = map.get(d.date);
        if (existing) {
            existing.inputOther = Math.max(existing.inputOther, d.inputOther);
            existing.inputCacheRead = Math.max(existing.inputCacheRead, d.inputCacheRead);
            existing.output = Math.max(existing.output, d.output);
            existing.total = existing.inputOther + existing.inputCacheRead + existing.output;
        }
        else {
            map.set(d.date, { ...d });
        }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
//# sourceMappingURL=usageStorage.js.map