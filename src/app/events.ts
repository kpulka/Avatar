/**
 * Typowany event bus aplikacji (Faza 11, Pattern 2).
 *
 * Zasady:
 * - `on` zwraca `Unsub` (idempotentny) — komponenty MUSZĄ odpinać w `destroy()`,
 * - `emit` iteruje po kopii zbioru — odpinanie w trakcie emisji nie gubi subskrybentów,
 * - błąd jednego handlera nie przerywa emisji.
 */
export type Unsub = () => void;

export type EventHandler<Payload> = (payload: Payload) => void;

export class TypedEventBus<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<never>>>();

  public on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): Unsub {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<never>);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      set?.delete(handler as EventHandler<never>);
    };
  }

  public off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler<never>);
  }

  public emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) {
      try {
        (handler as EventHandler<Events[K]>)(payload);
      } catch (error) {
        console.warn(`[EventBus] Błąd handlera dla '${String(type)}':`, error);
      }
    }
  }

  public clear(): void {
    this.handlers.clear();
  }
}

/** Zbieracz subskrypcji — jedno miejsce na `dispose()`. */
export function disposables(): { add(unsub: Unsub): void; dispose(): void; size(): number } {
  const collected: Unsub[] = [];
  return {
    add(unsub: Unsub) {
      collected.push(unsub);
    },
    dispose() {
      for (const unsub of collected.splice(0)) {
        try {
          unsub();
        } catch {
          /* ignore */
        }
      }
    },
    size() {
      return collected.length;
    },
  };
}
