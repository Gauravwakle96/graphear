---
name: Graphear
description: Accessible diagram exploration and source review in a calm green workspace
colors:
  ground: '#f5f7f3'
  surface: '#fff'
  subtle: '#eef2eb'
  text: '#203b32'
  muted: '#52665a'
  line: '#d9e1d5'
  accent: '#256344'
  accent-hover: '#184a32'
  focus: '#1c68b8'
  sage: '#edf3e8'
  amber: '#fff0cf'
  warning: '#785006'
  outcome: '#d9edd9'
  danger: '#a02f2f'
  nav: '#193b2e'
  selection: '#e7f1ff'
  ground-dark: '#14241d'
  surface-dark: '#1c3027'
  subtle-dark: '#243b2e'
  text-dark: '#e8f0e7'
  muted-dark: '#b4c6b8'
  line-dark: '#40564a'
  accent-dark: '#93d2a4'
  accent-hover-dark: '#b3e5bf'
  focus-dark: '#9ac7ff'
  sage-dark: '#2b4532'
  amber-dark: '#4c3b1c'
  warning-dark: '#f5d58f'
  outcome-dark: '#305339'
  danger-dark: '#ffb2ac'
  nav-dark: '#0d2118'
  selection-dark: '#234663'
  nav-text: '#cadbce'
  nav-hover: '#254e3a'
  nav-active: '#315f45'
  nav-focus: '#a6d5ff'
  process-stroke: '#a0b598'
  decision-stroke: '#c7a456'
  source-ground: '#fbfcfa'
  source-overlay: '#1c68b826'
  primary-text-dark: '#183126'
typography:
  headline:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: '-0.025em'
  headline-mobile:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '1.3125rem'
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: '-0.015em'
  panel-title:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '1rem'
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: '-0.015em'
  step-title:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.65
  body-small:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.65
  guide-body:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    lineHeight: 1.3
  graph-label:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: 'Manrope, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.5
rounded:
  label: '5px'
  mode-control: '6px'
  control: '7px'
  segment: '8px'
  navigation: '9px'
  panel: '10px'
  terminal: '28px'
spacing:
  '4': '4px'
  '8': '8px'
  '12': '12px'
  '14': '14px'
  '16': '16px'
  '18': '18px'
  '20': '20px'
  '22': '22px'
  '24': '24px'
  '28': '28px'
  '32': '32px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.surface}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 14px'
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
  button-primary-dark:
    backgroundColor: '{colors.accent-dark}'
    textColor: '{colors.primary-text-dark}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 14px'
  button-secondary-hover:
    backgroundColor: '{colors.subtle}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 14px'
  button-danger:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.danger}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 14px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '10px 12px'
  navigation:
    backgroundColor: '{colors.nav}'
    textColor: '{colors.nav-text}'
    padding: '26px 9px'
  badge-success:
    backgroundColor: '{colors.sage}'
    textColor: '{colors.accent}'
    typography: '{typography.caption}'
    rounded: '{rounded.label}'
    padding: '5px 8px'
  badge-warning:
    backgroundColor: '{colors.amber}'
    textColor: '{colors.warning}'
    typography: '{typography.caption}'
    rounded: '{rounded.label}'
    padding: '5px 8px'
  panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.panel}'
    padding: '22px'
  graph-node:
    backgroundColor: '{colors.sage}'
    textColor: '{colors.text}'
    typography: '{typography.graph-label}'
    rounded: '{rounded.segment}'
    padding: '7px 8px'
  graph-node-selected:
    backgroundColor: '{colors.selection}'
  graph-node-decision:
    backgroundColor: '{colors.amber}'
  graph-node-terminal:
    rounded: '{rounded.terminal}'
  branch-button:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '14px'
---

# Design System: Graphear

## Overview

**Creative North Star: "A Readable Route"**

Graphear uses a quiet forest shell around a readable working ground. Sage process nodes, amber decisions, green outcomes and blue current selection make graph state visible without competing with the diagram. Manrope, fine separators and native controls keep the interface consistent across exploration, editing, source review and learning.

The visual language supports keyboard and structured text interaction alongside the canvas. Color reinforces labels, node types, review status and path structure; it does not replace those descriptions. Flat working surfaces keep attention on the graph, while restrained shadows identify temporary menus, confirmations and dialogs.

This record is derived from the finished code and the user-pinned green-and-neutral direction. There is no approved visual comp or quality card. The independent reviewer inspected six viewport/theme captures and five workflow captures and returned a ship verdict on four scored fixes: keyboard traversal focus, fixed-size branch labels, original-source enlargement and metadata below the selected-step heading. That verdict is limited to those fixes. No blind or low-vision user study, screen-reader usability session or measured learning improvement is established.

**Key Characteristics:**

- Forest navigation and green-neutral working surfaces in light and dark themes.
- Compact Manrope hierarchy with fixed-size graph labels.
- Native controls, visible focus and text equivalents for graph actions.
- Semantic node fills, path highlighting and explicit source-review states.

The source of truth is [styles.css](apps/web/src/styles.css), with component behavior
in [ui.tsx](apps/web/src/components/ui.tsx), [GraphCanvas.tsx](apps/web/src/components/GraphCanvas.tsx),
[Explorer.tsx](apps/web/src/features/Explorer.tsx) and [Review.tsx](apps/web/src/features/Review.tsx).
The surface composition remains in [.impeccable/surfaces/workspace.md](.impeccable/surfaces/workspace.md).

## Colors

The palette combines forest and sage with restrained amber and blue state colors.
The frontmatter owns literal values; the suffix `-dark` records the actual dark-theme override.
Use the corresponding CSS custom property so runtime theme changes apply.

### Primary

- **Forest Action Green / Spring Action Green** (`accent`, `accent-dark`): primary buttons, links, branch labels, checked controls and confirmed text.
- **Deep Forest / Pale Spring Hover** (`accent-hover`, `accent-hover-dark`): primary-button hover.
- **Forest Shell / Deep Forest Shell** (`nav`, `nav-dark`): main navigation ground.
- **Navigation State Greens** (`nav-hover`, `nav-active`): existing fixed navigation hover and current-page fills.

### Secondary

- **Process Sage** (`sage`, `sage-dark`): process nodes, success badges, library symbols and checked save-location rows.
- **Outcome Green** (`outcome`, `outcome-dark`): terminal outcomes.
- **Selection Blue** (`selection`, `selection-dark`): current graph node, selected review row and text selection.
- **Focus Blue** (`focus`, `focus-dark`): focus outlines, selected/visited node strokes and traversed paths.
- **Navigation Focus Blue** (`nav-focus`): fixed focus outline against the forest navigation.
- **Source Selection Wash** (`source-overlay`): translucent blue source-region overlay; its stroke uses the light focus blue.

### Tertiary

- **Decision Amber** (`amber`, `amber-dark`): decisions, pending-review badges and draft notices.
- **Warning Ink** (`warning`, `warning-dark`): review warnings and changed paths.
- **Error Red** (`danger`, `danger-dark`): destructive controls and inline failures.
- **Decision Outline** (`decision-stroke`): fixed border on decision nodes and draft notices.

### Neutral

- **Working Ground** (`ground`, `ground-dark`): page background.
- **Working Surface** (`surface`, `surface-dark`): header, panels, fields, branch controls and label backing.
- **Inset Ground** (`subtle`, `subtle-dark`): selected-step summary, notices and mode-switch tray.
- **Forest Ink / Pale Ink** (`text`, `text-dark`): primary text.
- **Supporting Ink** (`muted`, `muted-dark`): metadata, help text, default paths and graph labels.
- **Fine Separator** (`line`, `line-dark`): borders, dividers and dotted canvas grid.
- **Navigation Ink** (`nav-text`): fixed light text on the navigation; current-page text uses white.
- **Process Outline** (`process-stroke`): fixed border on process/terminal nodes and the process legend swatch.
- **Source Paper** (`source-ground`): fixed near-white image viewing ground in both themes.
- **Dark Primary Ink** (`primary-text-dark`): text on the light green primary button in dark theme.

The sidecar's eight-step tonal strips are synthesized preview metadata. They are
not additional application colors or replacements for the extracted tokens.

### Named Rules

**The State Has a Name Rule.** Pair node and review colors with a type, label, status or structured description. Blue selection and traversal never carry meaning alone.

**The Theme Pair Rule.** Use the matching light or dark semantic tokens. Keep original-source pixels and their viewing ground faithful to the imported document.

## Typography

**Display / Body Font:** Manrope with a sans-serif fallback. There is no separate display or monospace family.
The app self-hosts Latin weights 400, 500, 600 and 700 through `@fontsource/manrope`;
the installed font license is SIL Open Font License 1.1.

**Character:** A compact, unembellished hierarchy. Heading tracking is slightly
tightened; labels and short controls are semibold. Paragraphs receive generous
line height, while functional controls remain compact.

### Hierarchy

- **Headline** (`headline`, `headline-mobile`): diagram/page heading; the mobile role applies at 600px and below.
- **Title** (`title`): ordinary section headings.
- **Panel Title** (`panel-title`): explorer and library headings; the hidden-canvas cover keeps a semantic h2 at the existing compact title size.
- **Step Title** (`step-title`): selected-node heading.
- **Body** (`body`, `body-small`): paragraphs; most panel explanations use the smaller role.
- **Guide Body** (`guide-body`): guide paragraphs, constrained to 73ch.
- **Label** (`label`): primary/secondary button text and other compact controls.
- **Graph Label** (`graph-label`): node and branch text. Both are 13px at the 16px root; node geometry changes with the canvas, typography does not.
- **Caption** (`caption`): secondary metadata, status text and legends.

The fixed brand wordmark uses 1.375rem, weight 700 and -0.03em tracking; it becomes
1.25rem on mobile. Dialog headings use 1.25rem. These are local component sizes,
not a larger display scale. Some existing tablet/mobile navigation and status text
is 11px; that compact treatment is not a body-text recommendation or validated
low-vision threshold.

### Named Rules

**The Fixed Label Rule.** Keep rendered branch labels at the graph-label role outside the scaled SVG. Preserve the full branch label in the explorer and structured text.

## Layout

The desktop shell has a 72px header and a 100px navigation rail. Main-content
padding is 28px 32px with no bottom padding. The workspace pairs a flexible
canvas with a 350px exploration column and a 24px gap. Panels have a fine border;
diagram geometry is proportional to its source dimensions, inside a scrolling
canvas region. The dot grid repeats every 20px. The diagram title precedes its
source/count metadata.

The repeated spacing vocabulary uses 8px control gaps, 12–18px internal row
spacing, 20–24px panel/section spacing and 28–32px page spacing. It is extracted
from repeated values rather than a pre-existing spacing-token file.

- **At 1600px and above:** main content is capped at 1650px and the explorer grows to 380px.
- **At 1190px and below:** main padding becomes 24px 22px, panel padding 18px, the explorer is 320px and the workspace gap is 16px.
- **At 960px and below:** the rail is 80px; the explorer follows the canvas. Its step/branch group and history occupy two columns.
- **At 600px and below:** the shell stacks, the header is 66px and navigation becomes a horizontal row. Main padding is 23px 16px, work panels use 20px padding and exploration returns to one column. Mode buttons fill the available width and actions wrap.
- **Canvas width:** minimum widths are 580px by default, 540px at the intermediate breakpoint and 560px at tablet/mobile sizes. Narrow screens scroll the canvas without shrinking branch text.

Library/practice content is capped at 1120px; guide content at 900px. Native fields
and standard buttons have a minimum height of 44px. Branch controls have a minimum
height of 70px. Existing narrow canvas icon buttons use a 38px minimum width with
44px minimum height; this is a local toolbar accommodation.

## Elevation & Depth

Depth comes primarily from the contrast between working ground, surface and inset
ground, plus fine separators. The canvas and working panels carry no shadow.
Floating UI uses a small, soft shadow vocabulary and the native dialog backdrop
dims the surrounding workspace.

### Shadow Vocabulary

- **Menu:** `0 8px 24px #102a241f`, for export options.
- **Confirmation:** `0 8px 30px #102a2426`, for the fixed toast.
- **Dialog:** `0 18px 60px #102a2440`, with backdrop `#112a24a1`.

### Named Rules

**The Working Plane Rule.** Working panels remain flat. Reserve the observed soft shadows for floating menus, transient confirmations and modal dialogs.

## Shapes

Controls and inset summaries use the gently rounded control radius; panels and
dialogs use the larger panel radius. Mode controls, status badges and navigation
use their separate observed steps. Process and decision nodes are rounded
rectangles; start/end nodes use the terminal radius. The source document retains
its own geometry, including decision diamonds in an imported diagram.

Working surfaces use 1px borders. Selected nodes use a 2px focus-colored border;
visited nodes keep their semantic fill with the same focus-colored border.
Unconfirmed nodes have dashed borders, and unconfirmed edges use a 5 4 dash
pattern. The canvas is clipped by its rounded frame while its internal region
scrolls.

## Components

### Buttons

Native buttons are compact and explicit. Primary, secondary, ghost and danger
variants share the control radius, semibold label role, 10px 14px padding and
44px minimum height. Primary actions use accent fill; dark theme uses the
dedicated dark primary ink. Secondary actions use surface fill and a fine
separator border. Ghost actions have transparent fill and border; danger actions
use error-colored text and border.

Hover changes background and border over 160ms ease-out. Disabled buttons use
0.48 opacity and a not-allowed cursor. Focus uses a 3px blue outline with a 4px
offset. Icon-only actions retain accessible names and use real SVG icons.

### Chips

Status badges are informational, not interactive filters. Success pairs sage
with accent text; warning pairs amber with warning text. They use the label
radius and 5px 8px padding. Narrow layouts reduce their text and padding locally.

### Cards / Containers

Working panels use surface fill, a separator border, panel radius and 22px
padding before responsive overrides. The selected-step summary is an inset block
with subtle fill and 17px padding. Its heading comes first, then type and
confirmation metadata. Library entries are separated rows rather than a grid of
decorative cards.

### Inputs / Fields

Text inputs, selects and textareas are native elements with surface fill, text
ink, a separator border, control radius, 10px 12px padding and a 44px minimum
height. Labels remain visible. Placeholders use muted ink; the caret and native
checkbox/radio/range accents use action green. Focus retains the shared outline.
Inline errors use explicit text and danger ink; the code does not define a
separate red input-border variant.

### Navigation

The forest navigation rail groups SVG icons with text labels. Current-page state
uses a fixed green fill, white text and `aria-current="page"`; hover uses its
separate green. It becomes a horizontal row on mobile. Workspace modes are
native buttons in a subtle tray, with `aria-pressed`, surface fill and a fine
border on the active mode. They are a grouped mode switch rather than an ARIA tab
widget.

### Graph and Branch Exploration

Graph nodes are native buttons with type and review information in their
accessible names and `aria-pressed` for selection. The fixed-size branch labels
sit in HTML overlays with a surface backing and label radius. Longer visual
labels are abbreviated after ten characters; the explorer keeps the full text.

Branch controls contain a bold branch label, target-node text and any review
warning. A traversal updates the graph path and programmatically focuses the
new selected-step heading, which carries its own visible focus outline. Back,
restart, history and optional narration retain separate native controls.

### Source Inspection and Dialogs

The review panel keeps the original image and selected source region visible.
"Enlarge original source" opens a native modal dialog with a labelled 100–300%
range in 25% steps. The image area is a keyboard-focusable scroll region capped
at 60vh; the source dialog is at most 1000px wide. Escape closes it and restores
focus through the shared dialog component. Original-source paper stays near-white
in both themes to retain the imported document's appearance.

All transitions are disabled under `prefers-reduced-motion: reduce`, with
animations removed and scrolling set to auto.

## Do's and Don'ts

### Do:

- **Do** use the semantic light/dark pairs for surfaces, text, borders, node fills and selection.
- **Do** keep primary actions, navigation, fields and branches as native, labelled controls with visible focus.
- **Do** place the selected-step heading before its type and review metadata and move focus to that heading after branch traversal.
- **Do** preserve source-review uncertainty with explicit text and dashed graph connections or nodes.
- **Do** retain reduced-motion behavior and the canvas scroll region at narrow widths.

### Don't:

- **Don't** substitute a decorative hero or fabricated results for the working diagram and its text interaction.
- **Don't** scale branch typography inside the graph SVG or truncate the explorer's full branch descriptions.
- **Don't** use color as the only indication of selection, outcome, review status or change.
- **Don't** treat the scoped ship verdict or automated accessibility checks as evidence of user validation.

**Not canonized or repaired:** unused legacy SVG branch-label styles still specify
12px; the rendered branch labels use the 13px HTML-overlay role. That unused CSS
is pre-existing drift outside this documentation pass, not a reusable type rule.
The compact 11px narrow-layout captions remain a stated limitation pending
representative low-vision review, not evidence that this size is broadly usable.

Review captures are stored under `.impeccable/review`: desktop/tablet/mobile in
light and dark themes, plus library, practice, source review, save dialog and
source-inspector/keyboard captures. The engineering evidence and unperformed
checks are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).
