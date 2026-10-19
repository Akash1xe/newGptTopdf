/** Accept color values only, never arbitrary CSS declarations or URLs. */
export function isSourceColor(value: string | undefined): value is string {
  return !!value && /^(?:rgba?|hsla?|oklch|oklab|lch|lab|color)\([a-z0-9.,%\s/+\-]+\)$/i.test(value);
}

export function readableSourceColor(value: string, document: Document, surface = 'rgb(24,24,27)'): string {
  // Resolve modern color spaces in the browser before checking contrast.
  // Cache per document: a long conversation repeats the same small palette.
  let cache = palettes.get(document);
  if (!cache) { cache = new Map(); palettes.set(document, cache); }
  const key = value + ':' + surface;
  const cached = cache.get(key);
  if (cached) return cached;
  let result = value;
  try {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (context) {
      context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      context.clearRect(0,0,1,1); context.fillStyle = surface; context.fillRect(0,0,1,1);
      const bg = context.getImageData(0,0,1,1).data;
      const background = [bg[0],bg[1],bg[2]].map((channel,i)=>channel*bg[3]/255 + [24,24,27][i]*(1-bg[3]/255));
      const luminance = (channels: number[]) => channels.map(c=>c/255).map(c=>c<=.04045 ? c/12.92 : ((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
      const bgLum = luminance(background);
      const original = [r,g,b].map((c,i)=>c*a/255+background[i]*(1-a/255));
      const target = bgLum > .179 ? 0 : 255;
      for (let step=0; step<=20; step++) {
        const color = original.map(c=>Math.round(c+(target-c)*step/20));
        const fgLum = luminance(color);
        if ((Math.max(fgLum,bgLum)+.05)/(Math.min(fgLum,bgLum)+.05)>=7 || step===20) {
          if (step>0) result = `rgb(${color.join(', ')})`;
          break;
        }
      }
    }
  } catch { /* Keep the valid source color when canvas is unavailable. */ }
  cache.set(key, result);
  return result;
}
const palettes = new WeakMap<Document, Map<string, string>>();
