/**
 * Drobne helpery DOM (Faza 11, 11-03) — bez zależności, tekst zawsze przez textContent.
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
