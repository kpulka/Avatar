import { CalibrationProfile, DEFAULT_CALIBRATION_PROFILE } from './calibration';

export interface VisemeQueueItem {
  epoch: number;
  shapes: Map<string, number>;
  startTimeSec: number;
  durationSec: number;
  char: string;
}

export interface SchedulerOptions {
  lambda?: number; // Szybkość reakcji mięśni ust (domyślnie 18 [1/s])
  blendInSec?: number; // Czas blend-in (domyślnie 35ms)
  blendOutSec?: number; // Czas blend-out (domyślnie 45ms)
  calibrationProfile?: Partial<CalibrationProfile>;
}

/**
 * Silnik harmonogramowania i koartykulacji wizemów mowy (docs/3)
 */

/** Twardy sufit efektywnego mouthClose — chroni MetaPerson przed deformacją "warga na nos". */
const CLOSE_SAFETY_CAP = 0.85;

export class VisemeScheduler {
  private queue: VisemeQueueItem[] = [];
  /** Baza lambda koartykulacji [1/s] — lustro profile.coarticulationSpeed (LIPS-06);
   *  pętla wygładzania używa per-grupowych tierów lambdaForShape. */
  private lambda: number;
  private readonly blendInSec: number;
  private readonly blendOutSec: number;
  private profile: CalibrationProfile = { ...DEFAULT_CALIBRATION_PROFILE };

  // Wygładzone wagi bieżącej klatki (shape -> weight)
  private readonly currentWeights: Map<string, number> = new Map();

  constructor(options: SchedulerOptions = {}) {
    if (options.calibrationProfile) {
      this.profile = { ...this.profile, ...options.calibrationProfile };
    }
    this.lambda = options.lambda ?? this.profile.coarticulationSpeed ?? 18;
    this.blendInSec = options.blendInSec ?? 0.035;
    this.blendOutSec = options.blendOutSec ?? 0.045;
  }

  public setCalibrationProfile(profile: Partial<CalibrationProfile>): void {
    this.profile = { ...this.profile, ...profile };
    if (profile.coarticulationSpeed !== undefined) {
      this.lambda = profile.coarticulationSpeed;
    }
  }

  public getCalibrationProfile(): CalibrationProfile {
    return { ...this.profile };
  }

  public enqueue(item: VisemeQueueItem): void {
    this.queue.push(item);
  }

  public clear(): void {
    this.queue = [];
  }

  public purgeStaleEpochs(activeEpoch: number): void {
    this.queue = this.queue.filter((item) => item.epoch === activeEpoch);
  }

  /**
   * Główny krok obliczeniowy koartykulacji wywoływany w każdej klatce (dt w sekundach)
   * Zwraca mapę zaktualizowanych wag wszystkich kluczy mowy.
   */
  public update(
    nowSec: number,
    dt: number,
    activeEpoch: number,
    speechShapes: string[]
  ): Map<string, number> {
    const targets = new Map<string, number>();

    // 1. Czyszczenie przedawnionych elementów kolejki
    this.queue = this.queue.filter((item) => {
      if (item.epoch !== activeEpoch) return false;
      return nowSec <= item.startTimeSec + item.durationSec + this.blendOutSec;
    });

    let activeMouthClose = 0;

    // 2. Sumowanie wkładów aktywnych wizemów (additive blending z limitem 1.0)
    for (const item of this.queue) {
      if (item.epoch !== activeEpoch) continue;

      const elapsed = nowSec - item.startTimeSec;
      if (elapsed < -this.blendInSec || elapsed > item.durationSec + this.blendOutSec) continue;

      const weight = this.computeEasing(elapsed, item.durationSec);

      for (const [shape, maxVal] of item.shapes.entries()) {
        // Wartości z tabeli wizemów (docs/3) są wartościami EFEKTYWNYMI (LIPS-06):
        // scheduler mnoży je DOKŁADNIE RAZ przez mnożnik gustowy profilu kalibracji.
        // Wszystkie pozostałe kształty (tongueOut itd.) bez dodatkowego tłumienia (1.0).
        const contribution = maxVal * this.scaleForShape(shape) * weight;
        const currentTarget = targets.get(shape) ?? 0;
        targets.set(shape, Math.max(currentTarget, contribution));

        if (shape === 'mouthClose') {
          activeMouthClose = Math.max(activeMouthClose, targets.get(shape)!);
        }
      }
    }

    // 3. Priorytetowe domknięcie ust: mouthClose tłumi jawOpen (LIPS-02)
    if (activeMouthClose > 0.15) {
      const currentJaw = targets.get('jawOpen') ?? 0;
      targets.set('jawOpen', currentJaw * Math.max(0, 1 - (activeMouthClose / this.profile.closeScale) * 0.95));
    }

    // 4. Wygładzanie niezależne od FPS (exponential damping): alpha = 1 - exp(-lambda * dt)
    // Lambda jest PER GRUPA MIĘŚNI (domknięcia szybkie, smile wolny), baza = coarticulationSpeed.
    const updated = new Map<string, number>();

    for (const shape of speechShapes) {
      if (shape.startsWith('eyeBlink')) continue;

      const alpha = 1 - Math.exp(-this.lambdaForShape(shape) * dt);

      // Reguła fundamentu: brak wkładu -> target = 0.0 (wygaszanie do neutralu)
      const target = targets.get(shape) ?? 0.0;
      const current = this.currentWeights.get(shape) ?? 0.0;
      const next = current + (target - current) * alpha;

      // Jeśli waga jest minimalna (< 0.001), zresetuj do twardego 0
      const finalWeight = next < 0.001 ? 0 : next;
      this.currentWeights.set(shape, finalWeight);
      updated.set(shape, finalWeight);
    }

    return updated;
  }

  /**
   * Mnożnik gustowy z profilu kalibracji dla pojedynczego kształtu (LIPS-06).
   * Wartości tabeli wizemów są efektywne; profil to lekka korekta smaku wokół 1.0.
   */
  private scaleForShape(shape: string): number {
    const p = this.profile;
    if (shape === 'mouthClose' || shape === 'mouthPressLeft' || shape === 'mouthPressRight') {
      // Bezpieczenstwo MetaPerson: powyzej ~0.85 morph mouthClose ciagnie dolną wargę na nos.
      // Sufit twardy — niezalezny od suwaka (domyslne presety ustawione nizej).
      return Math.min(p.closeScale, CLOSE_SAFETY_CAP);
    }
    if (shape === 'jawOpen') return p.jawScale;
    if (shape.startsWith('mouthSmile')) return p.smileScale;
    if (shape === 'mouthPucker') return p.puckerScale;
    if (shape === 'mouthFunnel') return p.funnelScale;
    if (shape === 'mouthRollLower' || shape.startsWith('mouthShrug')) return p.rollScale;
    if (shape.startsWith('mouthUpperUp') || shape.startsWith('mouthLowerDown')) return p.teethExposureScale;
    return 1.0; // tongueOut i pozostałe — bez dodatkowego tłumienia
  }

  /**
   * Lambda wygładzania per grupa mięśni. Baza = this.lambda — lustro
   * coarticulationSpeed z profilu (konstruktor i setCalibrationProfile
   * synchronizują oba; domyślnie 18). Krótkie spółgłoski EN (domknięcia 40-80 ms)
   * muszą zdążyć osiągnąć kształt, a uśmiech mowy ma wracać wolno (docs/3).
   */
  private lambdaForShape(shape: string): number {
    const cs = this.lambda; // baza = coarticulationSpeed profilu, domyślnie 18
    if (shape === 'mouthClose' || shape === 'mouthPressLeft' || shape === 'mouthPressRight') return cs * 1.7;
    if (shape === 'jawOpen' || shape === 'tongueOut') return cs * 1.55;
    if (shape.startsWith('mouthSmile')) return cs * 0.45;
    return cs; // pucker, funnel, roll, shrug, upperUp, lowerDown
  }

  /**
   * Oblicza wagę z cosine blend-in, hold i blend-out
   */
  public computeEasing(elapsed: number, duration: number): number {
    if (elapsed < 0) {
      // Blend-in
      const t = (elapsed + this.blendInSec) / this.blendInSec;
      return Math.sin((Math.max(0, Math.min(1, t)) * Math.PI) / 2);
    }

    if (elapsed <= duration) {
      // Hold
      return 1.0;
    }

    // Blend-out
    const outElapsed = elapsed - duration;
    const t = 1 - outElapsed / this.blendOutSec;
    return Math.sin((Math.max(0, Math.min(1, t)) * Math.PI) / 2);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getWeight(shape: string): number {
    return this.currentWeights.get(shape) ?? 0;
  }

  public resetAll(): void {
    this.currentWeights.clear();
    this.queue = [];
  }
}
