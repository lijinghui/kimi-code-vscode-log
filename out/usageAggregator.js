"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateDailyUsage = aggregateDailyUsage;
const logDiscovery_1 = require("./logDiscovery");
const logParser_1 = require("./logParser");
function aggregateDailyUsage(maxFiles = 50) {
    const files = (0, logDiscovery_1.discoverLogFiles)().slice(0, maxFiles);
    const dayMap = new Map();
    for (const file of files) {
        const parsed = (0, logParser_1.parseLogFile)(file.path);
        if (parsed.turns.length > 0) {
            // New log format: take the last StatusUpdate of each Turn to avoid double counting.
            for (const turn of parsed.turns) {
                const last = turn.statusUpdates[turn.statusUpdates.length - 1];
                if (last && turn.lastTokenUsage) {
                    addRecord(dayMap, last.timestamp, turn.lastTokenUsage);
                }
            }
        }
        else {
            // Older logs without Turn/Step markers: take the last StatusUpdate per message_id.
            const byMessage = new Map();
            for (const rec of parsed.records) {
                if (rec.event?.type === 'StatusUpdate' && rec.event.payload?.token_usage) {
                    const msgId = rec.event.payload.message_id || `line-${rec.line}`;
                    const usage = rec.event.payload.token_usage;
                    const existing = byMessage.get(msgId);
                    if (!existing || rec.line > parseInt(existing.ts ? '0' : '0', 10)) {
                        byMessage.set(msgId, { ts: rec.timestamp, usage });
                    }
                }
            }
            for (const { ts, usage } of byMessage.values()) {
                addRecord(dayMap, ts, usage);
            }
        }
    }
    const sorted = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
}
function addRecord(dayMap, timestamp, usage) {
    const dateKey = toBeijingDateKey(timestamp);
    if (!dateKey) {
        return;
    }
    const inputOther = usage.input_other || 0;
    const inputCacheRead = usage.input_cache_read || 0;
    const output = usage.output || 0;
    const total = inputOther + inputCacheRead + output;
    const existing = dayMap.get(dateKey);
    if (existing) {
        existing.inputOther += inputOther;
        existing.inputCacheRead += inputCacheRead;
        existing.output += output;
        existing.total += total;
    }
    else {
        dayMap.set(dateKey, {
            date: dateKey,
            displayDate: dateKey.slice(5),
            inputOther,
            inputCacheRead,
            output,
            total
        });
    }
}
function toBeijingDateKey(isoTimestamp) {
    if (!isoTimestamp) {
        return undefined;
    }
    const d = new Date(isoTimestamp);
    if (isNaN(d.getTime())) {
        return undefined;
    }
    try {
        return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    }
    catch {
        // Fallback if Asia/Shanghai is not supported.
        const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        return beijing.toISOString().slice(0, 10);
    }
}
//# sourceMappingURL=usageAggregator.js.map