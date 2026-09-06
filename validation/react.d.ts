declare module "react" {
  export interface ChangeEvent<T = Element> { target: T }
  export function useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  const React: { StrictMode: any };
  export default React;
}
declare module "react-dom/client" {
  const ReactDOM: { createRoot(node: Element): { render(node: unknown): void } };
  export default ReactDOM;
}
declare module "react/jsx-runtime" {
  export const Fragment: any;
  export function jsx(...args: any[]): any;
  export function jsxs(...args: any[]): any;
}
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any }
}
