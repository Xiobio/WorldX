import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";

let LOG_FILE = null;

export function initLogger(filePath) {
  LOG_FILE = filePath;
  mkdirSync(dirname(filePath), { recursive: true });
}

export function log(step, event, detail = "") {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${step}] ${event}${detail ? `\n${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}` : ""}\n`;
  if (LOG_FILE) appendFileSync(LOG_FILE, line);
  console.log(`[${step}] ${event}${detail ? ` — ${typeof detail === "string" ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200)}` : ""}`);
}

export function logError(step, err) {
  log(step, "ERROR", err?.stack || err?.message || String(err));
}
