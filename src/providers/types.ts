import type { ConversationData } from "../types/conversation";
import type { ExtractionProgressData } from "../types/messages";

export interface FullExtractionOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExtractionProgressData) => void;
}

export interface ConversationProvider {
  id: string;
  isSupportedLocation(location: Location): boolean;
  extract(document: Document, location: Location): ConversationData;
  extractFull?(document: Document, location: Location, options?: FullExtractionOptions): Promise<ConversationData>;
}
