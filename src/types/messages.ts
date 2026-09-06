import type { ConversationData } from "./conversation";

export type ExtensionErrorCode =
  | "UNSUPPORTED_PAGE"
  | "NO_CONVERSATION_FOUND"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "CONVERSATION_STILL_GENERATING"
  | "PARTIAL_CONVERSATION"
  | "EXTRACTION_TIMEOUT"
  | "EXTRACTION_CANCELLED"
  | "SCROLL_CONTAINER_LOST"
  | "PAGE_CHANGED"
  | "EXTRACTION_FAILED"
  | "RENDER_FAILED"
  | "PRINT_WINDOW_BLOCKED";

export type ExtractionMode = "mounted" | "full";

export type ExtractionProgressPhase = "capturing" | "loading-older" | "verifying-start" | "restoring";

export interface ExtractionProgressData {
  phase: ExtractionProgressPhase;
  messageCount: number;
  iteration: number;
  topStabilityPasses: number;
}

export type ExtensionRequest =
  | { type: "PING" }
  | { type: "CHECK_CHATGPT_PAGE" }
  | { type: "EXTRACT_CONVERSATION"; mode?: ExtractionMode }
  | { type: "CANCEL_EXTRACTION" }
  | { type: "GET_EXTRACTION_DIAGNOSTICS" };

export type ExtensionEvent =
  | { type: "EXTRACTION_PROGRESS"; data: ExtractionProgressData };

export interface ExtractionDiagnostics {
  roleNodeCount: number;
  turnShellCount: number;
  activeRoleCount: number;
  mathSourceCount: number;
  katexCount: number;
  texAnnotationCount: number;
  mathMlCount: number;
  streaming: boolean;
  url: string;
}

export type ExtensionResponse =
  | { success: true; type: "PONG" }
  | { success: true; type: "PAGE_STATUS"; supported: boolean }
  | { success: true; type: "CONVERSATION"; data: ConversationData }
  | { success: true; type: "EXTRACTION_CANCELLED" }
  | { success: true; type: "DIAGNOSTICS"; data: ExtractionDiagnostics }
  | { success: false; error: ExtensionErrorCode; message: string };
