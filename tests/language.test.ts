/**
 * Language gate (Phase 12 - English language, plan 12-01).
 *
 * Two checks, both pure node:fs (no network, no build):
 *
 *  Gate A - diacritics: Polish diacritic characters must not appear in an enforced
 *           scope, except for the functional-data allowlist (12-CONTEXT section 1.2).
 *           Scopes are flipped on one by one by later plans; a scope that is not yet
 *           enforced is still scanned and its file set is checked to be non-empty.
 *
 *  Gate B - link integrity: every relative ".md" link in an enforced document must
 *           resolve on disk. Pre-rename links to the 8 old docs/ filenames are
 *           tolerated through GATE_B_SKIP_LIST, which MUST be emptied by plan 12-04.
 *
 * This file is ASCII-only by construction: every Polish character is written as a
 * \uXXXX escape. Do not paste literal Polish letters into this file.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The 18 Polish diacritic letters (lower and upper case), as \uXXXX escapes. */
const PL_DIACRITICS = /[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u00D3\u00F3\u015A\u015B\u0179\u017A\u017B\u017C]/;

// ---------------------------------------------------------------------------
// Canonical rename map (12-CONTEXT section 1.1). Source of truth for 12-01 Task 2.
// ---------------------------------------------------------------------------

const RENAME_MAP: ReadonlyArray<readonly [string, string]> = [
  ['1-architektura-i-modele-3d.md', '1-architecture-and-3d-models.md'],
  ['2-integracja-elevenlabs-wss.md', '2-elevenlabs-wss-integration.md'],
  ['3-lip-sync-i-koartykulacja.md', '3-lip-sync-and-coarticulation.md'],
  ['4-audio-i-obsluga-przerwan.md', '4-audio-and-barge-in.md'],
  ['5-shadery-i-realizm.md', '5-shaders-and-realism.md'],
  ['6-analiza-opensource-i-rozwoj.md', '6-opensource-analysis-and-future.md'],
  ['A2F-LOCAL.md', 'a2f-local-setup.md'],
  ['EN-visemes.md', 'en-visemes.md'],
];

// ---------------------------------------------------------------------------
// Gate B skip-list. TODO(12-04): this list MUST be emptied when plan 12-04 lands
// (it repairs the inbound links). Until then it holds exactly the 8 pre-rename
// filenames, so links into docs/ that still use the old names are tolerated.
// ---------------------------------------------------------------------------

const GATE_B_SKIP_LIST: readonly string[] = [
  '1-architektura-i-modele-3d.md', // TODO(12-04): repair inbound links, then drop
  '2-integracja-elevenlabs-wss.md', // TODO(12-04): repair inbound links, then drop
  '3-lip-sync-i-koartykulacja.md', // TODO(12-04): repair inbound links, then drop
  '4-audio-i-obsluga-przerwan.md', // TODO(12-04): repair inbound links, then drop
  '5-shadery-i-realizm.md', // TODO(12-04): repair inbound links, then drop
  '6-analiza-opensource-i-rozwoj.md', // TODO(12-04): repair inbound links, then drop
  'A2F-LOCAL.md', // TODO(12-04): repair inbound links, then drop
  'EN-visemes.md', // TODO(12-04): repair inbound links, then drop
];

// ---------------------------------------------------------------------------
// Gate A functional allowlist (12-CONTEXT section 1.2). Each entry exempts ONE line
// pattern in ONE file; `why` cites the class. Every entry must match at least one
// real line (checked below) so stale exemptions cannot accumulate silently.
// If Phase 17 relocates one of these files, update the path HERE only.
// ---------------------------------------------------------------------------

interface AllowEntry {
  readonly file: string;
  readonly pattern: RegExp;
  readonly why: string;
}

const FUNCTIONAL_ALLOWLIST: readonly AllowEntry[] = [
  {
    file: 'src/lipsync/viseme-mappings.ts',
    pattern: /^\s*case '[A-Z\u0104\u0106\u0118\u0141\u0143\u00D3\u015A\u0179\u017B]+':/,
    why: '1.2 class 1: PL phoneme case labels (case \'DZ-with-diacritic\':)',
  },
  {
    file: 'src/lipsync/viseme-mappings.ts',
    pattern: /'SZ', 'CZ', 'RZ', 'D\u017B'/,
    why: '1.2 class 1: DIGRAPHS token array',
  },
  {
    file: 'src/lipsync/viseme-mappings.ts',
    pattern: /if \(!\/\[A-Z./,
    why: '1.2 class 1 (confirmed in 12-06): functional uppercase character class for the PL letters (not a comment)',
  },
  {
    file: 'src/lipsync/viseme-overrides.ts',
    pattern: /^\s*\{ key: '[A-Z\u0104\u0106\u0118\u0141\u0143\u00D3\u015A\u0179\u017B]+', label: '[^'\u0105\u0107\u0119\u0142\u0144\u00F3\u015B\u017A\u017C]*'/,
    why: '1.2 class 1 (added in 12-06): viseme-editor rows keyed by PL letters; English label, uppercase PL letters only',
  },
  {
    file: 'src/lipsync/demo-frames.ts',
    pattern: /= new Set\('[^']*'\.split/,
    why: '1.2 class 2: vowel / rounded / consonant Set-builder lines',
  },
  {
    file: 'src/realism/emotion-layer.ts',
    pattern: /^\s*'(dobrze|\u015Bwietnie)',?\s*$/,
    why: '1.2 class 3: PL sentiment keywords',
  },
  {
    file: 'src/features/animation-controller.ts',
    pattern: /Dzie\u0144 dobry!/,
    why: '1.2 class 4: PL calibration test phrase (the [Test kalibracji PL] label is UI and is NOT exempt)',
  },
];

// ---------------------------------------------------------------------------
// Gate A scopes. `enforced: false` means scanned in report mode only.
// ---------------------------------------------------------------------------

interface GateAScope {
  readonly name: string;
  readonly enforced: boolean;
  readonly files: () => string[];
}

/** Walk a directory recursively and return repo-relative paths with the given extensions. */
function listFiles(relDir: string, exts: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const name of readdirSync(abs)) {
      const child = join(abs, name);
      if (statSync(child).isDirectory()) {
        walk(child);
      } else if (exts.some((ext) => name.endsWith(ext))) {
        out.push(child.slice(ROOT.length).replace(/\\/g, '/'));
      }
    }
  };
  const start = join(ROOT, relDir);
  if (existsSync(start)) walk(start);
  return out.sort();
}

const GATE_A_SCOPES: readonly GateAScope[] = [
  {
    name: 'docs/renamed',
    // OFF: six of the eight renamed docs still contain Polish prose (translated in 12-03..12-04).
    enforced: false,
    files: () => RENAME_MAP.map(([, next]) => `docs/${next}`).filter((f) => existsSync(join(ROOT, f))),
  },
  {
    name: 'docs/core',
    // ON in 12-02: the three core docs (0-roadmap, 1-architecture, 2-elevenlabs) are translated.
    // Extended in 12-03: the lip-sync trio (3-lip-sync, 4-audio, en-visemes) is translated too.
    enforced: true,
    files: () =>
      [
        'docs/0-roadmap-poc-mvp.md',
        'docs/1-architecture-and-3d-models.md',
        'docs/2-elevenlabs-wss-integration.md',
        'docs/3-lip-sync-and-coarticulation.md',
        'docs/4-audio-and-barge-in.md',
        'docs/en-visemes.md',
      ].filter((f) => existsSync(join(ROOT, f))),
  },
  {
    name: 'docs/all',
    // ON in 12-04: all ten docs/ files are translated (12-02, 12-03, 12-04).
    enforced: true,
    files: () => listFiles('docs', ['.md']),
  },
  {
    name: 'src',
    // ON in 12-06: all comments / console / error strings are English; only the functional PL data remains.
    enforced: true,
    files: () => listFiles('src', ['.ts', '.css']),
  },
  { name: 'tests', enforced: false, files: () => listFiles('tests', ['.ts']) },
  {
    name: 'root',
    enforced: false,
    files: () => ['README.md', 'TODO_humanInTheLoop.md', 'index.html'].filter((f) => existsSync(join(ROOT, f))),
  },
];

function isAllowlisted(file: string, line: string): boolean {
  return FUNCTIONAL_ALLOWLIST.some((entry) => entry.file === file && entry.pattern.test(line));
}

/** Return "file:line: text" for every non-allowlisted line that contains a diacritic. */
function diacriticViolations(files: readonly string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (PL_DIACRITICS.test(line) && !isAllowlisted(file, line)) {
        violations.push(`${file}:${idx + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Gate B file set and link extraction.
// ---------------------------------------------------------------------------

function gateBFiles(): string[] {
  const planningRoot = readdirSync(join(ROOT, '.planning'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `.planning/${name}`);
  return [
    ...listFiles('docs', ['.md']),
    'README.md',
    'TODO_humanInTheLoop.md',
    'a2f/README.md',
    ...planningRoot,
  ].filter((f) => existsSync(join(ROOT, f)));
}

const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Relative ".md" link targets only: skips URLs, absolute paths and pure anchors. */
function relativeMdTargets(text: string): string[] {
  const targets: string[] = [];
  for (const match of text.matchAll(MD_LINK_RE)) {
    const raw = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('/') || raw.startsWith('#')) continue;
    const target = raw.split('#')[0];
    if (target.endsWith('.md')) targets.push(target);
  }
  return targets;
}

/** Return "file -> target" for every relative .md link that does not resolve on disk. */
function brokenMdLinks(files: readonly string[], skipBasenames: readonly string[]): string[] {
  const broken: string[] = [];
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const target of relativeMdTargets(text)) {
      if (skipBasenames.includes(basename(target))) continue;
      const resolved = resolve(dirname(join(ROOT, file)), target);
      if (!existsSync(resolved)) broken.push(`${file} -> ${target}`);
    }
  }
  return broken;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('language gate - mechanics (always on)', () => {
  it('Gate A detects a non-allowlisted diacritic and exempts allowlisted lines', () => {
    const probe = 'src/ui/example.ts';
    const bad = '  const label = "Zdr\u00F3wko";';
    const exempt = "    case 'D\u017B':";
    expect(PL_DIACRITICS.test(bad)).toBe(true);
    expect(isAllowlisted(probe, bad)).toBe(false);
    expect(isAllowlisted('src/lipsync/viseme-mappings.ts', exempt)).toBe(true);
    expect(isAllowlisted(probe, exempt)).toBe(false);
  });

  it('every functional allowlist entry matches at least one real line (no stale exemptions)', () => {
    const stale = FUNCTIONAL_ALLOWLIST.filter((entry) => {
      const abs = join(ROOT, entry.file);
      if (!existsSync(abs)) return true;
      return !readFileSync(abs, 'utf8').split(/\r?\n/).some((line) => entry.pattern.test(line));
    }).map((entry) => `${entry.file} :: ${entry.pattern.source}`);
    expect(stale).toEqual([]);
  });

  it('Gate B resolver extracts only relative .md targets', () => {
    const sample = [
      '[a](1-architecture.md)',
      '[b](../docs/x.md#section)',
      '[c](https://example.com/y.md)',
      '[d](#anchor)',
      '[e](/abs/z.md)',
      '[f](img.png)',
    ].join('\n');
    expect(relativeMdTargets(sample)).toEqual(['1-architecture.md', '../docs/x.md']);
  });

  it('Gate B skip-list is exactly the 8 pre-rename filenames (TODO(12-04))', () => {
    expect([...GATE_B_SKIP_LIST].sort()).toEqual(RENAME_MAP.map(([old]) => old).sort());
  });

  it('every Gate A scope resolves to at least one file (scanned even when not enforced)', () => {
    for (const scope of GATE_A_SCOPES) {
      if (scope.name === 'docs/renamed') continue; // populated only after the 12-01 rename commit
      expect(scope.files().length, `scope ${scope.name}`).toBeGreaterThan(0);
    }
  });
});

describe.each(GATE_A_SCOPES.filter((scope) => scope.enforced).map((scope) => [scope.name, scope] as const))(
  'Gate A - diacritics in %s',
  (_name, scope) => {
    it('contains no Polish diacritics outside the functional allowlist', () => {
      expect(diacriticViolations(scope.files())).toEqual([]);
    });
  },
);

describe('Gate B - relative .md link integrity', () => {
  it('every relative .md link in the enforced scope resolves (skip-list tolerated)', () => {
    expect(brokenMdLinks(gateBFiles(), GATE_B_SKIP_LIST)).toEqual([]);
  });
});
