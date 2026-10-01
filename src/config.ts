import { loadConfig as loadConfigFile, type ConfigLocationOptions } from "@graelo/pi-ext-config";
import { DEFAULT_CATEGORIES, resolveCategories, type CategoryConfig } from "./categories.ts";

export interface Config {
  /**
   * Shell command that reads text on stdin and prints its token count, e.g.
   * `tik -e o200k_base`. Empty: estimate with chars/4.
   */
  tokenizer: string;
  /**
   * Report categories by id: label, color, and the prompt sections each claims. Layered over
   * the built-in table, so an entry only needs the keys it changes.
   */
  categories: Record<string, CategoryConfig>;
}

export const DEFAULT_CONFIG: Config = {
  tokenizer: "",
  categories: structuredClone(DEFAULT_CATEGORIES) as Record<string, CategoryConfig>,
};

export interface SessionConfigContext {
  cwd: string;
  isProjectTrusted(): boolean;
}

export interface LoadConfigOptions extends ConfigLocationOptions {
  /** Whether the current Pi project is trusted enough to use project config. */
  isProjectTrusted?: boolean;
}

export interface LoadedConfig {
  config: Config;
  /** Config problems worth surfacing: an unusable file, or values that failed validation. */
  diagnostics: string[];
}

function validate(config: Config): void {
  if (typeof config.tokenizer !== "string") {
    throw new Error("'tokenizer' must be a string");
  }
  if (typeof config.categories !== "object" || config.categories === null || Array.isArray(config.categories)) {
    throw new Error("'categories' must be an object");
  }
  resolveCategories(config.categories);
}

/**
 * Load `config.json` from the project tier when the project is trusted, layered over the
 * global tier. `deep-merge` so a project can change one key of one category and keep the rest.
 */
export function loadConfig(options: LoadConfigOptions = {}): LoadedConfig {
  const { isProjectTrusted, ...locationOptions } = options;
  const { config, diagnostics } = loadConfigFile<Config>("pi-context-usage", DEFAULT_CONFIG, {
    ...locationOptions,
    includeProject: isProjectTrusted === true,
    strategy: "deep-merge",
  });

  try {
    validate(config);
    return { config, diagnostics };
  } catch (err) {
    diagnostics.push(
      `pi-context-usage: invalid config values, using defaults: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { config: { ...DEFAULT_CONFIG, categories: structuredClone(DEFAULT_CONFIG.categories) }, diagnostics };
  }
}

/** Load configuration for an active Pi session, once project trust is resolved. */
export function loadConfigForSession(
  context: SessionConfigContext,
  options?: Omit<ConfigLocationOptions, "cwd" | "includeProject">,
): LoadedConfig {
  return loadConfig({ ...options, cwd: context.cwd, isProjectTrusted: context.isProjectTrusted() });
}
