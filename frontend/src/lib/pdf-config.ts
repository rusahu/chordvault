import { PdfFormatter } from 'chordsheetjs/pdf';

export type PdfConfig = NonNullable<ConstructorParameters<typeof PdfFormatter>[0]>;

type FontSpec = { name?: string; size?: number };
type StyledItem = { style?: FontSpec };

// One step on ChordVault's -3..+5 scale is one point.
const MIN_PT = 5;

// The library's own defaults, read once. Overriding narrowly is safe: partial
// configs deep-merge, so untouched siblings keep their defaults. Arrays are the
// exception — they replace wholesale, so header content must be passed complete.
const defaults = new PdfFormatter().configuration;

const scaled = (size: number, delta: number) => Math.max(MIN_PT, size + delta);

function buildFonts(fontName: string | null, delta: number) {
  const out: Record<string, FontSpec> = {};
  for (const [section, font] of Object.entries(defaults.fonts)) {
    const spec: FontSpec = { size: scaled((font as { size: number }).size, delta) };
    if (fontName) spec.name = fontName;
    out[section] = spec;
  }
  return out;
}

// Header and footer items carry their own font settings and ignore fonts.*,
// so the name has to be patched here too or CJK titles silently vanish.
// Content items are a union — image and line items have no style at all.
function restyle<T>(items: readonly T[], fontName: string | null, delta: number): T[] {
  return items.map((item) => {
    const current = (item as StyledItem).style;
    if (!current) return item;
    const style: FontSpec = { ...current, size: scaled(current.size ?? 10, delta) };
    if (fontName) style.name = fontName;
    return { ...item, style };
  });
}

export function buildPdfConfig({
  fontName,
  fontSize,
}: {
  fontName: string | null;
  fontSize: number;
}): PdfConfig {
  // The stock templates assume metadata ChordVault often lacks and leave the
  // literal text behind when it is absent: "Key of G - BPM  - Time", and a bare
  // "By". Conditions do not suppress an item, so strip the fixed text instead.
  const header = defaults.layout.header.content.map((item) => {
    const template = (item as { template?: string }).template;
    if (template?.startsWith('Key of')) return { ...item, template: 'Key of %{key}' };
    if (template?.startsWith('By ')) return { ...item, template: '%{artist}' };
    return item;
  });

  return {
    normalizeChords: false,
    fonts: buildFonts(fontName, fontSize),
    layout: {
      header: { ...defaults.layout.header, content: restyle(header, fontName, fontSize) },
      footer: { ...defaults.layout.footer, content: [] },
      chordDiagrams: { ...defaults.layout.chordDiagrams, enabled: false },
    },
  } as PdfConfig;
}
