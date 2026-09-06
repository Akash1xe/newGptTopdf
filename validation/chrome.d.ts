declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(value: Record<string, unknown>): Promise<void>;
    };
    session: {
      get(key: string): Promise<Record<string, unknown>>;
      set(value: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    };
  };
  tabs: {
    create(options: { url: string; active?: boolean }): Promise<unknown>;
    query(options: Record<string, unknown>, callback: (tabs: Array<{ id?: number; url?: string }>) => void): void;
    sendMessage(tabId: number, request: unknown, callback: (response?: any) => void): void;
  };
  runtime: {
    getURL(path: string): string;
    lastError?: { message?: string };
    sendMessage(message: unknown): void;
    onMessage: { addListener(listener: (...args: any[]) => any): void; removeListener(listener: (...args: any[]) => any): void };
    onInstalled: { addListener(listener: () => void): void };
  };
};
interface ImportMeta { env?: { DEV?: boolean } }

declare module "*.css";
