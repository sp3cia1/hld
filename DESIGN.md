---
name: Build My Holiday
description: A mid-century travel poster, made for booking. Warm paper, navy ink, and colours that each have one job.
colors:
  primary: '#24706b'
  primary-foreground: '#fbf6ec'
  destructive: '#b83d26'
  caution: '#f9dfa0'
  caution-foreground: '#5e4100'
  sun: '#f2b134'
  foreground: '#1f3a5f'
  border: '#1f3a5f'
  secondary-foreground: '#34506f'
  muted-foreground: '#55667a'
  background: '#f3e9d6'
  card: '#fbf6ec'
  muted: '#efe3cc'
  secondary: '#efe3cc'
  accent: '#efe3cc'
typography:
  display:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '3rem'
    fontWeight: 800
    lineHeight: 1
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.5
  figure:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 800
    fontFeature: 'tnum'
  body:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: 'tnum'
  label:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1
  masthead:
    fontFamily: 'Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 800
    letterSpacing: '0.1em'
rounded:
  sm: '8px'
  md: '10px'
  lg: '12px'
  xl: '16px'
  full: '9999px'
spacing:
  '2': '8px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
components:
  button-default:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: '40px'
    padding: '8px 16px'
  button-action:
    backgroundColor: 'transparent'
    textColor: '{colors.primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: '32px'
    padding: '0 12px'
  button-action-active:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
  button-outline:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: '40px'
  button-destructive:
    backgroundColor: '{colors.destructive}'
    textColor: '#ffffff'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: '40px'
  card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.xl}'
    padding: '24px'
  input:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    height: '40px'
    padding: '4px 12px'
  badge-default:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.full}'
  badge-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.full}'
  badge-caution:
    backgroundColor: '{colors.caution}'
    textColor: '{colors.caution-foreground}'
    rounded: '{rounded.full}'
  badge-destructive:
    backgroundColor: '{colors.destructive}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
---

# Design System: Build My Holiday

Every rule below says why. When a screen meets a case the rules don't cover, decide from the reason, not the letter.
Tokens live in `apps/web/src/index.css`; the example screens in `apps/web/src/features/events` and
`features/reservations` apply all of it.

## Overview

**Creative North Star: "The Travel Poster"**

The app looks like a mid-century travel poster that learned to sell tickets: warm cream paper, navy ink, a flat sun,
and a few printed colours with hard edges. It is warm and bright because travel is. It is still a booking tool, so
clarity comes first: every screen is for finding, comparing or booking, and the poster character lives in the details
(the headline type, the sun, the lift when a card is hovered, the stamp when something is booked), never in the way of
a price or a time.

Screens breathe on purpose: generous padding, one idea per surface, and fewer items at once rather than smaller ones
(The Show-Less Rule, under Layout). A printed poster has no gradients, glass or glow, so neither does the app.

**Key Characteristics:**

- Cream paper and navy ink, never pure white or black.
- Three signal colours with one job each: teal says go, red says danger, mustard says take care.
- One font, Bricolage Grotesque: chunky at headline size, plain at text size, same-width digits everywhere.
- Flat surfaces with navy outlines. The only shadow is a hard "lift" on things the customer can act on.
- At most one flat motif per page, chosen by what the page is for.

## Colors

A short run of printed inks on warm paper. Colour carries meaning here, so each colour has exactly one job.

### Primary

- **Poster Teal** (#24706b, `primary`): go and done. Buttons, the filled action on a hovered card, links, a good
  status, the Reserved stamp. Cream text on it measures 5.41:1.

### Secondary

- **Signal Red** (#b83d26, `destructive`): danger and failure only. Sold out, nothing was booked, errors, the button
  that cancels. White text on it measures 5.62:1.

### Tertiary

- **Caution Mustard** (#f9dfa0 with #5e4100 text, `caution`): "take care, but you can go on". Few seats left, a long or
  overnight wait, two airlines on one trip. 7.21:1.
- **Poster Sun** (#f2b134, `sun`): decoration only. The sun motif and text selection. It never signals anything.

### Neutral

- **Navy Ink** (#1f3a5f, `foreground`, `border`, `input`, `ring`): all main text, every outline, focus rings and the
  lift shadow. 9.54:1 on the page.
- **Soft Ink** (#34506f, `secondary-foreground`): text on quiet fills, such as neutral badges.
- **Faded Ink** (#55667a, `muted-foreground`): secondary text (venues, labels, captions). A navy-tinted grey, never a
  neutral grey. 4.89:1 on the page and 4.63:1 on the quiet fill, the tightest pair in the app.
- **Cream Paper** (#f3e9d6, `background`): the page, and the inside of inputs.
- **Card Paper** (#fbf6ec, `card`): cards and panels, one shade lighter than the page.
- **Quiet Fill** (#efe3cc, `muted`, `secondary`, `accent`): neutral badges and hover backgrounds. One colour under
  three names, because shadcn components ask for it by all three.

### Named Rules

**The One-Job Rule.** Teal means go or done, red means danger, mustard means take care, and none of them is used for
anything else: no red logo, no mustard "Cheapest" tag. Customers read colour before words, so a colour with two jobs
makes them misread the screen, and the moment something sells out has to be unmistakable. Good news such as "Fastest"
is a kind of go: give it the default (teal) badge.

**The Measured Contrast Rule.** Every text colour pair is measured, not judged by eye: at least 4.5:1 for text and 3:1
for outlines. Every pair above was measured when it was chosen. Measure a new pair before it ships; if it fails, move
the colour a shade darker.

## Typography

**Display Font:** Bricolage Grotesque Variable (with ui-sans-serif, system-ui)
**Body Font:** Bricolage Grotesque Variable

**Character:** One grotesque that changes with size. Its optical-size axis makes headlines chunky and printed-looking
and keeps 14px text plain and easy to read. Digits are the same width everywhere, so times and prices line up.

### Hierarchy

- **Display** (800, 3rem from 640px wide and 2.25rem below, line-height about 1, -0.025em): `h1`, one per page.
- **Headline** (700, 1.25rem, -0.025em): `h2` for sections and for loading, empty and error states.
- **Title** (700, 1.125rem): card titles, set with `text-lg` on the card's heading.
- **Figure** (800, 1.25rem in lists and 1.875rem on detail pages): prices and totals.
- **Body** (400, 1rem, line-height 1.5): sentences. Keep lines under about 70 characters.
- **Label** (600, 0.875rem for buttons and 0.75rem for badges; form labels 500): controls and their names.
- **Masthead** (800, 0.875rem, uppercase, 0.1em tracking): the app name in the header, nowhere else.

### Named Rules

**The One Family Rule.** Bricolage Grotesque is the only font: one file set to bundle and no rules about which font goes
where. It comes from npm (`@fontsource-variable/bricolage-grotesque`, imported as `opsz.css` in `main.tsx`, the file
that carries the optical sizes), so it works with no internet. A second font needs a decision record and must pass two
checks: it has the ₹ sign (render ₹ with the font in front of two different fallback fonts that have ₹; equal widths
mean the glyph is the font's own) and its digits are the same width (with `tabular-nums`, "1111111111" and
"0000000000" measure the same). See `../decisions/0010-bricolage-grotesque.md` (outside the repo).

**The Bare Heading Rule.** Write page titles and section headings bare, `<h1>Title</h1>` and `<h2>Section</h2>`, with
no size, weight or tracking classes. `index.css` styles `h1` and `h2` once, so every page gets the same headline without
anyone remembering the numbers. The one exception is a card title: it takes `text-lg`, because it must read smaller than
the section heading above it. Choose the level by structure, not looks: a heading is one level below the heading it sits
under. `EventCard`'s title is an `h2` because search lists cards straight under the page's `h1`; cards grouped under
section headings (by day, by area) need `h3` titles.

## Layout

Pages sit in one centred column (64rem wide at most, 16px side padding: `max-w-5xl px-4`). Sections stack 24 to 32px
apart (`space-y-6` to `space-y-8`), cards in a list 16px apart, and cards have 24px inside (20px for the search panel).
One idea per surface. On phones every grid becomes one column; the search panel's three columns start at 640px.

### Named Rules

**The Show-Less Rule.** When a screen feels crowded, change what it shows before you change how it looks. A crowded
screen usually shows more than the customer needs for the decision in front of them. Thinner lines, smaller text and
tighter spacing only hide that, and they wear down the look everywhere else.

Work out the right amount for each screen:

1. **What is the customer deciding, and how many items do they really weigh at once?** Choosing means comparing the best
   few. Reading a timetable means scanning many. Checking a booking means looking at one.
2. **Does the order mean something?** In a ranked list the top items do the work and the rest can wait. An unranked
   list may be better grouped (by day, by area) than cut.
3. **How big is each item, and how many fit on a laptop or projector screen?** A one-line row and a card with a photo
   deserve different amounts.
4. **What does the data really hold?** Twelve results need nothing extra. Three hundred need filters as well as pages.

Then make the lightest change that works: show fewer at once with the rest on later pages or behind "Show more", group
the items, summarise ("6 more trips via Mumbai"), or move detail behind a click. For forms, split them into steps or
show optional fields only when asked.

Example, event search: the page asked the API for its default of 20 events. Twenty outlined cards stacked into a wall
about four and a half laptop screens tall (3,474px at 1024 by 768), and the few events worth comparing were lost among
ones nobody scrolls to. The list is sorted, customers weigh the first few, and three or four cards fit on a laptop
screen, so the page now asks for 10 (`PAGE_SIZE` in `features/events/search-filters.ts`): 2,034px, with "Page 1 of 2"
underneath. Ten is this screen's answer, not a rule: one-line rows could show many more, and hotel cards with photos
fewer.

## Elevation & Depth

Surfaces are flat and separated by outlines, not shadows: cards and panels have a 2px navy outline on paper one shade
lighter than the page. There is exactly one shadow.

### Shadow Vocabulary

- **Lift** (`box-shadow: 5px 5px 0 #1f3a5f`, token `--lift`, utility `shadow-lift`): a hard printed offset with no
  blur. Always on the search panel; on an interactive card while it is hovered or focused, together with a 2px move up
  and to the left.

### Named Rules

**The Lift Means Act Rule.** The lift goes only on things the customer can act on. In a flat world it is the one depth
cue, so it says "this responds". On static content it would only add weight and stop meaning anything.

## Shapes

Gently rounded, never sharp: 10px for controls such as buttons and inputs (`rounded-md`), 16px for cards and panels
(`rounded-xl`), full pills only for badges. Outlines are navy: 2px on cards, panels and outline buttons, 1px on inputs so
a six-field form stays light. Motifs are flat, hard-edged shapes (a disc, a ring, a cloud outline) with no gradient or
blur.

## Components

### Buttons

- **Shape:** gently rounded (10px), 40px tall (32px for `size="sm"`), label weight 600.
- **Default:** Poster Teal with cream text, for the page's main action.
- **Action** (`variant="action"`): the main action inside a clickable card. Teal outline and teal text at rest. When the
  card is hovered or focused, teal spreads from the bottom centre in a growing circle and the text turns cream (0.5s,
  exponential ease-out; instant when the customer asks for reduced motion). Inside a card that is already a link,
  render it as a span: `<Button asChild variant="action" size="sm"><span>View</span></Button>`.
- **Outline:** 2px navy outline on card paper, for secondary actions ("Try again", "Clear filters", paging).
- **Destructive:** Signal Red with white text, only on the action that destroys something ("Yes, cancel it").
- **Ghost:** text only, for the safe way out ("Keep it", "Clear").
- **Focus:** a 2px navy ring with a 2px cream gap, on every control.

### Cards / Containers

- **Corner Style:** 16px.
- **Background:** Card Paper with a 2px navy outline and no shadow at rest.
- **Interactive:** `<Card asChild interactive><Link …>…</Link></Card>` makes the whole card the link. It lifts onto the
  lift shadow when hovered or focused, and its action button fills at the same moment.
- **Internal Padding:** 24px (`CardContent`).
- Never put a card inside a card.

### Inputs / Fields

- **Style:** 1px navy outline, Cream Paper inside (a shade darker than the card around it), 10px corners, 40px tall.
- **Focus:** a 2px navy ring.
- **Error:** red outline and a red message under the field that names the problem.

### Navigation

- **Header:** the app name on the left in the masthead style, as a link to the home page.
- **Header links** go on the right as small outline buttons, a `NavLink` inside
  `<Button asChild variant="outline" size="sm">`. A page's sun rises behind the right end of the header, and a plain
  teal link on the sun measures only 3.08:1; the button's card paper keeps the text readable (10.66:1).

### Badges

- **Default** (teal): good news, such as a confirmed status or "Fastest".
- **Secondary** (quiet fill): neutral facts, such as "This event has started".
- **Caution** (mustard): "Only 3 left".
- **Destructive** (red): "Sold out".
- Never put a badge or label above a heading to repeat what the heading says.

### States

Every data screen uses `components/states`: **Loading** (spinner and a sentence), **Empty** (a small outlined cloud, a
heading and a way out) and **ErrorState** (the problem, "Try again" and a reference, with no decoration).

### Motifs

The signature: at most one flat poster shape per page, chosen by what the page is for (`components/motif.tsx`).

- **Sun** (`<Motif kind="sun" />`): pages where a trip starts, such as search. A Poster Sun disc rising behind the
  top-right of the content and the right end of the header, cut off by the top of the page. Render it only while the
  page has something to show (loading or results): its empty state brings the cloud, and its error state gets nothing
  (`showSun` in `features/events/pages/search-page.tsx`).
- **Stamp** (`<Motif kind="stamp" label="Reserved" />`): the moment something is booked. A teal ring with the status,
  tilted like a passport stamp beside the heading. Shown from 1024px wide, where it has room beside the text.
- **Cloud:** built into every Empty state ("nothing here yet"). Pages never add it.
- **None:** every other page, and always on errors and failures. Bad news is never decorated.

Every motif follows the same rules, each for a reason: one per page, so it stays a signature and not wallpaper; flat
palette colours and never red, because red means danger; never behind text and hidden from screen readers, because it
is decoration. If no kind fits a page, use none. If a page really needs a new one, add a kind to `components/motif.tsx`
that follows these rules and list it here, so it is made once and reused.

## Do's and Don'ts

### Do:

- **Do** take every colour, font, radius and shadow from the tokens in `index.css` and the components in
  `components/ui`.
- **Do** give each colour its one job (The One-Job Rule).
- **Do** measure a new colour pair before it ships (The Measured Contrast Rule).
- **Do** decide how much a screen shows from the customer's decision (The Show-Less Rule).
- **Do** make a clickable card `interactive`, with an `action` button for its main action.

### Don't:

- **Don't** write a hex value, font name or shadow inside a component.
- **Don't** use gradients, glass, blur, glows or gradient text.
- **Don't** add size or weight classes to `h1` or `h2` (The Bare Heading Rule).
- **Don't** put the lift on static content (The Lift Means Act Rule).
- **Don't** decorate an error or failure screen.
- **Don't** shrink text, thin outlines or squeeze spacing to fit more on a screen.
