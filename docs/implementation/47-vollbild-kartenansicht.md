# 47 — The card view in full screen, with its keywords explained

## Scope and authority

The project owner's wish of 2026-10-12 ("Der Vollbildscreen von der Karte ist
sehr unschön gemacht … die Karte ganz groß dargestellt …, und daneben sollten
dann in Textfeldern nur die Keywords, die auf der Karte drauf vorkommen, nur
nochmal erklärt werden" - "damit es sich wie ein richtiges Spiel anfühlt, das
man auf dem Tisch spielt"); central task
`dev0gig/dropzone/workflow/tasks/…/openmana-47-vollbild-kartenansicht.md`,
the shared rules of the table series (`reports/2026-10-10-openmana-spieltisch-regeln.md`
in Dropzone) with the push the task allows.

Looking at a card stays safe and sends nothing; what opens it (a long press,
a right click or the context-menu key, the primary activation in every step
that does not tap at once) and every guard of its button (`ARMING_MS`,
`tapBlocked`, the double tap, a repeated key) are unchanged. Forge alone says
which keywords a card has.

## What was built

- **Protocol 9** (`engine/protocol/schema/protocol.schema.json`,
  `engine/protocol/README.md`): `VisibleCard.keywords` - every keyword
  ability Forge reports for a visible card now, printed or given by an
  effect, each concrete form once (`CardKeyword`: `keyword` = Forge's
  `Keyword` enum constant, `title` = Forge's concrete form in English,
  `reminder` = Forge's English reminder text; `amount`, `cost`, `detail` = the
  parts of the form as Forge's own parser reads them).
- **Bridge** (`StateBuilder.keywords`): Forge's own view of the card state's
  keyword cache (`CardStateView.getKeywords()`), without `UNDEFINED` (Forge's
  free-form "keywords"), ordered by Forge's enum and title (Forge keeps them
  in a hash map: the order is made stable for identical messages on the JVM
  and in WebAssembly), `CARDNAME` replaced by the card's name; the parts by
  `Keyword.getInstance(original)` - the call that made the keyword - cached by
  original text, without a card and without touching the game.
- **German texts** (`src/game/keyword-texts.ts`): one entry per constant of
  Forge's enum (202), each with Forge's English text it translates, its
  source (`druck`: the German name and reminder wording of German printings,
  taken from the card catalog's printed German texts - 173 keywords;
  `openmana`: OpenMana's own translation where no German printing with a
  reminder text exists - 29), the German name, a general explanation and the
  concrete forms OpenMana can say in German (a number, a mana cost, a colour,
  a land type, an enchant target …). A German form is used only where its
  English title is exactly Forge's (and where the title alone does not tell
  Forge's forms apart, Forge's reminder fits too: two kicker costs, an
  equipment for another kind of permanent, ward of mana alone, commander
  ninjutsu). Otherwise the box keeps the German name and general explanation
  with Forge's concrete form beside it, in English, marked "englisch"; a
  keyword without an entry (a Forge update) shows Forge's words, marked -
  never an empty box. Generated once from a translation table; edited in
  place since.
- **The rule that keeps the texts true** (`scripts/keyword-texts.test.ts`,
  outside `src/`, which never reads Forge's sources): every constant of
  Forge's `Keyword` enum at the pinned commit has exactly one entry, and its
  `forge` text is Forge's text there - a Forge update that adds a keyword or
  changes a text fails until the German text was looked at again.
- **Real forms** (`scripts/record-keyword-forms.ts`, the JVM-only
  `KeywordSurvey` in the bridge): every keyword of every card in Forge's card
  database through `StateBuilder.keywords` - 33 505 cards, 16 965 keywords, 638 distinct concrete forms,
  zero rejected forms - recorded as one
  sample per form (`src/test/fixtures/keyword-forms.json`, 638 forms). Of the
  16 965 keywords, 16 503 (97.3 %) get a German concrete form, the other 462
  German name and explanation with Forge's form; none is English only.
- **The view** (`src/game/card-view.tsx`, replacing `card-sheet.tsx`): a shadcn
  `Dialog` in full screen, built the shadcn way as `CardLightbox`
  (`src/components/ui/card-lightbox.tsx`): the shadcn `DialogOverlay` darkens
  the whole table; the card stands on it as large as the screen allows,
  whole and in its proportions (`cardFit`: stacked within the width and the
  height less its button rows, beside within the height and the width less
  the aside - 36 % of the screen, 16–24 rem); the boxes (keyed by enum, title and reminder so different forms with the
  same title keep distinct identities) beside it in
  `quadrat` and `breit` and below it in `hoch` (by the table's layout, never
  by device: `useTableLayout()`); stacked, the view scrolls and the card's
  buttons stay right under it, on screen with it. The keyword boxes are
  shadcn `Card`s (name bold, the explanation below, `lang` per box), a list
  "Schlüsselwörter dieser Karte"; without keywords there are none and no line
  says so.
- **What else stays in the view**: Forge's offer as one button under the card
  (stacked) or under the boxes (beside), never over the card, with its guards
  and blocked reason; "Umdrehen" for a double-faced card (the other side's
  picture, or its text in card form; Forge's state and action stay the
  card's); browsing where it applied before; closing by the X, a press on the
  darkening (not the double tap's second press: `ARMING_MS`), Escape and the
  system's back gesture (Chrome's `CloseWatcher`, `useCloseWatcher`). The
  former fact list (place, counters, damage, stack and its targets,
  attachments, picture language, catalog text, Forge's rules text and offer
  in words) is no longer on screen - the chips on the table and the
  Zauberchronik show those facts - and stays complete in the dialog's
  description for screen readers. The focus goes to the view when it opens
  and back to the card when it closes, as before.
- **Picture**: the full card view takes Scryfall's largest version, the
  lossless PNG (745 × 1040, new `ImageSize` `png` in `src/cards/images.ts`)
  in its `srcset` beside `grid` and `display`, with `sizes="auto"`: the
  browser picks what the card's laid-out width needs (on a phone at its
  pixel ratio the PNG). Never cropped, darkened or filtered; its transparent
  corners show the darkening, not a grey box. Without a picture the current Forge name, mana cost, type and rules text
  stand in card form, scrolling inside the card; only a deliberately turned
  alternate face uses its catalog text. The fallback updates with Forge's
  next state, including after a picture fails to load.
- **Replay** (prompt 22): the same view without a button.

## Verification

The final engine update pipeline (`engine/build/publish-47b/pipeline.json`,
2026-10-12) passed every phase and promoted the lock: protocol 9,
Forge `ed0333fecb1fea0671b3e50cadc1da4f71db5798`, manifest
`fba5601117ff684c6ac460495ee47bd9c3f1c0fe8f71c58a55a704337895fa3c`.
The final complete regression (`/var/tmp/om47-codex/regression-2/report.json`,
finished 2026-10-12 12:14 UTC) passed all ten phases; every log's SHA-256 was
checked against its report. It includes 90 JVM tests, 82 JVM/Node/Chrome
engine runs across 15 fixtures (all required paths, wins and losses),
`npm run check`: generated files, typecheck, lint, 1 258 app tests in 92
files, the complete real-Chrome E2E suite and the real PWA suite (including
an offline Forge game, interrupted downloads, waiting updates and the
server stopped). The engine lock was verified again after the checks.

The E2E checks cover the original eight viewports plus 480×1040, 870×960
and 960×870: whole card, dimensions at least those of the previous Sheet,
boxes beside/below it, long press and right click, Forge's guarded button,
X/overlay/Escape/native Chrome CloseWatcher, focus restoration, picture
fallback, alternate faces, browsing and read-only replay. The browser
report has 825 axe checks, without a finding. Native CloseWatcher was
exercised in Chrome; this is not physical Android gesture evidence.

Self-review corrected a missing-image fallback to use Forge's current
rules text (including after an image failure), sharpened the German
Cascade/Suspend explanations, distinguished different Forge keyword forms
with the same title in their React identities, and selected the locked
protocol-9 engine in the deployment manifest. Table scenes, consecutive
states and the replay fixture were re-recorded with protocol 9.

Visual acceptance: 22 settled, fully loaded card-view screenshots (one
plain card and one built presentation with several real Forge keyword
objects in each of the eleven sizes), plus eleven recorded-table shots,
are in Seafile `/repo/openmana/design/spieltisch-umsetzung/47/`.
The directory listing confirmed all 33 files and their byte lengths.
The card stays whole and clear, the table darkens, buttons do not cover
the picture and only Forge's keywords are explained. A narrow view scrolls
to the later boxes. Compared with the mockup, this view deliberately uses
the requested full-screen shadcn Dialog; the table's documented differences
remain in `docs/design/SPIELTISCH.md` §14. An early desktop screenshot was
replaced after waiting for image decoding and the settled opening frame.

Local readiness (`/var/tmp/om47-codex/readiness/report.json`, 2026-10-12):
all seven selected games passed, 276 accepted player inputs and 35 real
card drags, zero refused inputs, unchanged actions, page errors or broken
pictures, at most one engine worker. Each game reached Forge's result and
its recording replayed to the end; the Commander export also replayed in
a fresh browser profile.

| Game | Screen | Result | Turns | Inputs | Drags |
| --- | --- | --- | --- | --- | --- |
| Rakdos targets | 1440×900 | lost | 11 | 34 | 4 |
| Blue-black control | 1440×900 | lost | 11 | 22 | 5 |
| Commander Krenko | 1440×900 | lost | 14 | 34 | 6 |
| Green/Red touch | 412×915 | lost | 10 | 13 | 3 |
| Attackers/planeswalkers | 1440×900 | lost | 18 | 64 | 3 |
| Grixis | 1440×900 | lost | 11 | 30 | 4 |
| Planeswalkers/Rakdos touch | 829×690 | won | 26 | 79 | 10 |

Additional phone runs at 412×915 with 4× CPU throttling passed all functional
checks. The first (`/var/tmp/om47-codex/readiness-phone4/report.json`) reached
15 turns: 208 long tasks, one at 207 ms, motion work at most 33.3 ms.
Its slow-frame evidence also shows the card opening (`oncontextmenu`, 177 ms).
The focused confirmation run (`/var/tmp/om47-codex/readiness-phone4-confirm/report.json`)
reached 14 turns: 241 long tasks, none over 200 ms, maximum 175 ms;
motion work at most 31.3 ms in 153 states, 59 motions at 44.7 fps on average.
Both original reports remain available; screenshot work is separated by
the established runner, and no timing from the first run was discarded.
The clean-checkout publication rehearsal found that the root's reviewed
license inventory still named protocol 8. The fully verified new build's
inventory was reviewed and promoted to `notices/engine-inventory.json`, its
policy SHA-256 updated, and `THIRD-PARTY-NOTICES.md` refreshed from the tested
bundle. It has the same 24 component coordinates, original dependency JARs
and toolchain; 8 259 types (one added own bridge type, `StateBuilder$Parts`,
plus renamed generated proxies), no forbidden types. Thus a publication
build needs no local JVM or compiler evidence to reconstruct its notices.
The old source archive remains available in the release; a separate full
archive covers the final publication commit.

The central completion report records the actual public release
`engine-p9-fba5601117ff`, pushed commit range, Vercel deployment and
production game after those steps have completed.

## Assumptions (changeable)

- Name of Flying: "Fliegend" (German printings since 2024) with a note that
  older German cards say "Flugfähigkeit"; Trample "Verursacht Trampelschaden"
  (the printed wording).
- 29 keyword names without a German printing in the catalog are OpenMana's
  own (e.g. Absorbieren, Beistand, Gruppenbildung, Reiterei, Schwinden,
  Phasing, Tobsucht for Frenzy, Mehr als man sieht, Motoren an!), marked
  `source: "openmana"`.
- The order of the boxes is Forge's enum order (alphabetical by Forge's
  English constant), not the order on the printed card (Forge does not keep
  it).
- The aside beside the card is 36 % of the screen wide, at least 16 rem, at
  most 24 rem; stacked, two button rows of 56 px stay under the card.
- The card view's picture: Scryfall's PNG as the largest version.
- `CardKeyword` carries Forge's English words; German comes only from the
  app's table, never from Forge.

## Limits

- The system's back gesture works where the browser has `CloseWatcher`
  (Chrome, Android). Unit tests cover the hook; the complete browser suite
  also requests closure through Chrome's real native watcher at every card-view
  size and checks that focus returns without an action. This exercises the
  API, not a physical Android gesture. Physical check on the Fold inside
  ORYX: Patrick.
- The recorded games show at most one keyword per card (Reach, Haste,
  Deathtouch, Kicker {4}, Trample, Defender, Flashback {2}{R}); several
  keywords and a form OpenMana says only in general are a built presentation
  (`presentation=keywords`) with Forge's real keyword objects.
