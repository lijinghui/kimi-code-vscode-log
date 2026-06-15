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
exports.parseLogFile = parseLogFile;
const fs = __importStar(require("fs"));
const parseCache = new Map();
function parseLogFile(filePath) {
    const stat = fs.statSync(filePath);
    const cached = parseCache.get(filePath);
    if (cached && cached.size === stat.size && cached.mtime === stat.mtimeMs) {
        return cached.parsed;
    }
    const parsed = doParse(filePath, stat.size, stat.mtimeMs);
    parseCache.set(filePath, { size: stat.size, mtime: stat.mtimeMs, parsed });
    return parsed;
}
function doParse(filePath, size, mtime) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const records = [];
    const turns = [];
    let currentTurn;
    let currentStep;
    let lastTokenUsage;
    let lastContextUsage;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw.trim()) {
            continue;
        }
        const rec = parseLine(i + 1, raw);
        records.push(rec);
        if (rec.event) {
            const ev = rec.event;
            if (ev.type === 'TurnBegin') {
                currentTurn = {
                    index: turns.length + 1,
                    startLine: rec.line,
                    userInput: ev.payload?.user_input || '',
                    steps: [],
                    statusUpdates: []
                };
                turns.push(currentTurn);
                currentStep = undefined;
            }
            else if (ev.type === 'TurnEnd') {
                if (currentTurn) {
                    currentTurn.endLine = rec.line;
                }
                currentStep = undefined;
            }
            else if (ev.type === 'StepBegin') {
                if (!currentTurn) {
                    currentTurn = {
                        index: turns.length + 1,
                        startLine: rec.line,
                        userInput: '(no user input)',
                        steps: [],
                        statusUpdates: []
                    };
                    turns.push(currentTurn);
                }
                currentStep = {
                    number: ev.payload?.n || currentTurn.steps.length + 1,
                    startLine: rec.line,
                    events: []
                };
                currentTurn.steps.push(currentStep);
            }
            else if (currentStep && currentTurn) {
                currentStep.events.push(rec);
                if (ev.type === 'StatusUpdate') {
                    const payload = ev.payload;
                    if (payload?.token_usage) {
                        lastTokenUsage = payload.token_usage;
                        currentTurn.lastTokenUsage = payload.token_usage;
                    }
                    if (typeof payload?.context_usage === 'number') {
                        lastContextUsage = payload.context_usage;
                        currentTurn.lastContextUsage = payload.context_usage;
                    }
                    currentTurn.statusUpdates.push(rec);
                }
            }
        }
    }
    return {
        path: filePath,
        size,
        mtime,
        lineCount: lines.length,
        records,
        turns,
        lastTokenUsage,
        lastContextUsage
    };
}
function parseLine(lineNo, raw) {
    const tsMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
    const timestamp = tsMatch ? tsMatch[1] : '';
    const body = tsMatch ? tsMatch[2] : raw;
    let direction;
    let msgBody = body;
    const sendIdx = body.indexOf(' >>> ');
    const recvIdx = body.indexOf(' <<< ');
    if (sendIdx >= 0) {
        direction = 'send';
        msgBody = body.substring(sendIdx + 5);
    }
    else if (recvIdx >= 0) {
        direction = 'recv';
        msgBody = body.substring(recvIdx + 5);
    }
    const record = { line: lineNo, timestamp, raw, direction };
    const jsonText = extractJson(msgBody);
    if (jsonText) {
        try {
            const obj = JSON.parse(jsonText);
            record.message = obj;
            if (obj.method === 'event' && obj.params?.type) {
                record.event = { type: obj.params.type, payload: obj.params.payload };
                record.eventType = obj.params.type;
            }
        }
        catch {
            // Not valid JSON; treat as plain text.
        }
    }
    if (body.toLowerCase().includes('error') || raw.toLowerCase().includes('error')) {
        record.isError = true;
    }
    return record;
}
function extractJson(s) {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return s.substring(start, end + 1);
    }
    const startArr = s.indexOf('[');
    const endArr = s.lastIndexOf(']');
    if (startArr >= 0 && endArr > startArr) {
        return s.substring(startArr, endArr + 1);
    }
    return undefined;
}
//# sourceMappingURL=logParser.js.map