/**
 * Animation source registry (Phase 11, 11-05, Pattern 4).
 *
 * The `LIVE | A2F` segment and the comparison tool read sources from this registry — Phase 10 will register
 * `a2f-cloud` as a DATA entry (zero shell/HTML changes).
 *
 * REGION OWNERSHIP MODEL (the AvatarDirector decomposition seam, 16-06). Every region of the avatar
 * has exactly ONE owner/writer; a source feeds an owner, it never writes a region itself:
 *
 *   region                       owner (single writer)            fed by
 *   ---------------------------  -------------------------------  ------------------------------
 *   face morphs (52 ARKit)       FaceController (since 16-02)     viseme / frames track sources,
 *                                                                 blink + gaze + emotion providers
 *   eyeball bones                GazeSaccades (via SceneController, gated by carriesEyes)
 *   head / chest bones           HeadMicroMovements
 *   body / gestures (future)     AvatarDirector region owner TBD  a new source registers HERE and
 *                                                                 feeds its own region owner
 *
 * Two layers, deliberately separate:
 *  - THIS registry describes the user-facing choices (id, label, short badge, availability).
 *  - `FaceController.registerTrackSource(id, adapter)` (FaceTrackSource, types/avatar.ts) is the runtime
 *    seam for sources that drive the FACE; `kind` is 'viseme' | 'frames' (two payload kinds today).
 * Registration contract: pick a unique `id`; `short` is an OPEN string badge (display name lives in
 * `label`); `apply()` selects the source via `ctx.setSource(mode)`; the runtime adapter must only
 * route data through FaceTrackContext.
 */
import { AnimationMode } from '../types/avatar';

export interface AnimationSourceApplyContext {
  /** Switching the source in AnimationController (persist + defer). */
  setSource(mode: AnimationMode): void;
}

/**
 * Short badge id of a source (what the segmented switcher shows). Open string: reserved ids today are
 * 'LIVE' and 'A2F'; a third source brings its own (e.g. 'GESTURE') without editing this type.
 */
export type AnimationSourceId = string;

export interface AnimationSourceSpec {
  id: string;
  label: string;
  short: AnimationSourceId;
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
    label: 'LIVE visemes',
    short: 'LIVE',
    available: () => true,
    apply: (ctx) => ctx.setSource('viseme'),
  });
  registry.register({
    id: 'a2f-local',
    label: 'A2F (local)',
    short: 'A2F',
    // Availability is actually verified by the A2F panel (/status); the segment does not block selection.
    available: () => true,
    apply: (ctx) => ctx.setSource('frames'),
  });
  return registry;
}
