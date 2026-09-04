import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PALETTES } from "../types/domain";

const tokensCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "./tokens.css"),
  "utf8",
);

/**
 * Locks the design-system contract in src/styles/tokens.css:
 *  - every palette defines primary/primary-text/primary-soft/primary-soft-text
 *    for BOTH themes, with WCAG AA contrast (≥4.5:1) for text pairs and
 *    white-on-fill;
 *  - the palette ids match the PALETTES list in domain.ts;
 *  - accent tokens always alias the primary family (single source of color).
 */

type Vars = Record<string, string>;

function parseBlocks(src: string): { selector: string; vars: Vars }[] {
  const blocks: { selector: string; vars: Vars }[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) break;
    const close = src.indexOf("}", open);
    if (close === -1) break;
    const selector = src.slice(i, open).replace(/\s+/g, " ").trim();
    const body = src.slice(open + 1, close);
    const vars: Vars = {};
    for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      vars[m[1]] = m[2].trim();
    }
    blocks.push({ selector, vars });
    i = close + 1;
  }
  return blocks;
}

const blocks = parseBlocks(tokensCss);

function blockWith(theme: string, palette?: string) {
  return blocks.find((b) => {
    const hasTheme = b.selector.includes(`data-theme="${theme}"`);
    const hasPalette = palette
      ? b.selector.includes(`data-palette="${palette}"`)
      : !b.selector.includes("data-palette=");
    return hasTheme && hasPalette;
  });
}

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("tokens.css — palettes", () => {
  const themeBg = { light: blockWith("light")!.vars["--bg"], dark: blockWith("dark")!.vars["--bg"] };
  const themeSurface = {
    light: blockWith("light")!.vars["--surface"],
    dark: blockWith("dark")!.vars["--surface"],
  };

  // Palette ids in CSS must match the PALETTES list and vice-versa.
  const cssPaletteIds = Array.from(
    new Set(
      blocks
        .filter((b) => b.selector.includes("data-palette="))
        .map((b) => b.selector.match(/data-palette="([\w-]+)"/)![1]),
    ),
  );
  const domainIds = PALETTES.map((p) => p.id);
  // Every CSS palette block must exist in PALETTES; laranja (the default)
  // intentionally has no block — its values live in the theme blocks.
  for (const id of cssPaletteIds) expect(domainIds).toContain(id);
  expect(domainIds.filter((id) => !cssPaletteIds.includes(id))).toEqual(["laranja"]);
  for (const theme of ["light", "dark"] as const) {
    it(`default palette (laranja) meets AA in ${theme}`, () => {
      const v = blockWith(theme)!.vars;
      const onPrimary = v["--on-primary"];
      expect(contrast(v["--primary"], onPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--primary-text"], themeBg[theme])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--primary-soft-text"], v["--primary-soft"])).toBeGreaterThanOrEqual(4.5);
    });

    it(`accent aliases the palette family in ${theme}`, () => {
      const v = blockWith(theme)!.vars;
      expect(v["--accent"]).toBe("var(--primary)");
      expect(v["--accent-soft"]).toBe("var(--primary-soft)");
      expect(v["--accent-soft-text"]).toBe("var(--primary-soft-text)");
      expect(v["--ring"]).toBe("var(--primary-text)");
    });
  }

  for (const p of PALETTES) {
    if (p.id === "laranja") continue; // default palette: tested above via the theme blocks
    for (const theme of ["light", "dark"] as const) {
      it(`palette "${p.id}" (${theme}) meets AA and keeps accent aliases`, () => {
        const b = blockWith(theme, p.id);
        expect(b, `missing [data-theme="${theme}"][data-palette="${p.id}"] block`).toBeDefined();
        const v = b!.vars;
        const white = "#ffffff";
        // Button fill + white label
        expect(contrast(v["--primary"], white)).toBeGreaterThanOrEqual(4.5);
        // Text on page background
        expect(contrast(v["--primary-text"], themeBg[theme])).toBeGreaterThanOrEqual(4.5);
        // Text on soft (selected chips, highlights)
        expect(contrast(v["--primary-soft-text"], v["--primary-soft"])).toBeGreaterThanOrEqual(4.5);
        // Focus ring on surfaces (non-text indicator ≥3:1)
        expect(contrast(v["--primary-text"], themeSurface[theme])).toBeGreaterThanOrEqual(3);
      });
    }
  }
});