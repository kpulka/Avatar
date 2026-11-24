/**
 * Inline SVG icons for the user layer and shell chrome (Phase 15-04, UIX-10).
 *
 * 16x16 Lucide-style strokes (MIT licensed path data), `currentColor`, always `aria-hidden`
 * because the adjacent text or `aria-label` carries the meaning. No icon dependency.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

type Shape = [tag: 'path' | 'line' | 'circle' | 'rect', attrs: Record<string, string>];

const SHAPES = {
  mic: [
    ['path', { d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' }],
    ['path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }],
    ['line', { x1: '12', x2: '12', y1: '19', y2: '22' }],
  ],
  micOff: [
    ['line', { x1: '2', x2: '22', y1: '2', y2: '22' }],
    ['path', { d: 'M18.89 13.23A7.12 7.12 0 0 0 19 12v-2' }],
    ['path', { d: 'M5 10v2a7 7 0 0 0 12 5' }],
    ['path', { d: 'M15 9.34V5a3 3 0 0 0-5.68-1.33' }],
    ['path', { d: 'M9 9v3a3 3 0 0 0 5.12 2.12' }],
    ['line', { x1: '12', x2: '12', y1: '19', y2: '22' }],
  ],
  phone: [
    [
      'path',
      {
        d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
      },
    ],
  ],
  phoneOff: [
    [
      'path',
      {
        d: 'M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91',
      },
    ],
    ['line', { x1: '22', x2: '2', y1: '2', y2: '22' }],
  ],
  stop: [['rect', { width: '14', height: '14', x: '5', y: '5', rx: '2' }]],
  settings: [
    [
      'path',
      {
        d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
      },
    ],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  eye: [
    ['path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  close: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
  dot: [['circle', { cx: '12', cy: '12', r: '5', fill: 'currentColor' }]],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof SHAPES;

export const ICON_NAMES = Object.keys(SHAPES) as IconName[];

/** Build an inline SVG icon (16x16, `currentColor`, `aria-hidden="true"`). */
export function icon(name: IconName, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `icon icon-${name}`);
  for (const [tag, attrs] of SHAPES[name] as Shape[]) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}
