import type { ContentBlock, MessageRole } from "./content";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  order: number;
  plainText: string;
  blocks: ContentBlock[];
}

export interface ConversationStats {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  codeBlocks: number;
  mathNodes: number;
  images: number;
}

export type CompletenessState = "complete" | "possibly-partial" | "known-partial";
export type CompletenessReason = "virtualized-history" | "load-limit" | "timeout" | "dom-change" | "page-changed" | "unknown";

export interface ExtractionCompleteness {
  state: CompletenessState;
  reason?: CompletenessReason;
  iterations?: number;
  collectedMessages?: number;
}

export interface ConversationData {
  provider: "chatgpt";
  title: string;
  url: string;
  capturedUrl: string;
  capturedAt: string;
  conversationId?: string;
  messageCount: number;
  possiblyPartial: boolean;
  completeness: ExtractionCompleteness;
  messages: ConversationMessage[];
  stats: ConversationStats;
}
