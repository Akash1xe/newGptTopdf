export const CHATGPT_SELECTORS = {
  /**
   * ChatGPT currently ships more than one conversation renderer. Keep role
   * discovery based on semantic attributes instead of generated class names.
   *
   * The 2026 grouped renderer uses data-turn-key for a user/assistant pair,
   * data-user-message-bubble for the user prompt, and
   * data-conversation-role="assistant" for the response. Older renderers still
   * expose data-message-author-role.
   */
  roleNodes: [
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    '[data-conversation-role="user"]',
    '[data-conversation-role="assistant"]',
    '[data-role="user"]',
    '[data-role="assistant"]',
    '[data-message-author="user"]',
    '[data-message-author="assistant"]',
    '[data-user-message-bubble]'
  ].join(','),
  fallbackRoleNodes: '[data-turn="user"], [data-turn="assistant"]',
  turnShells: [
    '[data-testid^="conversation-turn"]',
    '[data-turn-id]',
    '[data-turn-key]',
    '[data-message-id]',
    '[data-message-uuid]',
    'article[data-turn]',
    'section[data-turn]'
  ].join(','),
  userContent: [
    '[data-user-message-bubble]',
    '[data-message-content]',
    '[data-testid="collapsible-user-message-content"]',
    '[data-testid*="user-message"]',
    '.whitespace-pre-wrap'
  ].join(','),
  assistantContent: [
    '[data-message-content]',
    '.markdown',
    '[class*="markdown"]',
    '.prose'
  ].join(','),
  streaming: [
    '[data-testid="stop-button"]',
    'button[aria-label*="Stop generating"]',
    'button[aria-label*="Stop streaming"]',
    'form[data-chatgpt-composer] button[aria-label="Stop"]'
  ].join(','),
  ignored: [
    'button', '[role="button"]', '[role="menu"]', '[role="menuitem"]',
    '.turn-action-controls', '[data-testid="copy-turn-action-button"]',
    '[data-testid*="copy"]', '[data-testid*="feedback"]', '[data-testid*="regenerate"]',
    '[data-testid*="share"]', '[data-testid*="read-aloud"]',
    '[aria-label*="Copy"]', '[aria-label*="copied"]', '[aria-label*="Read aloud"]',
    '[aria-label*="Good response"]', '[aria-label*="Bad response"]', '[aria-label*="Regenerate"]',
    'script', 'style', 'noscript', 'iframe', 'template'
  ].join(',')
} as const;
