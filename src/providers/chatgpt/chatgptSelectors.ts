export const CHATGPT_SELECTORS = {
  roleNodes: '[data-message-author-role="user"], [data-message-author-role="assistant"]',
  fallbackRoleNodes: '[data-turn="user"], [data-turn="assistant"]',
  turnShells: '[data-testid^="conversation-turn"], [data-turn-id], article[data-turn], section[data-turn]',
  userContent: '[data-testid="collapsible-user-message-content"], .whitespace-pre-wrap',
  assistantContent: '.markdown, [class*="markdown"], .prose',
  streaming: [
    '[data-testid="stop-button"]',
    'button[aria-label*="Stop generating"]',
    'button[aria-label*="Stop streaming"]'
  ].join(','),
  ignored: [
    'button', '[role="button"]', '[role="menu"]', '[role="menuitem"]',
    '[data-testid*="copy"]', '[data-testid*="feedback"]', '[data-testid*="regenerate"]',
    '[data-testid*="share"]', '[data-testid*="read-aloud"]',
    '[aria-label*="Copy"]', '[aria-label*="copied"]', '[aria-label*="Read aloud"]',
    '[aria-label*="Good response"]', '[aria-label*="Bad response"]', '[aria-label*="Regenerate"]',
    'script', 'style', 'noscript', 'iframe', 'template'
  ].join(',')
} as const;
