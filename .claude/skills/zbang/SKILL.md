---
name: zbang
description: The visual design system of זבאנג רויאל (Zabang Royale) - its palette, typography, component patterns, RTL/Hebrew conventions and motion language. Use this skill whenever building, restyling or reviewing ANY user interface for this game: a new screen or modal, a button, a card, a list row, a badge, a toast, a board skin, an arena theme, or a mockup/preview of the game - and also when the user says "ZBANG", "בסגנון של המשחק", "כמו במשחק", or asks for something that has to look like it belongs in the app. Consult it before writing CSS or HTML for the game, so new UI reuses the existing tokens instead of inventing colors, radii and shadows that drift from the rest of the app.
---

# ZBANG — the Zabang Royale design system

The game already has a complete, consistent visual identity. Your job when building
UI for it is **not** to design something new, it is to extend what's there so a new
screen is indistinguishable from a screen that shipped a year ago.

The identity in one line: **a flat, matte, dark "premium mobile app"** — Material 3 /
iOS-native in feel, Hebrew-first RTL, with color used as *identity* (each action owns
a hue) rather than as decoration.

Deliberate non-goals, so you don't drift back toward them: no neon glow halos, no
bright gradients on fills, no glassmorphism, no 3px colored outlines, no light theme.
The variable names still say `--neon-*` and `--grad-*` for historical reasons — the
**values** are flat and deep. Trust the values, not the names.

## Before you write anything

Read `style.css` (tokens, app frame, `.screen`) and `game.css` (all components) —
they are the source of truth, and this file is the map. If a token below disagrees
with the CSS, the CSS wins and this file should be corrected.

Every color, radius and shadow you use must come from a CSS variable. A literal hex
in a new rule is the single clearest sign that new UI has drifted, because it will
not follow when a token is retuned.

## Tokens

Defined on `:root` in `style.css`.

**Accents** — each is an identity, not a decoration:

| Token | Value | Owns |
|---|---|---|
| `--neon-cyan` / `-deep` | `#4E7FD6` / `#3A65B8` | primary/blue actions, single-player, links |
| `--neon-lime` / `-deep` | `#147A4A` / `#2FBE85` | play, success, score, approvals |
| `--neon-gold` / `-deep` | `#C99A2E` / `#A87F22` | shop, coins, rewards, the selected tile |
| `--neon-orange` / `-deep` | `#A85A1E` / `#8F4A16` | battle royale |
| `--neon-purple` / `-deep` | `#5B4FCF` / `#4A3FB0` | random matchmaking, admin |
| `--neon-pink` `--neon-magenta` | `#C24E7A` `#9C4394` | accents in the title sweep, aurora |
| `--neon-red` / `-deep` | `#B3372E` / `#952B23` | close/back, destructive, the timer |

Fills use the `--grad-*` aliases (`--grad-blue`, `--grad-green`, `--grad-gold`,
`--grad-orange`, `--grad-purple`, `--grad-pink`, `--grad-red`). They are **solid
colors** despite the name.

**Surfaces** — a dark obsidian ladder; each tier is slightly lighter than the one
behind it, so depth reads without borders:

`--bg-deep-2 #0c0d10` (page behind the frame) → `--bg-deep #121317` (app frame) →
`--panel-light #1C1E24` (cards, modals) → `--surface-2 #262933` (controls, rows) →
`--surface-3 #2E313D` (hover / nested rows).

**Text**: `--text-dark #F1F2F5` (primary — light despite the name),
`--text-secondary #A6ABB8` (captions, hints, subtitles), `--text-light #ffffff`.

**Radii** (three tiers, pick by size): `--radius-sm 14px` compact controls ·
`--radius-btn 18px` buttons/inputs/panels · `--radius-tile 16px` board tiles ·
`--radius-card 24px` cards & modals · `--radius-frame 28px` the app frame.

**Elevation**: `--shadow-depth-sm/md/lg` are neutral black diffusion — real physical
lift. The `--glow-*` tokens are a *whisper* of the element's hue (0.22 alpha) plus a
depth shadow; they are for colored buttons only, and they are not a neon halo.

**Type**: `--font-display: 'Rubik'` for anything with presence — headings, buttons,
board letters, scores, timers — at weight 700–800. `--font-body: 'Poppins'` for
running text. Rubik carries the Hebrew; Poppins covers Latin and digits.

**Frame**: `--app-max-width: 460px`. The whole game lives inside `#app`, a centered
phone-shaped card. Design mobile-first and treat 460px as the real canvas.

## Layout

`.screen` is a full-height flex container, hidden until it has `.active`; `showScreen(id)`
swaps that class and scrolls to top. Screens fade in via `animation: fadeIn 0.3s`.

Content screens wrap their body in `.modal-content` (dialog-like screens: mode
picker, instructions) or `.profile-container` / `.shop-container` (long scrolling
screens: profile, shop, leaderboard, word bank). Reuse one of those rather than
inventing a new wrapper.

Screens carry a corner `.exit-btn` (a house icon) to go back. Game screens
(`#gameScreen`, `#battleScreen`) stack their children full-width up to 520px.

Space siblings with flex/grid `gap`, not per-element margins.

## Components

Extend these before writing anything new — the vocabulary is nearly complete.

**Buttons** — `.btn-large` (full-width, Rubik 800, `--radius-btn`) plus a color class
that carries the identity: `.green-btn` play · `.gold-btn` shop/reward ·
`.blue-btn` neutral/primary · `.orange-btn` battle · `.purple-btn` admin/random.
`.close-modal-btn` is the red full-width close/back — because it is red it reads as
"leave/destroy", so never use it for a neutral toggle.

**Cards & rows** — `.player-card` is the signature card: `--panel-light` under a
faint diagonal blue→magenta sheen, hairline `rgba(255,255,255,0.07)` border with a
brighter top edge, `--radius-card`, `--shadow-depth-md`. `.mode-option` is the
tappable row (`--surface-2`, lifts to `--surface-3` on hover, accent side bar via
`--mode-accent`). `.submission-row` is the compact list row — word/label on one side,
actions on the other; the word bank and the moderation queue both use it.

**Badges** — `.sub-status` pills: `.sub-pending` amber, `.sub-approved` green,
`.sub-builtin` neutral grey. Encode state in the pill, not only in words.

**Board** — `.board` is a 5×5 grid, `aspect-ratio: 1`, `width: min(100%, 52vh)`,
`gap: 10px`. `.letter-tile` uses `--tile-bg`/`--tile-text` so arena skins can
re-tint it; `.selected` turns gold. `applyBoardTheme()` writes the arena's colors
into those inline vars — a new board skin means a new ARENAS row, not new CSS.

**Feedback** — `showMessage(text, type)` for a centered toast (`success`/`error`/
`warning`/`info`), `showBoardMessage(text, type, ms)` for the small one above the
board, `launchSparkles()` per word, `launchConfetti()` for victories. Reuse them
instead of inventing a new notification surface.

**Icons** — inline SVG only, never an icon font or emoji-as-icon (emoji appear only
as arena motifs and the shop's price tiles). Call `icon('name')` from `icons.js`,
which wraps the SVG in `<span class="icon">`; the SVG inherits `currentColor` and
sizes to `1em`. Available: play, shopBag, profile, coin, diamond, home, hint,
shuffle, freeze, freezeOpponents, tornado, timer, replay, trophy, submit, check,
close, pencil, help, sword, musicOn, musicOff. Add new ones to `ICONS` in the same
24×24, `stroke-width: 2`, round-cap style.

## Motion

One spring curve carries the whole app: `cubic-bezier(0.34, 1.56, 0.64, 1)`, over
0.15–0.2s. Press = `transform: scale(0.93–0.97)`; hover = `translateY(-2px)` plus a
step up in shadow. Ambient loops (title shimmer, aurora drift) run 6–18s and stay
subtle. Everything decorative belongs inside `@media (prefers-reduced-motion: reduce)`
guards, as the existing animations already are.

Motion here confirms a tap; it does not announce itself.

## Hebrew & RTL

`body` is `direction: rtl` and the UI language is Hebrew — write user-facing strings
in Hebrew, in the app's plain, warm register ("הוקפאת!", "כל הכבוד!", "אין יריבים
להקפיא"), and say what happened rather than apologizing.

Use logical properties (`margin-inline-start`, `border-inline-start`, `padding-inline`)
so mirroring stays automatic. Numbers and Latin words inside Hebrew text keep their
LTR order naturally — don't fight it. Format counts with `toLocaleString('he-IL')`.

Dictionary words are stored **normalized**: final letters written in their regular
form (עולם → עולמ). Any UI that displays or searches words normalizes with
`normalizeFinals()` first, so a player typing "שלום" still finds "שלומ".

Every interactive element needs an `aria-label` when its content is only an icon,
and a visible focus state.

## Working checklist

- Reused an existing component class instead of a new one?
- Every color, radius, shadow from a token?
- Both hover and `:active` states, with the spring curve?
- Hebrew copy, RTL-safe properties, aria-label on icon-only controls?
- Does it still look right at 460px wide — the real canvas?
