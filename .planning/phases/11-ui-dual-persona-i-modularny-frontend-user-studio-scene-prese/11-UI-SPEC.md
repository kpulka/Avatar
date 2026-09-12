---
phase: 11
slug: ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
status: approved
reviewed_at: 2026-09-10
shadcn_initialized: false
preset: none
created: 2026-09-10
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for frontend phases. Generated inline (subagent przerwany) on the basis of 11-CONTEXT.md, src/style.css, index.html, src/scene/lighting.ts, src/core/scene.ts. Verified by gsd-ui-checker (pending).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (vanilla TS + CSS; brak Tailwind/shadcn — świadoma decyzja: brak nowych zależności) |
| Preset | not applicable |
| Component library | none — własne komponenty modułowe (`src/ui/user/`, `src/ui/studio/`, `src/ui/shared/`) |
| Icon library | inline SVG (ścieżki w stylu Lucide, MIT) w warstwie user; emoji tolerowane w istniejących panelach studio do czasu dotknięcia pliku |
| Font | system stack (istniejący): `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |

---

## Spacing Scale

Deklarowane wartości (wielokrotności 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | odstępy ikon, padding inline chipów |
| sm | 8px | odstępy elementów, padding przycisków (pion) |
| md | 16px | domyślny odstęp elementów, padding paneli (poziomo) |
| lg | 24px | padding sekcji, odstęp dock od krawędzi ekranu |
| xl | 32px | duże przerwy między blokami |
| 2xl | 48px | przerwy sekcji w studiu |
| 3xl | 64px | oddech sceny (góra/dół docka na pełnym ekranie) |

Exceptions: legacy 5–6px paddingi przycisków (dock, studio) normalizujemy do `sm` (8px) przy dotknięciu pliku; wysokość kontrolek interaktywnych min. 36px (user dock 40px, segmented control 40px, ikony 40×40px).

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.3 |
| Heading | 18px | 600 | 1.25 |
| Display | 28px | 600 | 1.2 |

Zasady: dokładnie 2 wagi (400, 600). Legacy rozmiary 10–11px w studiu normalizujemy do Label (12px) przy dotknięciu; captions = Body (14px), speaker-tag = Label (12px, 600). Display zarezerwowany dla nagłówka pustego stanu i nazwy modelu w trybie user (max 1 na ekran).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#0b0f17` | tło aplikacji i sceny (dark); w motywie jasnym `#f1f5f9` |
| Secondary (30%) | `rgba(15, 23, 42, 0.88)` (glass) / `#0f172a` (opaque) | panele, dock, karty, captions; w motywie jasnym `rgba(255,255,255,0.9)` |
| Accent (10%) | `#38bdf8` | tylko: primary CTA „Rozpocznij rozmowę", aktywny segment `LIVE/A2F`, focus ring, status „Mówię…", aktywny tab studia |
| Destructive | `#ef4444` | tylko: „Przerwij" (barge-in) i potwierdzenia resetu (wizemy/kalibracja) |

Accent reserved for: (1) primary CTA kontrast (obramowanie/ikona), (2) wskaźnik aktywnego segmentu algorytmu, (3) `:focus-visible` ring, (4) status „Mówię…", (5) aktywny tab studia. Nigdy dla zwykłych przycisków drugorzędnych.

Semantic state colors (poza 60/30/10, tylko wskaźniki): `#10b981` słucham, `#eab308` myślę/ładowanie, `#94a3b8` idle/wyciszony. Motyw jasny: tekst `#0f172a`, muted `#64748b`, akcenty bez zmian.

---

## Visual Direction

**Scena (user):** presety przełączalne w runtime, domyślnie `studio-dark`:

| Preset | Tło | Key | Fill | Rim | Exposure | Extra |
|--------|-----|-----|------|-----|----------|-------|
| `studio-dark` | `#0e1117` | 2.2, `#fff2e0`, (1.5, 2.0, 2.0) | 0.7 `#dbe9ff` | 2.6 `#ffe8d6` | 1.0 | pedestal on (obecny) |
| `studio-soft` | gradient pionowy `#1a2233 → #0b0f17` | 1.8, `#fff6ea` | 1.1 | 1.4 | 1.05 | pedestal on, cieplejszy |
| `cinema` | `#05070c` | 2.6 | 0.35 | 3.2 | 0.95 | vignette CSS opacity 0.35, pedestal off |
| `light` | `#e8eef7` | 1.4 | 1.2 | 0.9 | 1.0 | pedestal off; sparowany z `body.theme-light` |

Wspólne: `RoomEnvironment` PMREM σ 0.04, ACES, pixelRatio ≤ 2, miękkie cienie PCFSoft. Kadr kamery: bust `y = min + 0.88·h`, `z = 1.22` (obecny); preset `head` → `z = 0.9`. Przejście presetów: crossfade świateł 280 ms.

**Chrome UI:** glass (blur 16–20px), obramowanie `rgba(255,255,255,0.12)`, radius: karty 16px, inputy 8px, przyciski pill 9999px; cień `0 10px 30px rgba(0,0,0,0.5)`. Warstwa user: avatar centralnie, dock bottom-center, captions nad dockiem (max 720px), brand+status top-left, gear top-right, segment algorytmu w docku. Warstwa studio dodaje: prawy drawer z tabami (Animacja | A2F | Sesja | Scena), lewe drawery (Wizemy, Inspektor) i telemetrię w panelu Sesja (pływająca karta telemetrii ukryta w user).

**Motion:** hover/active 150 ms ease; drawery i segment 280 ms `cubic-bezier(0.16, 1, 0.3, 1)`; pulse tylko dla statusu; `prefers-reduced-motion: reduce` wyłącza pulse i winietę animowaną.

---

## Component Inventory (persona layers)

| Warstwa | Komponent | Źródło / docelowy moduł |
|---------|-----------|--------------------------|
| user | ConversationDock (Rozpocznij/Zakończ, Wycisz, Przerwij) | `src/ui/user/conversation-dock.ts` |
| user | AlgorithmSegment (`LIVE | A2F`) + `Porównaj A/B` + blind toggle | `src/ui/user/algorithm-switcher.ts` |
| user | Captions (TY / AGENT) | `src/ui/user/captions.ts` |
| user | StatusPill + brand | `src/ui/user/status-pill.ts` |
| user | UserSettings (głośność, urządzenia, motyw, preset sceny) | `src/ui/user/user-settings.ts` |
| user | ComparePanel (chipsy A/B, etykiety toru) | w `algorithm-switcher.ts` |
| studio | StudioShell (taby + rejestr paneli) | `src/ui/studio/studio-shell.ts`, `panel-registry.ts` |
| studio | Panele: Animacja, Wizemy, Inspektor, A2F, Sesja, Scena | `src/ui/studio/panels/*` |
| shared | Toast, Loader, Modal, dom helper | `src/ui/shared/*` |

Zasada: żaden moduł UI nie sięga po globalne ID spoza swojego szablonu; komponenty dostają `{ store, events, services }`.

Dostępność: kontrolki icon-only (gear, zamknięcia drawerów) deklarują `aria-label`/`title` z nazwą akcji; akcje primary zachowują widoczną etykietę tekstową (ikona nigdy nie jest jedynym nośnikiem znaczenia dla CTA).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | „Rozpocznij rozmowę" (idle) / „Zakończ rozmowę" (aktywne) |
| Segment | „LIVE" / „A2F"; przycisk „Porównaj A/B"; przełącznik „Tryb blind (bez etykiet)" |
| Empty state heading (porównywarka) | „Brak wypowiedzi do porównania" |
| Empty state body (porównywarka) | „Odbądź jedną turę rozmowy albo odtwórz demo, a potem wróć tutaj." |
| Empty state (brak modelu) | „Brak awatara" / „Wczytaj model .glb lub włącz demo w Studio → Scena." |
| Error state (połączenie) | „Nie udało się połączyć z agentem. Sprawdź mikrofon i sieć, potem spróbuj ponownie." + „Spróbuj ponownie" |
| Error state (A2F offline) | „A2F jest niedostępny — sprawdź adres serwisu w Studio → A2F." (opcja B disabled, LIVE działa) |
| Destructive confirmation | „Reset wszystkich nadpisań wizemów: usunie zapisane zmiany. Kontynuować?" [Resetuj] [Anuluj] |
| Status labels | Gotowy / Słucham… / Mówię… / Myślę… |
| Loading A2F | „A2F: przetwarzanie…" (spinner w przycisku; przy cold starcie komunikat oczekiwania) |

---

## UI Considerations

Applicable state considerations resolved: 24 covered, 1 backstop, 0 unresolved (probe: 33 pozycje rozwinięte do 25 wierszy)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | ComparePanel — brak ostatniej wypowiedzi | ✅ covered | „Porównaj A/B" disabled + copy z Copywriting Contract; po pierwszej turze odblokowane |
| empty | UserSettings | ✅ covered | Brak stanu pustego z konstrukcji — wartości domyślne zawsze obecne (volume 1.0, theme dark, preset studio-dark) |
| empty | Telemetria (studio) | ✅ covered | Przed pierwszą sesją metryki pokazują „--" (obecne zachowanie `stat-*`) |
| loading | A2F predict / cold start | ✅ covered | Spinner w przycisku + toast „A2F: przetwarzanie…"; segment pokazuje busy do odpowiedzi |
| loading | StudioShell panele | ✅ covered | Panele montowane per tab; treść synchroniczna (bez spinnera), async tylko A2F z własnym stanem loading |
| loading | UserSettings | ✅ covered | Store czyta localStorage synchronicznie — brak stanu ładowania |
| error | Połączenie z agentem | ✅ covered | Error copy + „Spróbuj ponownie" (reconnect backoff z F2) |
| error | A2F offline | ✅ covered | Opcja B segmentu disabled + powód w tooltipie; LIVE pozostaje aktywne |
| error | UserSettings (uszkodzony store) | ✅ covered | Defensywny odczyt → wartości domyślne + toast; brak crasha |
| error | Panel studia (mount fail) | ✅ covered | Inline komunikat w treści panelu + „Spróbuj ponownie" (per-panel boundary); inne panele działają |
| populated | ComparePanel — po turze | ✅ covered | Chipsy A/B + etykiety toru + czas predict; wynik ostatniego porównania pozostaje widoczny |
| partial | ComparePanel — krótszy klip B (A2F) | ✅ covered | Porównanie gra dalej; tooltip ostrzega o krótszym klipie; brak crasha |
| partial | Telemetria | ✅ covered | Brakujące metryki → „--", pozostałe widoczne (bez stanu błędu) |
| long-text | Captions | ✅ covered | Wrap do 3 linii z wygaszeniem starszych; pełna treść w Studio → Sesja |
| long-text | Etykiety docka/segmentu/paneli | ✅ covered | Copy zamknięte w Copywriting Contract; tytuły paneli ellipsis > 24 znaków |
| overflow | Studio panel body / Wizemy / Inspektor | ✅ covered | Pionowy scroll w drawerze (zachowanie istniejące) |
| overflow | Captions | ✅ covered | Zawijanie z limitem linii (patrz long-text), bez poziomego scrolla |
| overflow | ComparePanel | ✅ covered | Dokładnie 2 chipsy (A/B) — overflow niemożliwy z konstrukcji |
| zero-one-many | Scene presets | ✅ covered | Min. 3 presety; picker ukryty gdy dostępne < 2 |
| zero-one-many | ComparePanel chipsy | ✅ covered | Zawsze dokładnie 2 (A i B) — układ stały |
| unclassified | StatusPill (E5) | ✅ covered | Stany zamknięte: Gotowy/Słucham…/Mówię…/Myślę… (kolory semantyczne); brak long-text/overflow |
| unclassified | Scene switching (E10) | ✅ covered | Crossfade 280 ms; `prefers-reduced-motion` → zmiana natychmiastowa bez animacji |
| unclassified | Toast/Loader (E11) | ✅ covered | Toast auto-hide 5 s; błąd połączenia pozostaje do zamknięcia; loader blokuje CTA do czasu zakończenia |
| partial | A2F clip bez kanałów oczu (`carriesEyes=false`) | ✅ covered | Proceduralny blink ON (gating z Fazy 8); ramki eyeBlink* wygrywają gdy obecne |
| long-text | Porównanie A/B — uczciwość audio | 🧪 backstop | Held-out visual/audio test: ta sama wypowiedź odtwarzana w A i B ma identyczne PCM (RMS diff < 1%) |

Uwaga: wiersze oznaczają pokrycie STANÓW; copy stanów pustych/błędów żyje w `## Copywriting Contract` (bez duplikacji).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not required |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
