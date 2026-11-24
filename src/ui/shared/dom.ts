/**
 * Small DOM helpers (Phase 11, 11-03) — dependency-free, text always via textContent.
 */

export type Unsub = () => void;

export interface ElOptions {
  className?: string;
  text?: string;
  id?: string;
  attrs?: Record<string, string>;
  type?: string;
  value?: string;
  placeholder?: string;
  title?: string;
  ariaLabel?: string;
  /** ARIA role (e.g. `status`, `alert`, `log`). */
  role?: string;
  /** Sets the `hidden` attribute (kept out of the accessibility tree). */
  hidden?: boolean;
}

let uidCounter = 0;

/** Unique DOM id for `for` / `aria-controls` / `aria-labelledby` wiring (`a15-<prefix>-<n>`). */
export function uid(prefix: string): string {
  uidCounter += 1;
  return `a15-${prefix}-${uidCounter}`;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.id) node.id = options.id;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.setAttribute('type', options.type);
  if (options.value !== undefined) (node as HTMLInputElement).value = options.value;
  if (options.placeholder) node.setAttribute('placeholder', options.placeholder);
  if (options.title) node.title = options.title;
  if (options.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options.role) node.setAttribute('role', options.role);
  if (options.hidden) node.setAttribute('hidden', '');
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      node.setAttribute(name, value);
    }
  }
  for (const child of children) {
    node.append(child);
  }
  return node;
}

export function listen(
  target: EventTarget,
  type: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): Unsub {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

export const on = listen;
