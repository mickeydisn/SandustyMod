/** Host DOM element — the picker runs in a browser-like host. */
export type HTMLElement = globalThis.HTMLElement;

export function h(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) {
  return sandkit.react.createElement(type, props, ...children);
}
