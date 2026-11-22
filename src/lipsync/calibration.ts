/**
 * Moduł konfiguracji i profili kalibracji fonetycznej (Lip-Sync Calibrator)
 */

export interface CalibrationProfile {
  /** Mnożnik gustowy głębokości otwierania żuchwy (jawOpen) [0.5 - 1.3] — wartości tabeli wizemów są efektywne */
  jawScale: number;
  /** Mnożnik gustowy domykania warg (mouthClose) dla M/B/P [0.5 - 1.2] */
  closeScale: number;
  /** Mnożnik gustowy zaokrąglenia warg (mouthPucker) dla O/U/W [0.4 - 1.3] */
  puckerScale: number;
  /** Mnożnik gustowy tuby wargowej (mouthFunnel) dla O/SZ/CZ [0.4 - 1.3] */
  funnelScale: number;
  /** Mnożnik gustowy podwinięcia dolnej wargi (mouthRollLower) dla F/V [0.4 - 1.3] */
  rollScale: number;
  /** Mnożnik gustowy odsłaniania zębów / unoszenia warg (mouthUpperUp + mouthLowerDown) dla F/V i SZ/CZ [0.4 - 1.3] */
  teethExposureScale: number;
  /** Mnożnik gustowy rozciągnięcia kącików w uśmiechu mowy (mouthSmile) [0.4 - 1.3] */
  smileScale: number;
  /** Szybkość reakcji mięśni aparatu mowy (lambda koartykulacji) [8 - 35] */
  coarticulationSpeed: number;
  /**
   * Przesunięcie synchronizacji Audio-Wideo w milisekundach [-150ms .. +400ms].
   * DODATNIE = usta później względem dźwięku (audio prowadzi). Obserwacja live (2026-09-02):
   * alignment tekstu EL bywa wcześniejszy niż audio → usta wyprzedzają dźwięk, więc typowo
   * potrzebne są wartości dodatnie (~+100..+250). Zob. docs/3 (rescale/offset AV).
   */
  syncOffsetMs: number;
  /**
   * Version of the A/V sync clock semantics the stored syncOffsetMs refers to.
   * Absent / < SYNC_CLOCK_VERSION = legacy value tuned against ctx.currentTime (migrated once on load).
   */
  clockVersion: number;
}

/** Legacy hand-tuned preset offsets (stand-in for output latency, pre Phase 11.2 D-6). */
export const LEGACY_SYNC_OFFSETS = [90, 100, 120] as const;
/** Current sync-clock semantics: mouth timing follows the audible time (Phase 11.2 D-6). */
export const SYNC_CLOCK_VERSION = 2;

export type CalibrationPresetName = 'subtle' | 'balanced' | 'expressive';

// Presety to MNOŻNIKI GUSTOWE wokół 1.0 — wartości z tabeli wizemów (docs/3) są już
// wartościami efektywnymi (LIPS-06). balanced (1.0) = dokładnie tabela, bez tłumienia.
export const CALIBRATION_PRESETS: Record<CalibrationPresetName, CalibrationProfile> = {
  subtle: {
    jawScale: 0.85,
    closeScale: 0.50, // MetaPerson: wysokie mouthClose ciągnie dolną wargę na nos — trzymaj nisko
    puckerScale: 0.85,
    funnelScale: 0.85,
    rollScale: 0.85,
    teethExposureScale: 0.85,
    smileScale: 0.85,
    coarticulationSpeed: 30, // ustawienie użytkownika (ostre, wyraźne przejścia)
    // Residual A/V offset after audible-clock compensation (Phase 11.2 D-6); was a stand-in for output latency.
    syncOffsetMs: 20,
    clockVersion: SYNC_CLOCK_VERSION,
  },
  balanced: {
    jawScale: 1.00,
    closeScale: 0.60, // bezpieczne domknięcie M/B/P — bez deformacji "warga na nos"
    puckerScale: 1.00,
    funnelScale: 1.00,
    rollScale: 1.00,
    teethExposureScale: 1.00,
    smileScale: 1.00,
    coarticulationSpeed: 30,
    // Residual A/V offset after audible-clock compensation (Phase 11.2 D-6); was a stand-in for output latency.
    syncOffsetMs: 30,
    clockVersion: SYNC_CLOCK_VERSION,
  },
  expressive: {
    jawScale: 1.15,
    closeScale: 0.70,
    puckerScale: 1.15,
    funnelScale: 1.15,
    rollScale: 1.15,
    teethExposureScale: 1.15,
    smileScale: 1.15,
    coarticulationSpeed: 30,
    // Residual A/V offset after audible-clock compensation (Phase 11.2 D-6); was a stand-in for output latency.
    syncOffsetMs: 40,
    clockVersion: SYNC_CLOCK_VERSION,
  },
};

export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = CALIBRATION_PRESETS.balanced;

const STORAGE_KEY = 'avatar_lip_calibration_profile_v3';

/**
 * Wczytuje zapisany profil kalibracji z localStorage lub zwraca domyślny
 */
export function loadCalibrationProfile(): CalibrationProfile {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CalibrationProfile>;
        return { ...DEFAULT_CALIBRATION_PROFILE, ...parsed };
      }
    } catch (e) {
      console.warn('[Calibration] Nie udało się odczytać profilu z localStorage:', e);
    }
  }
  return { ...DEFAULT_CALIBRATION_PROFILE };
}

/**
 * Zapisuje aktywny profil kalibracji do localStorage
 */
export function saveCalibrationProfile(profile: CalibrationProfile): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('[Calibration] Błąd zapisu profilu do localStorage:', e);
    }
  }
}

/**
 * Resetuje zapisany profil w localStorage do wartości fabrycznych
 */
export function resetCalibrationProfile(): CalibrationProfile {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[Calibration] Błąd resetu localStorage:', e);
    }
  }
  return { ...DEFAULT_CALIBRATION_PROFILE };
}
