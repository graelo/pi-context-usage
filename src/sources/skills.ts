import { formatSkillsForPrompt, type Skill } from "@earendil-works/pi-coding-agent";
import type { Item } from "./types.ts";

/**
 * Skills advertised to the model, one item per skill. Each is rendered with pi's own
 * formatter, so the text matches the prompt's; skills hidden from the model render empty
 * and are dropped.
 */
export function skillsSource(skills: readonly Skill[]): Item[] {
  return skills
    .map((skill) => ({ key: skill.name, label: skill.name, text: formatSkillsForPrompt([skill]).trim() }))
    .filter((item) => item.text.length > 0);
}
