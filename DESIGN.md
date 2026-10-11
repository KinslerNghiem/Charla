---
name: Charla
description: The card you hand across the counter.
colors:
  counter: "#eef1f4"
  card: "#ffffff"
  card-shade: "#f3f5f8"
  ink: "#1a1d21"
  ink-soft: "#5b6470"
  rule: "#d7dce2"
  river-blue: "#1e5fae"
  river-blue-soft: "#e3ecf8"
  card-red: "#c8102e"
  card-red-soft: "#fbe4e7"
  go-green: "#2e7d32"
  go-green-soft: "#e3f1e4"
  amber: "#a04a00"
  amber-soft: "#fbeedc"
  stop-red: "#b3261e"
  stop-red-soft: "#f9e1df"
  program-teal: "#0e7c86"
  unverified-grey: "#9aa3ad"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "wdth 87.5"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontVariation: "wdth 87.5"
  spoken:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
    fontVariation: "wdth 87.5"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "8px"
  card: "12px"
  pill: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.counter}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.counter}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  button-talk:
    backgroundColor: "{colors.card}"
    textColor: "{colors.river-blue}"
    rounded: "26px"
    height: "52px"
  button-talk-active:
    backgroundColor: "{colors.river-blue}"
    textColor: "{colors.card}"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.river-blue-soft}"
    textColor: "{colors.river-blue}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px 14px"
  card-band:
    backgroundColor: "{colors.river-blue}"
    textColor: "{colors.card}"
    height: "32px"
---

# Design System: Charla

## Overview

**Creative North Star: "The Laminated Counter Card"**

Charla is the card a learner hands across a counter, so the screen is a counter with laminated bilingual cards laid on it. The ground is a cool, slightly blue grey; every card is flat white and known by its edge against that ground, never by a shadow or a border. Each card wears a band in the colour of the language it is for: river blue for English, card red for Spanish. The language the learner is practicing becomes the accent for every live state (the active tab, the selected row, the recording mic, focus), so the whole app quietly turns blue or red with the direction the learner chose.

One typeface carries everything. Archivo, self-hosted and precached, set semi-condensed and bold for titles and for every line meant to be said aloud, the way a card prints them, and at full width for body, labels and controls. The learner's own language always sits directly under the line it glosses, smaller and in secondary ink. Icons are a single drawn stroke set; emoji appear only as scene pictures in kid mode, where they are content.

The visual register is calm. Nothing competes with the conversation, and nothing in the adult app reads as a toy. Confirmed anti-references: loud or busy screens; anything that makes the adult app look childish.

**Key Characteristics:**
- Flat white cards on a cool counter ground; no shadows, no card borders.
- A language band on every card; the accent follows the language being practiced.
- One face, Archivo: semi-condensed bold for what is read aloud, regular for the rest.
- Drawn line icons at one stroke weight; emoji only as kid-mode pictures.
- Two-language pairs everywhere, the gloss always smaller and under.

## Colors

A cool neutral ground with two language colours doing real jobs and four state colours used only where they carry meaning.

### Primary
- **River Blue** (#1E5FAE): English. The band on English cards, and the accent for every live state while the learner practices English: active tab, selected row, the mic, focus, links. Soft tint **River Blue Soft** (#E3ECF8) for the learner's own chat bubble, the selected level, chips and number badges.
- **Card Red** (#C8102E): Spanish. The band on Spanish cards, and the accent for every live state while the learner practices Spanish. Soft tint **Card Red Soft** (#FBE4E7) plays the same roles as the blue tint in that direction.

### Secondary
- **Go Green** (#2E7D32) on **Go Green Soft** (#E3F1E4): a phrase used, a scene finished, a confirmed place.
- **Amber** (#A04A00) on **Amber Soft** (#FBEEDC): notices about the partner, the cap and the network; a place reported by one visitor; mic coaching.
- **Stop Red** (#B3261E) on **Stop Red Soft** (#F9E1DF): the crisis line and destructive buttons only.
- **Program Teal** (#0E7C86): a public program or a business listing on the map.

### Neutral
- **Counter** (#EEF1F4): the page ground.
- **Card** (#FFFFFF): every card, the composer field, the tab bar.
- **Card Shade** (#F3F5F8): a card's hover state, the tip box inside a reply, the help output.
- **Ink** (#1A1D21): text and the primary button.
- **Ink Soft** (#5B6470): glosses, labels, secondary controls, inactive tabs.
- **Rule** (#D7DCE2): hairlines between list rows and card sections, control borders.
- **Unverified Grey** (#9AA3AD): the dot for a place nobody has reported yet.

Dark scheme: the counter goes to #0F1316, cards to #1A2026, ink to #EEF1F4, ink soft to #A6B0BA, and both language colours lighten for text (#7FB3F2, #F28C9A) while their bands deepen (#2457A0, #A51A30) so white type stays legible on them.

### Named Rules
**The Band Rule.** Every card that stands for a language wears that language's colour as a band on its top edge. The band is the only place the language colour fills a region.

**The One Accent Rule.** Live states use the accent of the language being practiced and nothing else. Green, amber, stop red and teal appear only as the meaning they carry; never as decoration.

## Typography

**Display Font:** Archivo, semi-condensed (`font-stretch: 87.5%`), 600 (with system-ui)
**Body Font:** Archivo, 400 and 600 (with system-ui)

**Character:** one workhorse grotesk at two widths. The semi-condensed bold is the card's lettering: compact, legible at arm's length, with the slight tracking tightening (-0.01em) that keeps it from looking stretched. The regular width is for reading.

### Hierarchy
- **Display** (600, 28px, 1.15, semi-condensed): page titles.
- **Headline** (600, 20px, 1.25, semi-condensed): section headings, scene card titles, the partner's chat line, a place's name.
- **Spoken** (600, 18–24px, 1.3, semi-condensed): every line the learner will read aloud: the must-use phrases (18px), Go Card phrases (19px), the scripted partner line (22px), the line to show the staff (24px).
- **Body** (400, 16px, 1.5): prose, the learner's own bubble, controls.
- **Label** (400 or 600, 13–14px, 1.5): glosses in secondary ink, tags, the tab bar (11px on phones), Go Card field labels (13px, 600, secondary ink).

### Named Rules
**The Gloss Rule.** The learner's own language sits directly under the target-language line, in Label size and secondary ink, never beside it and never larger.

**The Lettering Rule.** Semi-condensed bold marks what is said aloud or what names a thing. Body prose, buttons and labels stay at full width; no uppercase labels anywhere.

## Layout

A single column of cards, 16px side gutters, capped at 720px; 1040px on laptops, where the scene page becomes two columns (a 320px sticky brief on the left, the conversation on the right) and the picker runs three cards across. Tablets get two cards across from 560px. Cards stack with 10px gaps; sections are separated by 22px above a heading and 8–10px below it. The tab bar is a top strip on laptops and a fixed white bar at the bottom on phones (60px plus the safe area), with the page padded so nothing hides under it. The composer sits in the flow until the first line is sent, then sticks to the bottom of the viewport with a hairline above it.

## Elevation & Depth

Flat. No shadows anywhere. Depth is tonal: a white card on the cool ground, a shaded panel (Card Shade) inside a card, a tinted bubble for the learner. Controls on a card carry a 1px Rule border so they stay visible; cards themselves carry none.

### Named Rules
**The No-Shadow Rule.** A card is known by its edge against the counter. Never add a shadow, a glow or a card border to make one stand out; use the band or the accent tint.

## Shapes

Cards, bubbles and the composer field are 12px-rounded rectangles; controls and inputs 8px; filter chips, header chips and the mic are full pills. The band is square-cornered inside the card's rounded top. The mark is a laminated card tilted eight degrees with its band. The kid-mode storefront keeps a striped awning across its top edge in the accent.

## Components

### Buttons
- **Shape:** 8px corners, 44px minimum height; the mic is a 52px pill.
- **Primary:** Ink on Counter text (#1A1D21 / #EEF1F4), 10px 18px padding, 600 weight; the darkest print on the card. Hover shifts to Ink Soft.
- **Secondary / ghost:** white with a 1px Rule border, Ink text; hover darkens the border to Ink Soft.
- **Mic ("Tap, then speak"):** white pill with a 2px accent border and accent text; while listening it fills with the accent band colour and white text.
- **Disabled:** 45% opacity. **Danger:** Stop Red on Stop Red Soft, no border.

### Chips
- **Style:** white pill, 36px, secondary ink, no border (filters); header chips the same with an icon.
- **State:** selected is accent on accent soft (`button.on`).

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Card; Card Shade on hover for tappable cards.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none.
- **Band:** 32px on scene cards, 12px on the language-pick cards, a full header on the Go Card and the place card, the timer on Table mode.
- **Internal Padding:** 12px 14px 14px (scene card body), 16–18px (Go Card, place card).

### Inputs / Fields
- **Style:** white, 1px Rule border, 8px corners, 16px type, 10px 12px padding; the chat composer is borderless at rest with 12px corners.
- **Focus:** 2px accent outline flush with the border, the border itself turning accent.
- **Placeholder:** Ink Soft at full opacity.

### Navigation
- **Laptop:** a row of icon-and-label tabs under the header, secondary ink, the active tab in the accent with a 2px underline.
- **Phone:** a fixed white bar at the bottom with five icon-over-label tabs (22px icons, 11px labels); the active tab is in the accent with a short 3px accent bar on the top edge.
- **Header:** the mark and the name on the left; the language chip and the About chip on the right.

### The Band (signature)
A horizontal field in the language colour on a card's top edge: 32px with the place's line icon on a scene card; 12px on the language-pick cards; a titled header on the Go Card and the place card; the timer field in Table mode, red for a Spanish phase and blue for an English one. The band is how a learner tells which language a card is for before reading a word.

### Icons
Drawn in `src/ui/Icon.tsx`: 24-unit grid, 1.75 stroke, round caps and joins, `currentColor`. One icon per place type plus the tab, speaker, mic, stop (filled), check, back, globe, phone, lock, clock and swap glyphs.

## Do's and Don'ts

### Do:
- **Do** give every language-specific card its band, and let the accent follow `data-learning` on the shell.
- **Do** set anything read aloud in semi-condensed 600 at 18px or more, with its gloss under it at 14px in Ink Soft.
- **Do** keep controls standard: buttons, tabs, inputs, selects, with 44px targets and a visible accent focus ring.
- **Do** keep state colours to their meaning: green for done or confirmed, amber for a notice or a single report, stop red for crisis and destruction, teal for a listed program.
- **Do** respect `prefers-reduced-motion` (all transitions off) and both colour schemes.

### Don't:
- **Don't** add shadows, card borders or gradients; a card is flat on the counter.
- **Don't** use emoji as interface icons; they belong only to kid-mode scene pictures.
- **Don't** set labels in uppercase or add a label above a heading that already names its content.
- **Don't** fetch a font or an image at runtime; Archivo ships in `public/fonts` and is precached.
- **Don't** let any treatment from kid mode (awnings, stickers, pictures) into the adult app.
