---
name: tropical
description: >-
  The island/tropical visual theme for זבאנג רויאל - a warm, sunlit,
  cartoon-casual look built from carved wood frames, cream parchment panels,
  chunky candy buttons with a hard 3D bevel, and an illustrated jungle-lagoon
  world behind the UI. Includes reference screenshots of the real thing. The
  words "TROPICAL", "טרופי", "אי", "ג'ונגל", "בסגנון האי", "בסגנון הטרופי" or
  "בסגנון החדש" anywhere in a request ARE the trigger - they mean "build this
  looking like the island theme". The design questions are already answered
  here, so apply it instead of asking how it should look. Use it whenever
  building, restyling or reviewing ANY interface in this theme - a screen,
  modal, button, card, list row, leaderboard, badge, avatar ring, toast, board
  skin, arena or mockup. Consult it before writing any CSS or HTML so new UI
  reuses these tokens instead of inventing colors, radii and bevels that drift.
---

# TROPICAL — the island theme for זבאנג רויאל

**"TROPICAL" is a design instruction.** When it appears in a request, the user is
telling you which style to build in, not asking a question about style. Take the
direction from this file, look at the screenshots, and get on with the work; don't
ask them to describe the look again, and don't offer a menu of alternatives.

## Look at these first

Five screenshots of the real, shipped theme live in `images/` next to this file.
**Open them before writing any CSS** — the bevel, the wood ringing, and the weight
of the type are far easier to match from the picture than from the prose below.

| Image | What to take from it |
|---|---|
| `images/home.png` | The whole identity in one screen: carved gold title over a sky-and-jungle world, the cream player card in its wood frame, the stack of candy buttons (green play / gold shop / blue profile / purple royale), round gold icon buttons in the corners. |
| `images/board.png` | The play surface: a green `--felt` board inside a thick wood frame, cream candy letter tiles each with their own bevel, the red timer and green score as floating cream chips, gold power-up circles with price tags. |
| `images/shop.png` | The signboard header — a wood plank straddling the top edge of the panel, not text inside it. Cream list rows with wood ringing, gold price chips, and the single mint-tinted row that marks the special/"you" row. |
| `images/profile.png` | Long-scroll layout: nested cream panels on cream, the avatar with its gold ring and blue level badge, stat rows, section headings. |
| `images/modes.png` | Tappable mode rows and how an accent color reads as identity per action rather than as decoration. |

## Where the real implementation lives

This theme ships in the **`Ld2000king/zabang-royale-`** repo (same game, island skin).
Its `style.css` holds every token below and its `game.css` holds every component —
**they are the source of truth; this file is the map.** If a token here disagrees
with that CSS, the CSS wins and this file should be corrected.

**This repo (`zbang-pwa`) is still on the old dark skin** (`--bg-deep: #121317`,
`--panel-light: #1C1E24`). So "make it tropical" here is never a one-component job:
port the token block from `zabang-royale-/style.css` first, then build. Don't
hand-roll island colors into a dark-theme stylesheet — you'll get a muddy hybrid.

## Relationship to the `zbang` skill

`zbang` documents the app's earlier identity: flat, matte, dark, Material-3 premium.
**Tropical is its replacement, not a variant of it.** The two are deliberately
contradictory — where they disagree, tropical wins for anything built in this theme.
Everything in `zbang` that is *not* about surface appearance still holds: the screen
system and `showScreen()`, the component class names, the icon pipeline, the RTL and
Hebrew rules, the 460px canvas, the normalized-dictionary rule. Keep the skeleton,
replace the skin.

## The identity in one line

**A sunlit cartoon island** — hand-painted jungle and lagoon behind the UI, every
panel carved from wood and filled with cream parchment, every button a chunky candy
slab that physically sinks when you press it. Warm, tactile, loud, friendly.

## Deliberate non-goals

So you don't drift back toward the old skin: no dark surfaces, no hairline 1px
borders, no flat shadowless rectangles, no thin text, no muted desaturated accents,
no blurred glassmorphism. Nothing here is subtle. If a new element looks like it
belongs in a banking app, it is wrong.

Every color, radius and bevel you use must come from a CSS variable. A literal hex in
a new rule is the clearest sign that new UI has drifted, because it will not follow
when a token is retuned.

## Tokens

### The world — the illustrated scene behind the UI

| Token | Value | Owns |
|---|---|---|
| `--sky` / `--sky-low` | `#7FC4E8` / `#C9E9F7` | the sky gradient, top to horizon |
| `--water` / `--water-deep` | `#5FCEDB` / `#3BA9BC` | the lagoon, the river, pool tables |
| `--sand` / `--sand-deep` | `#EBD6A4` / `#D4B878` | beaches, shorelines |
| `--jungle` / `--jungle-deep` | `#5FB13C` / `#2F7A2A` | foliage, palm fronds, bushes |
| `--felt` / `--felt-deep` | `#97CC55` / `#7FB544` | the play surface — the grassy table |

The world is always *behind* the UI and always slightly hazy, so cream panels on top
of it stay legible. Never place body text directly on the world.

### Wood — the frame material

`--wood-dark #4E3116` (the outline that rings **everything**) ·
`--wood #8A5A2E` (planks, signboards, name plates) ·
`--wood-light #A9743F` (the lit top edge of a plank).

### Cream — the panel material

`--cream #FDF4DC` (panel fill) · `--cream-2 #F6E7C0` (list rows) ·
`--cream-3 #EFD9A6` (nested rows, tracks, wells) · `--cream-hi #FFFBEF` (the inner
top highlight that makes cream look domed) · `--cream-mint #E4F2C8` (the
"this row is you" tint — the only row tint in the system).

### Actions — each is a face plus a base

The **base** is the darker slab below the face; it is what produces the bevel. Never
use a face without its base.

| Face | Base | Owns |
|---|---|---|
| `--green #7FBE3F` | `--green-base #5C9328` | play, confirm, the primary CTA |
| `--gold #F7C445` | `--gold-base #D29A1C` | coins, rewards, round icon buttons |
| `--orange #CE7A2E` | `--orange-base #9E5219` | menu buttons, the wooden action list |
| `--blue #43A0EA` | `--blue-base #2B7AC2` | social, invite, level badges, links |
| `--red #DB4C3C` | `--red-base #AF3226` | close, exit, destructive, the timer |
| `--purple #8A5CC7` | `--purple-base #6B429E` | VIP, admin, random matchmaking |

The old `--neon-*` and `--grad-*` names still exist as aliases onto these, because
call sites all over `game.css` use them. Trust the values, not the names.

### Text

`--ink #4E3116` (brown — primary text, on cream) · `--ink-2 #8A6A48` (captions,
hints) · `--ink-on-color #FFFFFF` (text on a colored face, always with the brown
text-shadow below) · `--title-fill #FFD873` (the gold of carved headline text).

### Radii — chunkier than the old scale

`--radius-sm 16px` compact controls · `--radius-btn 22px` buttons and inputs ·
`--radius-tile 18px` board tiles · `--radius-card 28px` cards and modals ·
`--radius-frame 32px` the app frame · `--radius-pill 999px` name plates, badges,
round icon buttons.

### The three signature shadows

```css
--bevel:    0 6px 0 var(--btn-base), 0 10px 16px rgba(78, 49, 22, 0.32);
--bevel-sm: 0 4px 0 var(--btn-base), 0 6px 12px rgba(78, 49, 22, 0.28);
--sink:     0 2px 0 var(--btn-base), 0 4px 8px rgba(78, 49, 22, 0.28);
--panel-shadow: 0 12px 28px rgba(78, 49, 22, 0.35);
```

`--bevel` is the whole theme in one line: a **hard, zero-blur offset** in the
element's own base color, plus a soft brown ambient shadow under it. Colored shadows
are brown here, never black — black reads cold against cream and wood.

### Type

`--font-display: 'Rubik'` at **800–900** for everything with presence. Rubik already
carries the Hebrew and is already loaded; the cartoon feel comes from the outline and
shadow treatment below, not from a novelty font. Don't swap in a display face that
hasn't been verified to render Hebrew. `--font-body: 'Poppins'` stays for running
Latin text and digits.

## The three materials

Almost every surface in this theme is one of three recipes. Build from these before
writing anything bespoke.

### 1. The wood frame — for panels, modals, containers

A dark carved ring, a wood rim, cream inside:

```css
.panel {
  background: var(--cream);
  border: 4px solid var(--wood-dark);
  border-radius: var(--radius-card);
  box-shadow:
    0 0 0 6px var(--wood),              /* the wooden rim outside the ring */
    0 0 0 9px var(--wood-dark),         /* the outer carved edge */
    inset 0 3px 0 var(--cream-hi),      /* the domed top highlight */
    var(--panel-shadow);
  padding: 18px;
}
```

### 2. The candy button — for every tappable control

```css
.btn {
  background: var(--btn-face);
  border: 3px solid var(--wood-dark);
  border-radius: var(--radius-btn);
  box-shadow: var(--bevel);
  color: var(--ink-on-color);
  font: 800 1.05rem/1 var(--font-display);
  text-shadow: 0 2px 0 rgba(78, 49, 22, 0.45);
  transform: translateY(0);
}
.btn::before {                 /* the glossy top third */
  content: ''; position: absolute; inset: 3px 3px auto; height: 38%;
  border-radius: inherit;
  background: linear-gradient(rgba(255,255,255,0.38), rgba(255,255,255,0));
  pointer-events: none;
}
.btn:active { transform: translateY(4px); box-shadow: var(--sink); }
```

Each color class sets only `--btn-face` and `--btn-base`; the recipe above does the
rest. That is how a new button color is added — two variables, never a new shadow.

**The press is the point.** The button must travel down by exactly the amount the
bevel shrinks, so the top face moves and the ground stays put. `--bevel` (6px) pairs
with `translateY(4px)` + `--sink` (2px).

### 3. The carved headline — for titles and callouts

Gold fill, thick brown outline, hard drop shadow — the "sticker" look of the logo in
`images/home.png`:

```css
.carved {
  font: 900 2rem/1.1 var(--font-display);
  color: var(--title-fill);
  -webkit-text-stroke: 3px var(--wood-dark);
  paint-order: stroke fill;              /* stroke behind the fill, not over it */
  text-shadow: 0 4px 0 rgba(78, 49, 22, 0.55);
}
```

`paint-order: stroke fill` is mandatory — without it the stroke eats into the
letterforms and Hebrew becomes mush at small sizes. Below ~18px use `--ink` on cream
instead of a carved treatment; the outline stops being legible.

## Components

**Signboard header** — a modal's title is a wood plank that overlaps the top edge of
the panel, not text inside it (see `images/shop.png`): `--wood` fill, `--wood-dark`
ring, `--radius-pill`, carved cream text, pulled up with a negative top margin so it
straddles the frame.

**Round icon button** — `--gold` face, `--radius-pill`, 1:1, a brown glyph inside,
`--bevel-sm`. This is the help/settings/gift/music cluster in the screen corners.
Icon-only always means an `aria-label`.

**List row** — `--cream-2` fill, `2px solid var(--wood-dark)`, `--radius-sm`,
`inset 0 2px 0 var(--cream-hi)`. The current player's row switches to `--cream-mint`.
Rank, avatar and name sit at the start (right, in RTL); the value sits at the end.

**Avatar** — a circle with a thick `--gold` ring and a `--wood-dark` outer stroke:
`border: 3px solid var(--wood-dark); box-shadow: 0 0 0 4px var(--gold), 0 0 0 7px
var(--wood-dark);`. A level badge (`--blue` face, carved white number) overlaps its
corner.

**Name plate** — a `--wood` pill with cream carved text and a small round flag or
icon at the leading edge; the score sits in a `--gold` chip below it.

**Coin chip** — a `--gold` circle with a `--gold-base` rim and a brown glyph, followed
by the amount in carved cream. Always `toLocaleString('he-IL')`.

**Progress bar** — a `--cream-3` well with a `--wood-dark` ring, filled with a
`--blue` bar that carries `inset 0 2px 0 rgba(255,255,255,0.45)`.

**Board & tiles** — the board sits on `--felt` inside a wood frame. `.letter-tile` is
a cream candy slab: `--cream` face over a `--sand-deep` base with the standard bevel,
carved `--ink` letter. `.selected` swaps the face to `--gold`. Arena skins still
re-tint through `--tile-bg` / `--tile-text` via `applyBoardTheme()` — a new skin is a
new ARENAS row, not new CSS.

**Icons** — inline SVG only, via `icon('name')` from `icons.js`. Keep the 24×24,
`stroke-width: 2`, round-cap style; on this theme they inherit `--ink` on cream and
white on a colored face.

## Motion

Bouncier than the old theme, and always physical. One curve:
`cubic-bezier(0.34, 1.56, 0.64, 1)` over 0.14–0.2s.

- Press: the bevel sink described above — never a scale-down.
- Hover: `translateY(-2px)` and the bevel grows to `0 8px 0`.
- Panels enter with a small overshoot pop (`scale(0.88) → 1`).
- Rewards and coins: a short arc plus a spin; confetti on victory.
- Ambient world motion (drifting clouds, swaying fronds) runs 8–20s and stays slow
  enough to ignore.

Everything decorative belongs inside `@media (prefers-reduced-motion: reduce)` guards.

## Hebrew & RTL

The UI language is Hebrew, in the app's warm, plain register ("כל הכבוד!",
"הוקפאת!", "אין יריבים להקפיא"). Say what happened; don't apologize.

`body` is `direction: rtl`. Use logical properties (`margin-inline-start`,
`border-inline-start`, `padding-inline`) so mirroring stays automatic. Numbers and
Latin words inside Hebrew keep their LTR order — don't fight it. Format counts with
`toLocaleString('he-IL')`.

Dictionary words are stored **normalized** (final letters in regular form, עולם →
עולמ). Any UI that displays or searches words calls `normalizeFinals()` first.

Icon-only controls need an `aria-label` and a visible focus ring — use
`outline: 3px solid var(--blue)` with `outline-offset: 3px`, which stays visible
against both cream and wood.

## Working checklist

- Did you actually look at `images/` before styling?
- Is every surface one of the three materials — wood frame, cream panel, candy button?
- Does every colored control set `--btn-face` **and** `--btn-base`?
- Does it sink on press by the exact amount the bevel loses?
- Is every outline `--wood-dark`, and every ambient shadow brown rather than black?
- Carved text only above ~18px, with `paint-order: stroke fill`?
- Hebrew copy, RTL-safe logical properties, `aria-label` on icon-only controls?
- Does it still look right at 460px wide — the real canvas?
