/**
 * The layering contract as DATA (14-02, ARCH-01).
 *
 * No imports and no test logic on purpose: tests/layering.test.ts enforces this table under
 * vitest, and Phase 18-04 imports the same constants from an ESLint flat config
 * (no-restricted-imports / boundaries) so the editor and CI agree. All paths are relative to
 * `src/` and use forward slashes.
 *
 * Layers, bottom to top. A module may import another module only if its layer is listed in
 * LAYER_MAY_IMPORT for the importing layer (or the pair is an entry in EXCEPTIONS). Imports
 * inside one layer are free. Every allowed edge points DOWN this list, which is why the
 * import graph has no cycles; the test re-checks that property of the table itself.
 */
export const LAYER_ORDER = [
  'types',
  'core',
  'scene',
  'prod',
  'realism',
  'avatar',
  'audio',
  'lipsync',
  'app-contracts',
  'features',
  'ui',
  'app-root',
  'entry',
] as const;

export type Layer = (typeof LAYER_ORDER)[number];

/** Layer of every top-level directory except `app/` (classified per module, see MODULE_RULES). */
export const DIR_LAYER: Readonly<Record<string, Layer>> = {
  types: 'types',
  core: 'core',
  scene: 'scene',
  prod: 'prod',
  realism: 'realism',
  avatar: 'avatar',
  audio: 'audio',
  lipsync: 'lipsync',
  features: 'features',
  ui: 'ui',
};

/**
 * `app/` is two roles, not one layer: the composition root (container.ts) imports everything,
 * while the contract modules are imported BY features/ui. So `app/` is classified per module;
 * a new file under `app/` that is not listed here fails the gate until it is classified.
 * `importableBy` further restricts who may import a module (by layer); absent = anyone the
 * layer table allows.
 */
export const MODULE_RULES: Readonly<Record<string, { layer: Layer; importableBy?: readonly Layer[] }>> = {
  'main.ts': { layer: 'entry' },
  // contracts: importable by features and ui (and the root)
  'app/app-types.ts': { layer: 'app-contracts' },
  'app/events.ts': { layer: 'app-contracts' },
  'app/ui-mode.ts': { layer: 'app-contracts' },
  'app/copy.ts': { layer: 'app-contracts' }, // the English UI string registry; imports nothing
  'app/store/settings-schema.ts': { layer: 'app-contracts' },
  'app/store/settings-store.ts': { layer: 'app-contracts' },
  'app/store/migrate.ts': { layer: 'app-contracts' },
  // transitional pre-F11 localStorage mirror: wired by the root only (see the REMOVE WHEN block in the file)
  'app/store/legacy-bridge.ts': { layer: 'app-contracts', importableBy: ['app-root'] },
  // the composition root: nothing imports it except main.ts
  'app/container.ts': { layer: 'app-root', importableBy: ['entry'] },
};

/** Which layers a layer may import (measured on the tree, 14-02; the gate freezes today's shape). */
export const LAYER_MAY_IMPORT: Readonly<Record<Layer, readonly Layer[]>> = {
  types: [],
  core: [],
  scene: [],
  prod: [],
  realism: ['types'],
  avatar: ['types'],
  audio: ['types'],
  lipsync: ['types', 'avatar', 'audio', 'realism'],
  'app-contracts': ['types', 'audio', 'lipsync'],
  features: ['types', 'core', 'scene', 'prod', 'realism', 'avatar', 'audio', 'lipsync', 'app-contracts'],
  // ui never imports features: panels receive injected services (AppServices).
  // ui -> scene is one edge (scene-panel -> scene/skin-shader: the SSS toggle reaches that
  // module's state directly, not through AppServices).
  ui: ['types', 'scene', 'lipsync', 'app-contracts'],
  'app-root': ['types', 'core', 'scene', 'prod', 'realism', 'avatar', 'audio', 'lipsync', 'app-contracts', 'features', 'ui'],
  entry: ['app-root', 'ui'],
};

/**
 * Edges that break LAYER_MAY_IMPORT on purpose. Each needs a reason; the gate fails on an
 * exception that no longer matches a real edge (stale) so this list can only shrink or be
 * justified. There is exactly one.
 */
export const EXCEPTIONS: readonly { from: string; to: string; reason: string }[] = [
  {
    from: 'audio/a2f-backend.ts',
    to: 'lipsync/a2f-parser.ts',
    reason:
      'The A2F HTTP client parses the server JSON with the lipsync A2F parser (audio -> lipsync is an upward edge, ' +
      'so audio and lipsync form a directory-level pair; there is no module-level cycle). Candidate fix, deferred: ' +
      'move a2f-backend.ts under lipsync/ (2 importers in features/ and 1 test would follow).',
  },
];

/** Directories whose modules must not touch DOM / storage globals at module top level (ARCH-06). */
export const SIDE_EFFECT_FREE_DIRS: readonly string[] = [
  'types',
  'core',
  'scene',
  'prod',
  'realism',
  'avatar',
  'audio',
  'lipsync',
  'features',
];

/** Globals that are forbidden at module top level in SIDE_EFFECT_FREE_DIRS. */
export const SIDE_EFFECT_GLOBALS: readonly string[] = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location'];

/** Top-level uses that were reviewed and are intentional: 'path:global' -> reason. Empty = none needed. */
export const SIDE_EFFECT_EXEMPTIONS: Readonly<Record<string, string>> = {};
