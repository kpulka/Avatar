/**
 * Rejestr źródeł animacji (Faza 11, 11-05, Pattern 4).
 *
 * Segment `LIVE | A2F` i porównywarka czytają źródła z tego rejestru — Faza 10 dorejestruje
 * `a2f-cloud` jako wpis DANYCH (zero zmian shella/HTML).
 */
import { AnimationMode } from '../types/avatar';

export interface AnimationSourceApplyContext {
  /** Przełączenie źródła w AnimationController (persist + defer). */
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
      console.warn(`[AnimationSourceRegistry] Źródło '${spec.id}' już zarejestrowane — nadpisuję.`);
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

/** Domyślne źródła wbudowane (F10 doda tu wpis 'a2f-cloud'). */
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
    // Dostępność realnie weryfikuje panel A2F (/status); segment nie blokuje wyboru.
    available: () => true,
    apply: (ctx) => ctx.setSource('frames'),
  });
  return registry;
}
