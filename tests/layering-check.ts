/**
 * The layering decision as pure functions over the data in ./layering-rules (14-02, 18-04).
 *
 * One implementation, two consumers: tests/layering.test.ts (the CI gate over the whole import
 * graph) and eslint.config.ts (the editor rule, one file at a time). Both read the same rule
 * table AND the same decision code, so they cannot disagree. All module names are relative to
 * `src/` and use forward slashes. No vitest, no fs, no TypeScript compiler API here: it must load
 * in a plain Node context (ESLint flat config).
 */
import {
  DIR_LAYER,
  EXCEPTIONS,
  LAYER_MAY_IMPORT,
  MODULE_RULES,
  type Layer,
} from './layering-rules';

export interface Edge {
  from: string;
  to: string;
}

export function layerOf(module: string): Layer | undefined {
  const rule = MODULE_RULES[module];
  if (rule) return rule.layer;
  const top = module.split('/')[0] ?? '';
  return DIR_LAYER[top];
}

/** One human-readable problem for an edge, or undefined when the edge is allowed. */
export function violationOf({ from, to }: Edge): string | undefined {
  const fromLayer = layerOf(from);
  const toLayer = layerOf(to);
  if (!fromLayer) return `${from}: module is not classified (add it to MODULE_RULES / DIR_LAYER)`;
  if (!toLayer) return `${from} -> ${to}: target is not classified`;
  const excepted = EXCEPTIONS.some((e) => e.from === from && e.to === to);
  if (excepted) return undefined;
  const layerAllows = fromLayer === toLayer || LAYER_MAY_IMPORT[fromLayer].includes(toLayer);
  if (!layerAllows) return `${from} (${fromLayer}) -> ${to} (${toLayer}): layer may not import layer`;
  const importableBy = MODULE_RULES[to]?.importableBy;
  const targetAllows = !importableBy || fromLayer === toLayer || importableBy.includes(fromLayer);
  if (!targetAllows) return `${from} (${fromLayer}) -> ${to}: importable only by ${importableBy?.join(', ')}`;
  return undefined;
}

export function findViolations(edges: readonly Edge[]): string[] {
  const out: string[] = [];
  for (const edge of edges) {
    const problem = violationOf(edge);
    if (problem) out.push(problem);
  }
  return out;
}
