/**
 * Animation source registry (Phase 11, 11-05, Pattern 4).
 *
 * The `LIVE | A2F` segment and the comparison tool read sources from this registry — Phase 10 will register
 * `a2f-cloud` as a DATA entry (zero shell/HTML changes).
 */
import { AnimationMode } from '../types/avatar';

export interface AnimationSourceApplyContext {
  /** Switching the source in AnimationController (persist + defer). */
  setSource(mode: AnimationMode): void;
}

export interface AnimationSourceSpec {
  id: string;
  label: string;
  short: 'LIVE' | 'A2F';
  available(): boolean | Promise<boolean>;
  apply(ctx: AnimationSourceApplyContext): void;
}

export class AnimationSourceRegistry {
  private readonly specs = new Map<string, AnimationSourceSpec>();

  public register(spec: AnimationSourceSpec): void {
    if (this.specs.has(spec.id)) {
      console.warn(`[AnimationSourceRegistry] Source '${spec.id}' is already registered — overwriting.`);
    }
    this.specs.set(spec.id, spec);
  }

  public list(): AnimationSourceSpec[] {
    return [...this.specs.values()];
  }

  public get(id: string): AnimationSourceSpec | undefined {
    return this.specs.get(id);
  }
}

/** Built-in default sources (F10 will add the 'a2f-cloud' entry here). */
export function createDefaultAnimationSources(): AnimationSourceRegistry {
  const registry = new AnimationSourceRegistry();
  registry.register({
    id: 'viseme',
    label: 'LIVE wizemy',
    short: 'LIVE',
    available: () => true,
    apply: (ctx) => ctx.setSource('viseme'),
  });
  registry.register({
    id: 'a2f-local',
    label: 'A2F (lokalny)',
    short: 'A2F',
    // Availability is actually verified by the A2F panel (/status); the segment does not block selection.
    available: () => true,
    apply: (ctx) => ctx.setSource('frames'),
  });
  return registry;
}
