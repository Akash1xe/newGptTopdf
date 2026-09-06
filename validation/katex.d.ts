declare module "katex" {
  interface KatexOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
    strict?: string | boolean | ((errorCode: string, errorMsg: string, token?: unknown) => string | boolean | void);
    trust?: boolean | ((context: unknown) => boolean);
    output?: "html" | "mathml" | "htmlAndMathml";
  }
  const katex: {
    render(expression: string, baseNode: HTMLElement, options?: KatexOptions): void;
    renderToString(expression: string, options?: KatexOptions): string;
  };
  export default katex;
}
declare module "katex/dist/katex.min.css";
