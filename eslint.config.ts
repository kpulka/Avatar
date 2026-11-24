/**
 * ESLint flat config (18-04, QUAL-05).
 *
 * Three things live here:
 *  1. typescript-eslint recommended-type-checked over src/ and tests/ (project: tsconfig.test.json,
 *     the same program `npm run typecheck` uses);
 *  2. a small local rule, `layering/import-layers`, that enforces the import-layer contract. It reads
 *     the SAME rule table (tests/layering-rules.ts) and the SAME decision function
 *     (tests/layering-check.ts) as the CI gate tests/layering.test.ts, so the editor and CI cannot
 *     disagree;
 *  3. a handful of sensible base rules (eqeqeq, prefer-const, no-console as a warning).
 *
 * This file is TypeScript on purpose: ESLint loads it through jiti (devDependency), which is also
 * what lets it import the .ts rule data directly. Nothing here is ever bundled.
 */
import { existsSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import type { Rule } from 'eslint';
import tseslint from 'typescript-eslint';
import { violationOf } from './tests/layering-check';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');

/** Resolve a relative specifier to a module name under src/ ('a/b.ts'), or undefined (non-code, unknown). */
function resolveModule(fromModule: string, spec: string): string | undefined {
  if (!spec.startsWith('.') || /\.(css|json|svg|png|glb)$/.test(spec)) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(fromModule), spec));
  return [`${base}.ts`, `${base}/index.ts`, base].find((candidate) => candidate.endsWith('.ts') && existsSync(join(SRC, candidate)));
}

const importLayers: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Imports must follow the layer contract in tests/layering-rules.ts' },
    schema: [],
    messages: { forbidden: '{{ problem }}' },
  },
  create(context) {
    const rel = relative(SRC, context.filename);
    if (rel.startsWith('..') || !rel.endsWith('.ts') || rel.endsWith('.d.ts')) return {};
    const from = rel.split(sep).join('/');
    // `source` is typed loosely: ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration and
    // ImportExpression all carry a string-literal `source`.
    const check = (node: Rule.Node, source: { type: string; value?: unknown } | null | undefined): void => {
      if (!source || source.type !== 'Literal' || typeof source.value !== 'string') return;
      const to = resolveModule(from, source.value);
      if (!to) return;
      const problem = violationOf({ from, to });
      if (problem) context.report({ node, messageId: 'forbidden', data: { problem } });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
    };
  },
};

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', 'a2f/**', 'scripts/**', '.claude/**', '.planning/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parserOptions: { project: ['./tsconfig.test.json'], tsconfigRootDir: ROOT },
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      // console.warn / console.error are the diagnostic channels and are always allowed. console.log is
      // the trace channel: every use is a warning that must carry an inline, reasoned disable, so a new
      // one cannot appear silently (`npm run lint` runs with --max-warnings 0).
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // The usual convention: a leading underscore marks a deliberately unused parameter / catch binding.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    // Test doubles implement Promise-returning interfaces with synchronous bodies (`async () => value`).
    // Dropping the async keyword would change throw-vs-reject behaviour of the mocks, so the rule is
    // off for tests/ only. It stays an error in src/.
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { layering: { rules: { 'import-layers': importLayers } } },
    rules: { 'layering/import-layers': 'error' },
  }
);
