# Regole di design mobile

Valgono per tutte le schermate. I valori sono token in `src/app/globals.css`: usa quelli, non numeri nuovi.

## Spazi e dimensioni (griglia a 4 px)
| Token | Valore | Dove |
|---|---|---|
| `--edge` (`px-edge`, `inset-x-edge`) | 12 px | distanza dai bordi dello schermo per dock, top bar, tendine |
| `--pad` (`px-pad`) | 16 px | padding interno di tendine e card |
| `--gap` (`gap-(--gap)`) | 8 px | tra elementi fratelli (chip, pulsanti) |
| `--gap-lg` | 24 px | tra sezioni |
| `--dock-h` (`h-dock`, `w-dock`) | 64 px | pulsanti tondi e barra del dock |
| `--control-h` (`h-control`) | 48 px | pulsanti, campi, top bar |
| `--chip-h` (`h-chip`) | 40 px | chip dei filtri |
| `--dock-space` (`pb-dock`) | safe-area + 92 px | spazio da lasciare in fondo alle pagine che scorrono |

Raggi: tutto ciò che si tocca è a pillola (`rounded-full`), card `rounded-card` (20), tendine `rounded-sheet` (32).
Target minimo 44 × 44 px. Testo minimo 13 px, corpo 15–16 px, titoli in `--font-display`.

## Vetro
- `liquid-glass`: dock, top bar, chip sopra la mappa. Sfocatura + saturazione, riflesso in alto a sinistra, bordo luminoso.
- `liquid-glass-thick`: tendine (più opaco, il testo resta AA).
- `glass-well`: campi e pulsanti secondari dentro il vetro.
- Con `prefers-reduced-transparency` o `prefers-contrast: more` il vetro diventa pieno.

## Tendine (`BottomSheet`)
- Galleggiano staccate dai bordi (`--edge`) e coprono il dock, che si abbassa e sparisce (`.under-sheet`).
- X in alto a destra, Esc, tocco fuori o trascinamento verso il basso per chiudere.
- Altezze: `tall` 80% (ricerca), `medium` 66% (assistente), `auto` (scheda luogo).
- Ingresso a molla dal basso; con `prefers-reduced-motion` solo dissolvenza.

## Mappa
- Pin a goccia nel colore della tipologia con l'icona del tipo di luogo; selezionato = più grande con bordo oro.
- Gruppi scuri con alone oro e numero; un tocco zooma.
- La riga di chip delle tipologie sotto la top bar è anche la legenda.

## Foto
Solo con fonte e licenza (`src/features/photos`). Senza foto verificata: segnaposto con "Nessuna foto disponibile".
