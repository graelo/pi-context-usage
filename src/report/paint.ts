import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { parseColor } from "@earendil-works/pi-tui";
import { DEFAULT_CATEGORIES, type ColorValue } from "../categories.ts";

/** The styling the layout needs, so it never touches the theme directly. */
export interface Paint {
  /** Color by category or space id. */
  color(id: string, text: string): string;
  bold(text: string): string;
  italic(text: string): string;
  dim(text: string): string;
}

/**
 * Paint with the current theme and the configured color of each id: a theme token, a
 * 256-color index or a color string. An unusable color falls back to the built-in default.
 */
export function themePaint(theme: Theme, colorOf: (id: string) => ColorValue | undefined): Paint {
  const resolved = new Map<string, (text: string) => string>();
  const painter = (value: ColorValue): ((text: string) => string) | undefined => {
    if (typeof value === "string" && value in theme.colors) {
      return (text) => theme.fg(value as ThemeColor, text);
    }
    try {
      const fg = parseColor(value);
      return (text) => theme.style(text, { fg });
    } catch {
      return undefined;
    }
  };

  return {
    color(id, text) {
      let paint = resolved.get(id);
      if (!paint) {
        const configured = colorOf(id);
        const fallback = DEFAULT_CATEGORIES[id]?.color;
        paint =
          (configured !== undefined ? painter(configured) : undefined) ??
          (fallback !== undefined ? painter(fallback) : undefined) ??
          ((t) => t);
        resolved.set(id, paint);
      }
      return paint(text);
    },
    bold: (text) => theme.bold(text),
    italic: (text) => theme.italic(text),
    dim: (text) => theme.fg("dim", text),
  };
}
