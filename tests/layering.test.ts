/**
 * Layering gate (14-02, ARCH-01 / ARCH-06): parses the static and dynamic imports of every
 * module under src/ and fails on any edge the contract in tests/layering-rules.ts does not allow,
 * on module-level import cycles, and on top-level DOM / storage access in the domain layers.
 *
 * The rules are data (layering-rules.ts) and the per-edge decision is a pure function
 * (layering-check.ts, shared with the ESLint rule in eslint.config.ts, 18-04); this file walks the
 * tree and asserts. The checkers are pure so the negative self-tests can feed them synthetic edges
 * and sources.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { type Edge, findViolations, layerOf } from './layering-check';
import {
  EXCEPTIONS,
  LAYER_MAY_IMPORT,
  LAYER_ORDER,
  MODULE_RULES,
  SIDE_EFFECT_EXEMPTIONS,
  SIDE_EFFECT_FREE_DIRS,
  SIDE_EFFECT_GLOBALS,
} from './layering-rules';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// ---------------------------------------------------------------- source walking & import parsing

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

const toRel = (abs: string): string => relative(SRC, abs).split(sep).join('/');

/** Relative import specifiers of a TS source: static imports, re-exports, `import('...')`. */
export function importSpecifiers(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const specs: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs.filter((spec) => spec.startsWith('.'));
}

const NON_CODE_TARGET = /\.(css|json|svg|png|glb)$/;

function collectModules(): { files: string[]; edges: Edge[]; unresolved: string[] } {
  const files = walk(SRC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map(toRel);
  const known = new Set(files);
  const edges: Edge[] = [];
  const unresolved: string[] = [];
  for (const from of files) {
    const text = readFileSync(join(SRC, from), 'utf8');
    for (const spec of importSpecifiers(from, text)) {
      if (NON_CODE_TARGET.test(spec)) continue;
      const base = posix.normalize(posix.join(posix.dirname(from), spec));
      const to = [`${base}.ts`, `${base}/index.ts`, base].find((candidate) => known.has(candidate));
      if (to) edges.push({ from, to });
      else unresolved.push(`${from}: ${spec}`);
    }
  }
  return { files, edges, unresolved };
}

// ---------------------------------------------------------------- the checkers (pure)

/** Module-level import cycles (each reported once as `a -> b -> a`). */
export function findCycles(edges: readonly Edge[]): string[] {
  const adj = new Map<string, string[]>();
  for (const { from, to } of edges) adj.set(from, [...(adj.get(from) ?? []), to]);
  const color = new Map<string, 1 | 2>();
  const cycles: string[] = [];
  const stack: string[] = [];
  const dfs = (node: string): void => {
    color.set(node, 1);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      if (color.get(next) === 1) cycles.push([...stack.slice(stack.indexOf(next)), next].join(' -> '));
      else if (!color.has(next)) dfs(next);
    }
    stack.pop();
    color.set(node, 2);
  };
  for (const node of adj.keys()) if (!color.has(node)) dfs(node);
  return cycles;
}

/**
 * Forbidden globals referenced at module top level: any statement that is not a declaration of a
 * function / class / type, outside nested function bodies. `typeof window` guards are allowed.
 */
export function topLevelGlobalUses(fileName: string, text: string): string[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return; // bodies run later, not at load
    if (ts.isTypeNode(node) || ts.isTypeOfExpression(node)) return; // `typeof window` guards / type positions
    if (ts.isPropertyAccessExpression(node)) {
      visit(node.expression);
      return;
    } // skip the member name
    if (ts.isPropertyAssignment(node)) {
      visit(node.initializer);
      return;
    } // skip the property key
    if (ts.isVariableDeclaration(node)) {
      if (node.initializer) visit(node.initializer);
      return;
    } // skip the binding name
    if (ts.isIdentifier(node) && SIDE_EFFECT_GLOBALS.includes(node.text)) found.add(node.text);
    ts.forEachChild(node, visit);
  };
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    visit(statement);
  }
  return [...found];
}

// ---------------------------------------------------------------- the gate

const { files, edges, unresolved } = collectModules();

describe('layering gate: import contract (14-02)', () => {
  it('parses a real graph (guards against a parser that silently matches nothing)', () => {
    expect(files.length).toBeGreaterThan(60);
    expect(edges.length).toBeGreaterThan(150);
    expect(unresolved).toEqual([]);
  });

  it('every module is classified into a layer', () => {
    expect(files.filter((f) => !layerOf(f))).toEqual([]);
  });

  it('every edge is allowed by the layer table (or is a documented exception)', () => {
    expect(findViolations(edges)).toEqual([]);
  });

  it('there are no module-level import cycles', () => {
    expect(findCycles(edges)).toEqual([]);
  });

  it('the composition root is imported by main.ts only', () => {
    const importers = [...new Set(edges.filter((e) => e.to === 'app/container.ts').map((e) => e.from))];
    expect(importers).toEqual(['main.ts']);
  });

  it('ui never imports features (panels get injected services)', () => {
    expect(edges.filter((e) => layerOf(e.from) === 'ui' && layerOf(e.to) === 'features')).toEqual([]);
  });

  it('every exception is documented with a reason and still matches a real edge', () => {
    for (const exception of EXCEPTIONS) {
      expect(exception.reason.length, exception.from).toBeGreaterThan(40);
      expect(
        edges.some((e) => e.from === exception.from && e.to === exception.to),
        `stale exception ${exception.from} -> ${exception.to}`
      ).toBe(true);
    }
    expect(EXCEPTIONS).toHaveLength(1);
  });

  it('the rule table itself only points downwards through LAYER_ORDER', () => {
    for (const layer of LAYER_ORDER) {
      for (const target of LAYER_MAY_IMPORT[layer]) {
        expect(LAYER_ORDER.indexOf(target), `${layer} -> ${target}`).toBeLessThan(LAYER_ORDER.indexOf(layer));
      }
    }
    for (const [module, rule] of Object.entries(MODULE_RULES)) {
      expect(files, `MODULE_RULES lists a missing module: ${module}`).toContain(module);
      expect(LAYER_ORDER).toContain(rule.layer);
    }
  });

  it('main.ts stays a thin entry (<= 100 lines, ARCH-06)', () => {
    const lines = readFileSync(join(SRC, 'main.ts'), 'utf8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(100);
  });
});

describe('layering gate: side-effect rule (ARCH-06)', () => {
  it('no domain module touches document/window/storage at module top level', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (!SIDE_EFFECT_FREE_DIRS.includes(file.split('/')[0] ?? '')) continue;
      for (const name of topLevelGlobalUses(file, readFileSync(join(SRC, file), 'utf8'))) {
        if (!SIDE_EFFECT_EXEMPTIONS[`${file}:${name}`]) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('layering gate: negative self-tests', () => {
  it('rejects a features -> ui edge', () => {
    expect(findViolations([{ from: 'features/x.ts', to: 'ui/y.ts' }])).toHaveLength(1);
  });

  it('rejects ui -> features and domain -> higher-layer edges', () => {
    expect(findViolations([{ from: 'ui/user/x.ts', to: 'features/y.ts' }])).toHaveLength(1);
    expect(findViolations([{ from: 'realism/x.ts', to: 'lipsync/y.ts' }])).toHaveLength(1);
    expect(findViolations([{ from: 'avatar/x.ts', to: 'audio/y.ts' }])).toHaveLength(1);
  });

  it('rejects any importer of the container except main.ts, and importing from a contract layer is fine', () => {
    expect(findViolations([{ from: 'features/x.ts', to: 'app/container.ts' }])).toHaveLength(1);
    expect(findViolations([{ from: 'ui/user/x.ts', to: 'app/container.ts' }])).toHaveLength(1);
    expect(findViolations([{ from: 'main.ts', to: 'app/container.ts' }])).toEqual([]);
    expect(findViolations([{ from: 'features/x.ts', to: 'app/events.ts' }])).toEqual([]);
  });

  it('rejects an unclassified new app/ module', () => {
    expect(findViolations([{ from: 'app/new-thing.ts', to: 'types/avatar.ts' }])).toHaveLength(1);
  });

  it('the documented exception is the only audio -> lipsync edge allowed', () => {
    expect(findViolations([{ from: 'audio/a2f-backend.ts', to: 'lipsync/a2f-parser.ts' }])).toEqual([]);
    expect(findViolations([{ from: 'audio/audio-engine.ts', to: 'lipsync/a2f-parser.ts' }])).toHaveLength(1);
  });

  it('detects a cycle', () => {
    const cycle = findCycles([
      { from: 'a.ts', to: 'b.ts' },
      { from: 'b.ts', to: 'c.ts' },
      { from: 'c.ts', to: 'a.ts' },
    ]);
    expect(cycle).toHaveLength(1);
    expect(findCycles([{ from: 'a.ts', to: 'b.ts' }])).toEqual([]);
  });

  it('import parser sees static, type, re-export and dynamic imports', () => {
    const specs = importSpecifiers(
      'x.ts',
      [
        "import { a } from './a';",
        "import type { B } from '../b';",
        "export { c } from './c';",
        "export type { D } from './d';",
        "import './side';",
        "const lazy = () => import('./lazy');",
        "import * as THREE from 'three';",
      ].join('\n')
    );
    expect(specs).toEqual(['./a', '../b', './c', './d', './side', './lazy']);
  });

  it('side-effect detector flags top-level globals but not function bodies or typeof guards', () => {
    expect(topLevelGlobalUses('x.ts', 'const body = document.body;')).toEqual(['document']);
    expect(topLevelGlobalUses('x.ts', "const v = localStorage.getItem('k');")).toEqual(['localStorage']);
    expect(topLevelGlobalUses('x.ts', 'export function f() { return window.innerWidth; }')).toEqual([]);
    expect(topLevelGlobalUses('x.ts', 'class A { m() { return document.title; } }')).toEqual([]);
    expect(topLevelGlobalUses('x.ts', "const ok = typeof window !== 'undefined';")).toEqual([]);
    expect(topLevelGlobalUses('x.ts', 'const cb = () => navigator.userAgent;')).toEqual([]);
    expect(topLevelGlobalUses('x.ts', 'const o = { window: 1 }; o.window;')).toEqual([]);
  });
});
