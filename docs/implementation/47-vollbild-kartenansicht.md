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
  database through `StateBuilder.keywords` - {{SURVEY}} - recorded as one
  sample per form (`src/test/fixtures/keyword-forms.json`, 638 forms). Of the
  16 965 keywords, 16 503 (97.3 %) get a German concrete form, the other 462
  German name and explanation with Forge's form; none is English only.
- **The view** (`src/game/card-view.tsx`, replacing `card-sheet.tsx`): a shadcn
  `Dialog` in full screen, built the shadcn way as `CardLightbox`
  (`src/components/ui/card-lightbox.tsx`): the shadcn `DialogOverlay` darkens
  the whole table; the card stands on it as large as the screen allows,
  whole and in its proportions (`cardFit`: stacked within the width and the
  height less its button rows, beside within the height and the width less
  the aside - 36 % of the screen, 16–24 rem); the boxes beside it in
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
  corners show the darkening, not a grey box. Without a picture Forge's text
  stands in card form, scrolling inside the card.
- **Replay** (prompt 22): the same view without a button.

## Verification

{{VERIFICATION}}

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
  (Chrome, Android); it is checked in a unit test with a stand-in watcher -
  Chrome on a desktop has no back gesture to press. Physical check on the
  Fold inside ORYX: Patrick.
- The recorded games show at most one keyword per card (Reach, Haste,
  Deathtouch, Kicker {4}, Trample, Defender, Flashback {2}{R}); several
  keywords and a form OpenMana says only in general are a built presentation
  (`presentation=keywords`) with Forge's real keyword objects.
