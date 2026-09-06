declare module "vitest" {
  export const describe: (name: string, fn: () => void) => void;
  export const it: {
    (name: string, fn: (...args: any[]) => unknown): void;
    each(cases: readonly any[]): (name: string, fn: (...args: any[]) => unknown) => void;
  };
  export const expect: (actual: any) => any;
  export const beforeEach: (fn: () => unknown) => void;
  export const afterEach: (fn: () => unknown) => void;
  export const vi: any;
}
