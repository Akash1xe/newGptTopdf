import type { ConversationData } from "../../types/conversation";

export function ConversationSummary({ conversation }: { conversation: ConversationData }) {
  return (
    <section className="conversation-card">
      <span className="eyebrow">Conversation</span>
      <strong className="conversation-name" title={conversation.title}>{conversation.title}</strong>
      <div className="summary-line">
        <span>{conversation.stats.totalMessages} messages</span>
        <span>{conversation.stats.codeBlocks} code</span>
        <span>{conversation.stats.mathNodes} math</span>
        {conversation.stats.images > 0 && <span>{conversation.stats.images} images</span>}
      </div>
    </section>
  );
}
