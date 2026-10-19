import type { ContentBlock } from '../types/content';
import { controlText } from './controlText';
import { isSourceColor } from '../renderer/sourceColors';

/** Capture structure, not arbitrary source HTML or executable styles. */
export function layoutInfo(element: Element): Omit<Extract<ContentBlock, {type:'layout'}>, 'type' | 'blocks'> | undefined {
  if (!element.matches('div,section,fieldset,label')) return;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return;
  const card = parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none';
  const tracks = style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
  let columns = style.display === 'grid' ? tracks.length : 1;
  const repeat = style.gridTemplateColumns.match(/^repeat\((\d+),/);
  if (repeat) columns = Number(repeat[1]);
  if (style.display === 'flex' && style.flexDirection !== 'column' && style.flexDirection !== 'column-reverse') columns = element.children.length;
  columns = Math.max(1, Math.min(4, columns));
  const background = isSourceColor(style.backgroundColor) && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor);
  const centered = style.textAlign === 'center';
  const children = Array.from(element.children);
  const sizes = children.map(child => child.getBoundingClientRect().width);
  const columnWidths = columns === children.length && sizes.every(size => size > 0) ? sizes.map(size => `${size.toFixed(2)}fr`).join(' ') : undefined;
  if (card || columns > 1 || background || centered) return { columns, card,
    darkOnly: !card && columns === 1,
    columnWidths, sourceAlign: centered ? 'center' : undefined,
    sourceBackground: background ? style.backgroundColor : undefined,
    sourceBorder: isSourceColor(style.borderTopColor) ? style.borderTopColor : undefined };
}

export function visualControl(element: Element): Extract<ContentBlock, {type: 'control'}> | undefined {
  // CSS-only progress tracks have one empty fill child and a percentage width.
  // Require the short, colored track shape to avoid guessing from ordinary cards.
  if (element.matches('div,span') && !element.textContent?.trim() && element.children.length === 1) {
    const fill = element.firstElementChild as HTMLElement;
    const width = fill.style.width.match(/^(\d+(?:\.\d+)?)%$/);
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    const height = parseFloat(style?.height || '');
    if (width && height > 0 && height <= 24 && style?.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const percent = Math.min(100, Math.max(0, Number(width[1])));
      return {type:'control',kind:'progress',text:`Progress: ${percent}%`,percent,checked:false};
    }
  }
  if (element.matches('button,[role="button"]') && /^(open pdf|check answer|submit|review|download)(\s|$)/i.test(element.textContent?.trim() || '')) return { type:'control', kind:'action', text: element.textContent!.trim(), checked:false, percent:0 };
  const input = element.tagName === 'INPUT' ? element as HTMLInputElement : undefined;
  const progress = element.tagName === 'PROGRESS' ? element as HTMLProgressElement : undefined;
  const role = input?.type ?? (progress ? 'progressbar' : element.getAttribute('role'));
  const kind = role === 'progressbar' ? 'progress' : role === 'range' || role === 'slider' ? 'slider' : role === 'radio' ? 'radio' : role === 'checkbox' || role === 'switch' ? 'checkbox' : undefined;
  if (!kind) return;
  const min = Number(input?.min || element.getAttribute('aria-valuemin') || 0);
  const max = Number(progress?.max ?? (input?.max || element.getAttribute('aria-valuemax') || 100));
  const value = Number(progress?.value ?? (input?.value || element.getAttribute('aria-valuenow') || min));
  const percent = max > min && Number.isFinite(value) ? Math.max(0, Math.min(100, 100 * (value - min) / (max - min))) : 0;
  return { type: 'control', kind, text: kind === 'progress' ? `${element.getAttribute('aria-label') || 'Progress'}: ${Math.round(percent)}%` : controlText(element) ?? '', checked: input?.checked ?? element.getAttribute('aria-checked') === 'true', percent };
}
