---
phase: "10"
name: "A2F w chmurze — Cloud Run MVP (L4)"
created: "2026-09-02"
updated: "2026-09-02 (po review: polityka scale-to-zero ONLY — płacimy wyłącznie za przetwarzanie)"
---

# Phase 10: A2F w chmurze — Cloud Run MVP (L4) — Context

## Warunek startu
**Tylko po GO z Fazy 9** (09-VERIFICATION.md). Jeśli NO-GO — faza zawieszona w ROADMAP.

## Polityka kosztowa (decyzja użytkownika 2026-09-02 — NIE negocjowana)
**Płacimy WYŁĄCZNIE za przetwarzanie (per request/instance-time), zero stałego serwera.**
- **scale-to-zero ALWAYS ON; `min-instances` = 0 na stałe** (żadnych „okien demo z warmem"
  ani prewarm-pingów — utrzymanie instancji = koszt jak min-instances).
- **`--no-gpu-zonal-redundancy`** (zonal redundancy to domyślne ON i +56% ceny GPU — niepotrzebne
  dla demo).
- Realny koszt aktywna instancja (us-central1, 8 vCPU/32 GiB + L4): **~$1,42/h** (GPU no-zonal
  $0,67/h + CPU/mem); **min. 1 min billable na instancję** → pojedynczy request ze scale-to-zero
  ≈ **$0,02–0,1**. To spełnia „płacimy tylko za operacje".
- **Jeśli cold start okaże się UX-owo nieakceptowalny i jedynym ratunkiem jest warm instancja —
  FAZA 10 = NO-GO** (decyzja użytkownika), zostajemy przy lokalnym A2F + wizemach LIVE.

## Cel
Przenieść sprawdzony lokalnie wrapper A2F (09-02, obraz SDK MIT — bez NIM/DeepStream i ich
EULA) do **Google Cloud Run z GPU L4** i podłączyć klienta przez przełącznik `A2F (cloud)`.
Klient nie zmienia kontraktu (docs/7 §5) — zmienia się tylko URL.

## Twarde parametry deployu (zweryfikowane w Google Cloud docs, 2026-09-02)
- **Instance-based billing** (wymóg GPU) + `--no-cpu-throttling`; **L4: min 4 vCPU/16 GiB,
  rekomendowane 8 vCPU/32 GiB**; 1 GPU/instancję; **`--concurrency 1`** (autoskalowanie Cloud Run
  nie reaguje na GPU-util; max-instances ≤ quota; start = 3 GPU/projekt/region).
- Regiony L4: `us-central1`, `us-east4`, `europe-west1`, `europe-west4`, `asia-southeast1`.
- Timeout requestu: default 300 s (max 60 min) — inferencja 10 s wav na L4 to 1–3 s warm;
  engine load pokrywa **startup probe** (httpGet /status, budżet ≥240 s).
- **Cold start = pull obrazu + start kontenera + attach GPU (~5 s) + deserializacja TRT + load
  modelu → realistycznie 0,5–1,5 min** (mierzymy w 10-01; to jest główna wada modelu
  pay-per-processing — front musi być asynchroniczny).
- Obraz: **TRT engines PREBUILD** (z 09-01) + modele (v3.0 + rig) w obrazie, jeśli całość <10 GB
  (zalecenie Google: większe modele → GCS download/FUSE przy starcie). Odpowiedź JSON: gzip
  (długie tury bez capu — patrz decyzja: NIE capujemy długości; gzip + ewentualnie NDJSON).
- Licencje: SDK MIT + NVIDIA Open Model License — **brak blokady chmurowej** (w przeciwieństwie
  do NIM/EULA NVAIE). Modele z HF trzymamy w obrazie/Artifact Registry (self-hosted).
- Autoryzacja: endpoint niepubliczny (IAM) + CORS tylko dla naszej domeny; token dla klienta
  przez istniejący wzorzec proxy (jak signed URL, ROB-03) — zero sekretów w bundle.
- Deploy wykonujemy przez agenta AI z gcloud CLI/MCP — wszystkie komendy w README
  (10-01), krok po kroku, bez konsoli.

## Zasady
- Żadnych sekretów w repo/kliencie.
- `npm test` zielone na każdym etapie; zmiany klienta minimalne (URL w settings).
- Wszystkie kroki chmurowe wykonuje użytkownik/agent z uprawnieniami GCP (autonomous: false).
