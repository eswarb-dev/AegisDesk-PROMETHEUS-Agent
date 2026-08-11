import { config } from "../config.js";

type Meta = Record<string, unknown>;

function redact(meta?: Meta): Meta | undefined {
  if (!meta) return undefined;
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [
      key,
      /token|key|secret|conversation|memory/i.test(key) ? "[redacted]" : value
    ])
  );
}

export const logger = {
  info(message: string, meta?: Meta) {
    console.log(JSON.stringify({ level: "info", message, ...redact(meta) }));
  },
  warn(message: string, meta?: Meta) {
    console.warn(JSON.stringify({ level: "warn", message, ...redact(meta) }));
  },
  error(message: string, meta?: Meta) {
    console.error(JSON.stringify({ level: "error", message, ...redact(meta) }));
  },
  debug(message: string, meta?: Meta) {
    if (config.nodeEnv !== "production") {
      console.debug(JSON.stringify({ level: "debug", message, ...redact(meta) }));
    }
  }
};
