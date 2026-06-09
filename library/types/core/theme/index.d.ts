/**
 * types/core/theme/index.d.ts
 *
 * TypeScript declarations for the anza theme API.
 */

export interface ThemeApi {
  /** Return the active theme name: light, dark, contrast, or auto. */
  get(): string;

  /** Apply a theme name and persist it. */
  set(name: string): void;

  /** Toggle between light and dark. */
  toggle(): void;
}

export const theme: ThemeApi;
