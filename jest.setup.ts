// The app uses `global.log` set in src/index.ts. Tests don't load index.ts,
// and importing src/utils/logger transitively pulls in chalk@5 (ESM-only),
// which Jest's CJS transformer cannot parse. Provide a no-op shim instead.
const noop = () => undefined;
const stubLog = {
  error: noop,
  warn: noop,
  info: noop,
  success: noop,
};

(global as unknown as { log: typeof stubLog }).log = stubLog;

export {};
