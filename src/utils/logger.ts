const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export const logger = {
  debug(message: string, meta?: unknown) {
    if (isDev) console.debug(`[ChatGPT to PDF] ${message}`, meta ?? "");
  },
  info(message: string) {
    if (isDev) console.info(`[ChatGPT to PDF] ${message}`);
  },
  error(message: string, meta?: unknown) {
    if (isDev) console.error(`[ChatGPT to PDF] ${message}`, meta ?? "");
  }
};
