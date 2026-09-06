import type { ConversationData } from "../types/conversation";

export interface ConversationProvider {
  id: string;
  isSupportedLocation(location: Location): boolean;
  extract(document: Document, location: Location): ConversationData;
  extractFull?(document: Document, location: Location, onProgress?: (count: number) => void): Promise<ConversationData>;
}
