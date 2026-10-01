/**
 * The data layer's common currency: a named piece of text the model sees (or would see).
 *
 * Sources only describe *what* is in context. Token math happens in `aggregate.ts`, and
 * attributing items to report categories happens in `categories.ts`.
 */
export interface Item {
  /** Stable identifier within its source: a section name, tool name, file path, skill name. */
  key: string;
  /** Human-readable label for detail listings. */
  label: string;
  /** The text as it reaches the model. */
  text: string;
}
