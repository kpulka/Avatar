# EN-visemes — Wizemy języka angielskiego (dokument roboczy)

> **Status:** roboczy • **Cel:** doprowadzić do tego, by każdy wizem miał **rozpoznawalną, różną** pozycję ust — teraz część wizemów jest „bliźniaczo" podobna i nie widać, co awatar „mówi".
> **Jak używać:** opis artykulacji → proponowane parametry naszych blendshape'ów → test w **Edytorze Wizemów** (✏️) na modelu → wróć i dopisz „co zadziałało" w kolumnie **test**.
> **Powiązane:** kod `src/lipsync/g2p/phoneme-visemes.ts` (tabela EN), `src/lipsync/g2p/phoneme-merge.ts`, Edytor: `src/lipsync/viseme-overrides.ts`.

---

## 0. Legenda — czym dysponujemy

### 0.1 Nasze parametry (blendshape'y ARKit) i co robią

| Parametr | Znaczenie artykulacyjne |
|---|---|
| `jawOpen` | otwarcie żuchwy (główna „dźwignia głośności/gęby") |
| `mouthClose` | wargi zwarte / styk (dla P/B/M) |
| `mouthPressLeft/Right` | wargi ściśnięte (podkreśla zwarcie P/B/M) |
| `mouthPucker` | wargi wysunięte / zaokrąglone „do dzióbka" (zaokrąglenie samogłosek tyln.) |
| `mouthFunnel` | wargi w „tubę", otwór mały (SH/CH, głębokie zaokrąglenie U) |
| `mouthRollLower` | dolna warga **podwinięta** (kontakt z górnymi zębami — F/V) |
| `mouthShrugLower` | dolna warga uniesiona ku górze (bez zawijania) |
| `mouthUpperUpLeft/Right` | górna warga uniesiona → **odsłania górne zęby** |
| `mouthLowerDownLeft/Right` | dolna warga w dół → **odsłania dolne zęby** |
| `mouthSmileLeft/Right` | kąciki rozciągnięte wszerz („smile speech": IY/EY/S) |
| `tongueOut` | język wysunięty (TH — o ile model ma) |

Wszystkie wartości 0..1. W dalszej części L/R zapisuję jako jedno (np. `upperUp 0.4` = obie strony).

### 0.2 Czego NIE da się pokazać na tym riggu (ważne!)
- **kształtu/części języka** (zaokrąglenie, bruzda S, retrofleks R) — język ma tylko `tongueOut`,
- precyzyjnego kontaktu zębów,
- dlatego różnice **musimy kodować na wargach i żuchwie**, a część fonemów (np. T vs N) będzie **celowo tym samym wizemem** — to naturalne i poprawne (wizemy to klasy równoważne *wizualnie*, nie fonemy).

### 0.3 Nazwy głosek
Korzystamy z **ARPAbet** (2-literowe, tak jak w CMUdict / naszym G2P) — por. źródła na końcu. Grupowanie „wizemów" (jedna poza ust) jest **szersze** niż fonem — wiele fonemów dzieli jedną pozę.

---

## 1. Indeks wizemów EN (jeden wiersz = jedna POZA ust)

| Wizem | ARPAbet | IPA | Przykłady | Klucz wizualny (1 zdanie) |
|---|---|---|---|---|
| V-AA | AA | ɑ | h**o**t, f**a**ther | szeroko otwarte, wargi neutralne |
| V-AE | AE | æ | c**a**t, b**a**d | szeroko, kąciki lekko wszerz |
| V-AH | AH | ʌ | c**u**p, l**u**ck | średnio otwarte, neutralne |
| V-AO | AO | ɔ | th**ou**ght, st**o**ry | otwarte + zaokrąglone (owal) |
| V-ER | ER | ɝ | h**er**, b**ir**d | półotwarte, lekkie zaokrąglenie (r-kolor) |
| V-EY | EY | eɪ | s**ay**, d**ay** | półotwarte + uśmiech, zęby lekko |
| V-EH | EH | ɛ | b**e**d, s**e**t | półotwarte, kąciki lekko wszerz |
| V-IH | IH | ɪ | s**i**t, b**i**t | wąskie, wargi neutralne/spłaszczone |
| V-IY | IY | i | s**ee**, t**ea**m | wąskie + szeroki uśmiech, zęby |
| V-UH | UH | ʊ | g**oo**d, b**oo**k | prawie zamknięte + lekkie zaokrąglenie |
| V-UW | UW | u | t**oo**, bl**ue** | dzióbek (mały otwór, wysunięcie) |
| V-OW | OW | oʊ | g**o**, n**o** | średnio otwarte, wyraźne zaokrąglenie |
| V-AY | AY | aɪ | m**y**, t**i**me | szeroko→uśmiech (ruch) |
| V-AW | AW | aʊ | h**ow**, n**ow** | szeroko→zaokrąglenie (ruch) |
| V-OY | OY | ɔɪ | b**oy**, t**oy** | zaokrąglenie→uśmiech (ruch) |
| C-MBP | P B M | p b m | m**ap**, b**oy**, p**en** | pełne zwarcie warg |
| C-FV | F V | f v | f**ine**, v**an** | dolna warga pod górne zęby |
| C-THDH | TH DH | θ ð | th**ink**, th**is** | język między zębami, usta rozchylone |
| C-TDN | T D N | t d n | t**ime**, d**og**, n**o** | usta neutralne, lekko rozchylone |
| C-SZ | S Z | s z | s**ee**, z**oo** | wąsko + uśmiech, zęby blisko |
| C-SH | SH ZH | ʃ ʒ | sh**ip**, mea**s**ure | wargi do „tuby" (zaokrąglone), zęby blisko |
| C-CH | CH JH | tʃ dʒ | ch**at**, j**ump** | jak SH z twardszym zwarciem |
| C-KG | K G | k ɡ | c**at**, g**o** | otwarte neutralnie (tył języka) |
| C-NG | NG | ŋ | si**ng**, lo**ng** | lekko otwarte, neutralne |
| C-L | L | l | l**ike**, b**ottle** | rozchylone, koniec języka w górze |
| C-R | R | ɹ | r**ed**, t**ree** | lekkie zaokrąglenie/ściągnięcie warg |
| C-Y | Y | j | y**es**, y**ou** | jak IY, krótkie |
| C-W | W | w | w**e**, w**ould** | mocne zaokrąglenie (jak U), krótkie |
| C-HH | HH | h | h**i**, h**ow** | neutralne, usta pod następną samogłoskę |

Dyftongi (EY/AY/AW/OY/OW) w prawdziwej mowie to **ruch** (start→koniec). Nasz silnik trzyma jedną pozę — patrz §5 o modelowaniu ruchu.

---

## 2. Samogłoski — opis artykulacji + parametry

> Skąd opis: fonetyka artykulacyjna (miejsce, otwarcie, **zaokrąglenie warg**) wg standardu IPA/angielskiego; zaokrąglenie dotyczy tylko samogłosek tylnych: AO/OW/UH/UW (i w części AK-centów AO). Przednie (IY IH EY EH AE) są **niezaokrąglone** (rozchylone/szerokie kąciki).
> Kolumna **test** = wypełniamy po sprawdzeniu na modelu.

### IY /i/ — „see, team"
- **Opis:** samogłoska przednia, wysoka, niezaokrąglona. Wargi **rozciągnięte w uśmiech**, żuchwa prawie zamknięta, zęby lekko widoczne („cheesy smile"). Najjaśniejszy „smile" ze wszystkich wizemów.
- **Parametry (baza):** `jawOpen .25 · smile .25` → *propozycja:* dodać `upperUp .15` (odrobina górnych zębów), smile ~.35 (najsilniejszy uśmiech mowy).
- **Test:**

### IH /ɪ/ — „sit, bit"
- **Opis:** jak IY, ale **niżej i luźniej**: kąciki ledwo rozchylone, żuchwa minimalnie bardziej otwarta, **bez** mocnego uśmiechu. Neutralne-spłaszczone wargi.
- **Parametry (baza):** `jawOpen .25 · smile .20` → *propozycja:* obniżyć smile do ~.12 i jawOpen ~.22 (odróżnić od IY **siłą uśmiechu**, nie tylko 0.05).
- **Test:**

### EY /eɪ/ — „say, day" (dyftong, trzymamy pozę startową+glide)
- **Opis:** zaczyna się od [e] — średnio otwarte, kąciki w średnim uśmiechu, **widać górne zęby**; przesuwa ku [ɪ]. Wizualnie: „pół-uśmiech z zębami".
- **Parametry (baza):** `jawOpen .35 · smile .25` → *propozycja:* smile .30 + `upperUp .20` (zęby!), jaw .32.
- **Test:**

### EH /ɛ/ — „bed, set"
- **Opis:** przednia, średnio-otwarta, niezaokrąglona. Żuchwa średnio opuszczona, kąciki w **słabym** uśmiechu/neutralnie. Mniej „zębów" niż EY.
- **Parametry (baza):** `jawOpen .35 · smile .30` → *propozycja:* to prawie bliźniak EY — różnicuj: EH **więcej jaw, mniej smile, brak zębów** (jaw .38, smile .15); EY mniej jaw + smile + zęby.
- **Test:**

### AE /æ/ — „cat, bad"
- **Opis:** przednia, niska, szeroko otwarta. Żuchwa **mocno w dół**, wargi szeroko rozchylone (w GA często lekko napięte). Największy otwór przedni.
- **Parametry (baza):** `jawOpen .45 · smile .20` → *propozycja:* jaw .50, smile .10 (szerokość z żuchwy, nie uśmiechu).
- **Test:**

### AA /ɑ/ — „hot, father"
- **Opis:** tylna, otwarta, **niezaokrąglona** (usta otwarte jak u lekarza „a", wargi neutralne, nie ściągnięte). Największy otwór całkowity.
- **Parametry (baza):** `jawOpen .55 · smile .10` → zostaje (jaw ~.55, wargi neutralne).
- **Test:**

### AH /ʌ/ — „cup, luck"
- **Opis:** centralna, średnio-otwarta, neutralne wargi, żuchwa średnio; „spokojne a".
- **Parametry (baza):** `jawOpen .40` → zostaje; sprawdź odróżnienie od AA (AA = więcej jaw), od EH (AH neutralne kąciki, EH rozchylone).
- **Test:**

### AO /ɔ/ — „thought, story"
- **Opis:** tylna, średnio-otwarta, **zaokrąglona** (wargi w owal, nie wysunięte mocno). Klucz: otwarty owal z widocznym zaokrągleniem.
- **Parametry (baza):** `jawOpen .40 · pucker .50 · funnel .45` → *propozycja:* zmniejszyć jaw do .35 (funnel robi „tubę" — AO to owal, nie tuba: pucker .40/funnel .25? do testu). *Uwaga: AO vs OW vs AW — patrz §5.*
- **Test:**

### OW /oʊ/ — „go, no"
- **Opis:** zaczyna [o] zaokrąglone-średnie i domyka ku [ʊ]. Wizualnie start = **wyraźnie zaokrąglone**, mniejszy otwór niż AO.
- **Parametry (baza):** `jawOpen .35 · pucker .55 · funnel .45` → zostaje jako „zwarte zaokrąglenie".
- **Test:**

### AW /aʊ/ — „how, now"
- **Opis:** start [a] szeroko otwarte, kończy [ʊ] zaokrąglone. Wizualnie **najbardziej kontrastowy ruch**: szeroko → dzióbek.
- **Parametry (baza):** `jawOpen .50 · pucker .45` → *propozycja:* dla statycznej pozy wybrać środek: jaw .35 + pucker .5 (jak OW?) — lepiej różnicować od OW większym jaw startu; do testu.
- **Test:**

### UH /ʊ/ — „good, book"
- **Opis:** tylna, wysoka, **słabo zaokrąglona**: wargi lekko wysunięte, otwór mały, żuchwa prawie zamknięta.
- **Parametry (baza):** `jawOpen .20 · pucker .55 · funnel .35` → *propozycja:* pucker .45/funnel .20 (lżejsze niż UW).
- **Test:**

### UW /uː/ — „too, blue"
- **Opis:** tylna, wysoka, **mocno zaokrąglona**: wargi wysunięte w wyraźny mały otwór (dzióbek). Najmocniejszy pucker/funnel.
- **Parametry (baza):** `jawOpen .20 · pucker .65 · funnel .40` → zostaje jako maksymalny „dzióbek".
- **Test:**

### ER /ɝ/ — „her, bird" (r-colored)
- **Opis:** centralna z retrofleksem; na ustach: żuchwa średnio otwarta, wargi **lekko zaokrąglone** (r-kolor), język niewidoczny.
- **Parametry (baza):** `jawOpen .30 · funnel .20` → *propozycja:* dodać delikatny pucker .25 (odróżnić od EH — patrz §5).
- **Test:**

### AY /aɪ/ — „my, time"
- **Opis:** [a]→[ɪ]: szerokie otwarcie przechodzi w uśmiech. Statycznie reprezentuje „start szeroko, koniec wąsko" — środek: otwarte z kącikami.
- **Parametry (baza):** `jawOpen .45 · smile .20` (identyczne z AE — do rozróżnienia patrz §5).
- **Test:**

### OY /ɔɪ/ — „boy, toy"
- **Opis:** [ɔ]→[ɪ]: zaokrąglenie → uśmiech.
- **Parametry (baza):** `jawOpen .40 · pucker .40` → *propozycja:* dodać smile .15 (kierunek docelowy ku [ɪ]).
- **Test:**

---

## 3. Spółgłoski — opis + parametry

### P / B / M (C-MBP) — „map, boy, pen"
- **Opis:** **zwarcie warg** (bilabialne). P/B = wargi zwarte z lekkim ciśnieniem (P bezdźwięczne + przydech, B dźwięczne). M = wargi zwarte, dźwięk przez nos — **wizualnie to samo**: usta zamknięte w naturalnej linii, zęby rozwarte, bez „ssania". To najważniejszy test czytelności lip-syncu.
- **Parametry (baza):** `mouthClose 1.0 · press .15` — *propozycja na MetaPerson:* `mouthClose ~0.5-0.6` (wyżej ciągnie wargę na nos), `press .15`, NIE dodawać jawOpen.
- **Test:** *(sprawdź: pełny kontakt warg, dół wargi NIE podjeżdża pod nos)*

### F / V (C-FV) — „fine, van"
- **Opis:** **wargowo-zębowe**: dolna warga lekko podwinięta dotyka krawędzi górnych siekaczy; szczęki blisko; kąciki neutralne. V dźwięczne (drganie).
- **Parametry (baza):** `jawOpen .12 · rollLower .65 · upperUp .50 · shrugLower .18`
- **Test:**

### TH / DH (C-THDH) — „think, this"
- **Opis:** **międzyzębowe**: czubek języka między (za) górnymi zębami; usta rozchylone na tyle, by język był widoczny; wargi nie biorą udziału.
- **Parametry (baza):** `jawOpen .20 · tongueOut .30` (jeśli model ma tongueOut; inaczej sam jaw)
- **Test:**

### T / D / N (C-TDN) — „time, dog, no"
- **Opis:** **zębodołowe**: czubek języka do wałka dziąsłowego; na zewnątrz usta **neutralne, lekko rozchylone**; T/D = zwarcie+uwolnienie, N nosowe — wizualnie ta sama poza (to OK).
- **Parametry (baza):** `jawOpen .20`
- **Test:**

### S / Z (C-SZ) — „see, zoo"
- **Opis:** **zębodołowe szczelinowe**: język w bruzdę za zębami, **zęby prawie stykają się**, wargi rozchylone w **wąski uśmiech** (widoczne zęby), powietrze świszczące.
- **Parametry (baza):** `jawOpen .15 · smile .15` → *propozycja:* dodać `upperUp .15`/`lowerDown .15` (zęby!) — inaczej S zlewa się z T/D/N/EH.
- **Test:**

### SH / ZH (C-SH) — „ship, measure"
- **Opis:** **zadziąsłowe szczelinowe, labializowane**: język płaski za wałkiem, a wargi **wysunięte i zaokrąglone w tubę** [ʃʷ], zęby blisko (widoczne przez otwór). To odróżnia SH od S.
- **Parametry (baza):** `jawOpen .20 · funnel .50` → *propozycja:* dodać `pucker .25` + `upperUp/lowerDown ~.2` (zęby w tubie) dla mocniejszej „sz" na MetaPerson.
- **Test:**

### CH / JH (C-CH) — „chat, jump"
- **Opis:** **afrykaty**: najpierw zwarcie jak T (język do wałka), potem szczelina jak SH (wargi w tubę). Wizualnie = SH z wyraźniejszym zwarciem początkowym.
- **Parametry (baza):** `jawOpen .25 · funnel .45` → patrz SH (zbliżone — różnicuj: CH odrobinę więcej jaw i mniej funnel na starcie).
- **Test:**

### K / G (C-KG) — „cat, go"
- **Opis:** **miękkopodniebienne**: tył języka do podniebienia miękkiego; usta neutralne, **dość szeroko otwarte** (bo nie ma pracy warg); z zewnątrz „puste otwarcie".
- **Parametry (baza):** `jawOpen .35` → *propozycja:* bez smile, jaw .35 (odróżnić od AH: AH .40 bez kontekstu; K/G krótkie i „twarde").
- **Test:**

### NG /ŋ/ (C-NG) — „sing, long"
- **Opis:** jak K/G ale nosowe, usta **lekko** otwarte, neutralne.
- **Parametry (baza):** `jawOpen .25`
- **Test:**

### L (C-L) — „like"
- **Opis:** **boczne**: czubek języka do wałka, powietrze bokami; usta rozchylone, kąciki neutralne (ciemne L w końcu sylaby jeszcze bardziej „głębokie").
- **Parametry (baza):** `jawOpen .30 · tongueOut .30` (tongueOut tylko symbolicznie — L nie wysuwa języka! *do usunięcia lub ignoruj*)
- **Test:** *(rozważ: tongueOut dla L jest błędne — L = język W GÓRZE; zostaw sam jaw lub dodaj delikatne obniżenie)*

### R /ɹ/ (C-R) — „red, tree"
- **Opis:** **zadziąsłowy aproksymant, labializowany**: język ściągnięty/bunchowany, wargi **lekko zaokrąglone i wysunięte** (zwłaszcza przed samogłoską) — to widać na ustach najbardziej.
- **Parametry (baza):** `jawOpen .30 · funnel .20` → *propozycja:* dodać pucker .20-25 (r-kolor); odróżnić od ER (ER = samogłoska dłuższa, R = krótki start konsonantu).
- **Test:**

### Y /j/ (C-Y) — „yes, you"
- **Opis:** **podniebienny aproksymant**: jak bardzo krótkie [i] — wargi rozchylone, żuchwa prawie zamknięta; zaraz przechodzi w następną samogłoskę.
- **Parametry (baza):** `jawOpen .25 · smile .20` → *propozycja:* smile .25 (jak IY), krótkie.
- **Test:**

### W /w/ (C-W) — „we, would"
- **Opis:** **wargowo-miękkopodniebienny**: **mocne zaokrąglenie i wysunięcie warg** (jak [u]), potem przejście w samogłoskę. Najbardziej „wargowy" konsonant.
- **Parametry (baza):** `pucker .40 · jawOpen .15` → *propozycja:* pucker .55 + funnel .2 (jaśniejszy „dzióbek", krótszy od UW tylko czasem trwania).
- **Test:**

### HH /h/ (C-HH) — „hi, how"
- **Opis:** **krtaniowe**: brak pracy warg — usta ustawiają się pod **następną samogłoskę**; samo h to tylko przepływ powietrza.
- **Parametry (baza):** `jawOpen .25` → *propozycja:* w zasadzie brak własnej pozy (neutralna), trzymać niską amplitudę.
- **Test:**

---

## 4. Zbiorcza tabela parametrów (arkusz roboczy)

Legenda: **B** = wartość bieżąca (kod v1); **P** = propozycja do testu; puste = nie używane (0).
L/R wpisane raz (symetria). `jaw`=`jawOpen`, `close`=`mouthClose`, `press`=`mouthPress`, `puck`=`mouthPucker`,
`fun`=`mouthFunnel`, `roll`=`mouthRollLower`, `shrug`=`mouthShrugLower`, `uUp`=`mouthUpperUp`,
`lDn`=`mouthLowerDown`, `sm`=`mouthSmile`, `tong`=`tongueOut`.

| Wizem | jaw | close | press | puck | fun | roll | shrug | uUp | lDn | sm | tong |
|---|---|---|---|---|---|---|---|---|---|---|---|
| IY | B .25 / P .25 | | | | | | | P .15 | | B .25 / P .35 | |
| IH | B .25 / P .22 | | | | | | | | | B .20 / P .12 | |
| EY | B .35 / P .32 | | | | | | | P .20 | | B .25 / P .30 | |
| EH | B .35 / P .38 | | | | | | | | | B .30 / P .15 | |
| AE | B .45 / P .50 | | | | | | | | | B .20 / P .10 | |
| AA | B .55 | | | | | | | | | .10 | |
| AH | .40 | | | | | | | | | | |
| AO | .40 / P .35 | | | | B .50/P.40 | | | | | | |
| OW | .35 | | | .55 | .45 | | | | | | |
| AW | .50 / P .40 | | | .45 / P .50 | | | | | | | |
| UH | .20 | | | .55/P.45 | .35/P.20 | | | | | | |
| UW | .20 | | | .65 | .40 | | | | | | |
| ER | .30 | | | P .25 | .20 | | | | | | |
| AY | .45 | | | | | | | | | .20 | |
| OY | .40 | | | .40 | | | | | | P .15 | |
| MBP | P .0 | B 1.0/P.55 | .15 | | | | | | | | |
| FV | .12 | | | | | .65 | .18 | .50 | | | |
| THDH | .20 | | | | | | | | | | .30 |
| TDN | .20 | | | | | | | | | | |
| SZ | .15 | | | | | | | P .15 | P .15 | .15 | |
| SH | .20 | | | P .25 | .50 | | | P .2 | P .2 | | |
| CH | .25 | | | | .45 | | | | | | |
| KG | .35 | | | | | | | | | | |
| NG | .25 | | | | | | | | | | |
| L | .30 | | | | | | | | | | (.30 → P 0) |
| R | .30 | | | P .20 | .20 | | | | | | |
| Y | .25 | | | | | | | | | .20/P.25 | |
| W | .15 | | | .40/P.55 | P .2 | | | | | | |
| HH | .25 | | | | | | | | | | |

---

## 5. Analiza „bliźniaków" i niuanse różnicujące

Najważniejsza część dla nas. Dla każdej pary: **dlaczego dziś wyglądają tak samo**, **jaka jest realna różnica artykulacyjna**, **jak ją pokazać na naszych blendshape'ach**.

### 5.1 Pary IDENTYCZNE w kodzie (baza) — wymagają rozróżnienia

| Para | Dziś (oba) | Realna różnica | Jak rozróżnić na riggu |
|---|---|---|---|
| **EY ↔ AE** (i AY!) | jaw .35/.45… AE vs EY: AE jaw .45 sm .2; EY jaw .35 sm .25 — blisko; **AY = identyczne z AE** | /æ/ niskie, bez uśmiechu; /eɪ/ „pół-smile + zęby"; /aɪ/ start szeroko→uśmiech | AE: jaw duży, smile ~0 (szerokość z żuchwy). EY: jaw mniejszy, smile .3 + **upperUp (zęby)**. AY: środek — jaw .4 + smile .25 |
| **IH ↔ Y** (i blisko IY) | jaw .25 sm .2 = Y | /ɪ/ samogłoska luźna; /j/ krótki „i" przejściowe | Y krótkie + smile .25; IH dłuższe, smile mniejsze (~.12), luźne |
| **ER ↔ R** | jaw .3 fun .2 | /ɝ/ samogłoska r-kolorowana (długa); /ɹ/ konsonant startowy | R dodać pucker .2 (start sylaby); ER bez pucker, dłuższe |
| **HH ↔ NG** (i TDN .2) | jaw .25 | /h/ brak pozy (neutral); /ŋ/ tylne nosowe | HH = neutralne, bardzo niska amplituda; NG = jaw z lekkim „pustym otwarciem" jak K/G ale mniejsze (.25 ok, HH .18) |
| **SH ↔ CH** | fun .50 vs .45 (prawie) | /ʃ/ szczelina; /tʃ/ zwarcie→szczelina | CH: więcej jaw .28 + mniej fun .35 (zwarty start); SH: mniej jaw, więcej fun |
| **UH ↔ UW** | różne ale blisko | /ʊ/ słabe zaokrąglenie; /uː/ mocne wysunięcie | UH: puck .45 fun .2; UW: puck .65 fun .4 (maks) |

### 5.2 „Drabinki", które łatwo pomylić (wartości co 0.05)
Front unrounded `IY .25/.25 → IH .25/.20 → EY .35/.25 → EH .35/.30 → AE .45/.20` — różnice rzędu 0.05 są **niewidoczne**. Propozycja: rozepchnij je **dwuwymiarowo** (jaw ORAZ smile/teeth), a nie tylko samą wartością:

- **IY**: najmocniejszy uśmiech + zęby (`sm .35, uUp .15, jaw .25`)
- **IH**: luźne, prawie bez uśmiechu (`sm .10, jaw .25`)
- **EY**: średni uśmiech + zęby (`sm .30, uUp .20, jaw .32`)
- **EH**: jaw większy, bez zębów (`jaw .38, sm .15`)
- **AE**: jaw max, smile ~0 (`jaw .50`)
- **AA**: jaw max neutralny (od AE różni kierunek języka — niewidoczny; zostaw podobny, różnicuj czasem/kontekstem)
- **AH**: jaw średni, neutralne (od EH różni: EH lekko rozchyla kąciki — dodaj AH `sm 0`, EH `sm .15`)

### 5.3 Tył zaokrąglony: AO vs OW vs AW vs UH vs UW
Wszystkie „zaokrąglone" — łatwo zlać. Klucz = **stopień wysunięcia i otwarcie**:
- **AO** /ɔ/: owal otwarty — `jaw .35, puck .40, fun .25` (otwarty, nie tuba)
- **OW** /oʊ/: zwarte zaokrąglenie — `jaw .30, puck .55, fun .45`
- **UW** /uː/: maks dzióbek — `jaw .20, puck .65, fun .40`
- **UH** /ʊ/: lekki dzióbek — `jaw .25, puck .40, fun .20` (jaśniejsze od UW)
- **AW** /aʊ/: start SZEROKO (`jaw .45`) → koniec zaokrąglony — statycznie: `jaw .35, puck .5` (bliżej OW; różnicę daje kontekst: AW po szerokim A)

### 5.4 Spółgłoskowe pułapki
- **S vs SH**: S = uśmiech+zęby, SH = tuba. Jeśli SH nie ma puckera — będzie jak S. **Dodaj SH pucker .25**.
- **F/V vs TH/DH**: F = dolna warga POD zęby (`rollLower`+`upperUp`); TH = język MIĘDZY zębami (tongueOut). Bez tongueOut TH wygląda jak nic — daj TH większy jaw + ewentualnie `mouthShrugLower`/rozchylenie.
- **P/B/M vs F/V**: P = wargi zwarte (close); F = warga pod zęby (roll) — już rozróżnialne, pilnuj tylko, by M nie dostał przypadkiem jawOpen.
- **K/G vs NG vs T/D/N**: z zewnątrz wszystkie „neutralne otwarcie" — różnicuj AMPlitudą jaw (K/G .35, T/D/N .20, NG .25, HH .18) — patrz 5.1.

### 5.5 Dyftongi a „ruch"
EY/AY/AW/OY/OW realnie **przesuwają** usta. Trzymanie jednej pozy = „zamrożony środek". Opcje (do decyzji):
1. zostaw statycznie (najprościej; kontekst i tak pomaga),
2. **rozbij dyftong na 2 wizemy w kolejce** (start→koniec, pół na pół czasu) — to wymaga zmiany w `phoneme-merge`/mapie (np. AY → najpierw AA-ish potem IH-ish);
3. kompromis: środek + lekkie nachylenie (smile dla AY/OY, pucker dla AW/OW).
> Rekomendacja na start: **opcja 2 dla AY i AW** (najbardziej kontrastowe), reszta statycznie. Dopisz decyzję po teście.

---

## 6. Kontrolne zdania do oceny (minimal pairs)
- **Wargi:** „Map, mop, pop — fine, five, very — wine, white" *(P/B/M, F/V, W)*
- **S vs SH:** „see, she — sip, ship — so, show"
- **Front vowels:** „bed, bad, bayed, bid, bead" *(EH AE EY IH IY)*
- **Back rounded:** „caught, coat, coot, could, cow" *(AO OW UW UH AW)*
- **R:** „her, red, are, ear"
- **TH:** „think, this, three, they"
- **Dyftongi:** „my, boy, how, go, day"

---

## 7. Źródła (research 2026-09)
- Wikipedia: **ARPABET** — pełna tabela ARPAbet ↔ IPA ↔ przykłady (używana przez CMUdict). https://en.wikipedia.org/wiki/ARPABET
- Wikipedia: **English phonology** — 24 spółgłoski (miejsce/sposób), wokalizm GA/RP, labializacja /ʃ ʒ tʃ dʒ/, realizacje /r/ i /l/, r-coloring. https://en.wikipedia.org/wiki/English_phonology
- Fonetyka artykulacyjna (standard): cechy samogłosek (otwarcie/przód–tył/**zaokrąglenie warg**) i spółgłosek (miejsce+sposób) — podstawa opisów w §2–§3.
- Nasz słownik: CMUdict (`cmu-pronouncing-dictionary`) — to on daje ARPAbet do G2P.

---

## 8. Log zmian / decyzje
| Data | Decyzja |
|---|---|
| 2026-09 | Utworzono dokument; zidentyfikowano bliźniaki EY/AE/AY, IH/Y, ER/R, HH/NG, SH/CH, UH/UW; propozycje rozróżnień w §5. |
| 2026-09 | **v1.2 wdrożone** do `src/lipsync/g2p/phoneme-visemes.ts` jako uśrednienie 50/50 (bieżące ↔ propozycje §5). Nowe wartości = średnie: MBP close .78, front-vowel rozsunięte (jaw+smile+`upperUp`), SH/SZ z odsłonięciem zębów, tylne zaokrąglone rozdzielone (AO owal → UW dzióbek), HH niska amplituda .22, L bez `tongueOut`. Kolumna **B** w §4 nieaktualna jako „kod" — patrz kod/tabela powyżej. |
| 2026-09 | **v1.3** — więcej „mocy" (większe jaw/smile/zaokrąglenie) + „smaczek": otwarte samogłoski dostały `lowerDown` (dolne zęby), IY/EY mocniejszy `upperUp`, UW/W dostały `shrugLower` (protrusja), SZ/SH mocne odsłonięcie zębów, K/G/NG/T/D/N/L delikatna obecność zębów (żeby „neutralne" wizemy nie były puste). |
