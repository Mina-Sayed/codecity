---
version: alpha
name: "CodeCity"
description: "A technical field atlas for seeing a codebase as a living, navigable city."
colors:
  ink: "#0B1218"
  canvas: "#10232D"
  surface: "#172A34"
  surface-raised: "#213943"
  primary: "#8FF1D0"
  secondary: "#8AC7FF"
  text: "#F2F7F3"
  muted: "#A6B9BB"
  line: "#38515A"
  warning: "#F6C76A"
  danger: "#FF8275"
  info: "#8AC7FF"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.75rem"
    lineHeight: "0.94"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.5"
  utility:
    fontFamily: "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace"
    fontSize: "0.75rem"
    lineHeight: "1.35"
rounded:
  DEFAULT: "0.5rem"
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.875rem"
spacing:
  panel: "1rem"
  section-gap: "2rem"
  page-max: "90rem"
components:
  button:
    backgroundColor: "#8FF1D0"
    textColor: "#0B1218"
    rounded: "0.5rem"
    height: "2.75rem"
  card:
    backgroundColor: "#172A34"
    rounded: "0.875rem"
    padding: "1rem"
  input:
    backgroundColor: "#0B1218"
    textColor: "#F2F7F3"
    rounded: "0.5rem"
    height: "3rem"
---

# CodeCity Design System

## Overview

### Creative North Star

CodeCity is a technical field atlas: the quiet confidence of an observatory control room, the layered information of a nautical chart, and the tactile clarity of a well-made developer tool. The product should feel like a place an engineer can work for an hour, not a game splash screen or an anonymous SaaS dashboard.

### Product context and register

- **Audience and primary job:** Engineers and technical leads paste a public JavaScript/TypeScript GitHub repository and quickly understand structure, dependencies, and engineering hotspots.
- **Target market(s) and evidence:** Global developer tooling; the repository README defines the product as an interactive architectural model for JS/TS repositories.
- **Locale(s) and language policy:** English UI and code identifiers in V1; copy stays plain, sentence-case, and technical without hype.
- **Usage scene:** Desktop-first deep work, with a compact but usable narrow viewport for quick exploration. The 3D city is the main work surface; panels support orientation and inspection.
- **Register:** Hybrid: a restrained, expressive landing surface and a dense product workbench.
- **Memorable signature:** A luminous “survey line” motif: mint/blue dependency lines crossing a deep blue-green city field, paired with small atlas-style coordinate labels.
- **Restraint:** The workbench never becomes a black void, neon arcade, or dashboard full of decorative cards. Data hierarchy comes from tonal layers, spacing, and clear labels.
- **Anti-references:** Generic black-and-acid-green AI dashboards, gaming HUDs, glassmorphism-heavy SaaS, and terminal-only interfaces that make the product feel inaccessible to non-specialist collaborators.
- **Token ownership/runtime mapping:** Runtime CSS variables in `apps/web/app/globals.css` remain canonical for V1; this file mirrors those semantic roles. Changes to durable palette/type values update both files, with `audit_project.py` and browser screenshots as drift evidence.

## Colors

The base is ink/navy rather than pure black so the 3D canvas and panels retain readable separation. `surface` and `surface-raised` create two workbench layers; `line` carries structure without becoming a grid. Mint is the primary action and selected state, blue is structural/informational, amber marks caution/findings, and coral is reserved for errors. Text is near-white with a cool muted role for metadata. The same roles must remain distinct in forced-colors mode.

## Typography

Inter carries product prose and headings for neutral, compact readability. IBM Plex Mono (with platform fallbacks) carries repository paths, counts, labels, and analysis stages so technical data has a consistent instrument-panel voice. Display headings use tight line-height only on the landing surface; workbench labels stay small but never below readable contrast or target size. Do not rely on uppercase alone to communicate meaning.

## Layout

The workbench is a three-zone instrument: explorer, city, inspector, with a stable top bar and status rail. Panels own their scroll; the city owns the viewport. Desktop uses a 260 / fluid / 310 grid, tablet collapses the inspector below the city, and narrow screens stack explorer, city, and inspector with a bounded explorer. The landing surface uses a wide split between an honest product thesis and the repository action. Controls keep stable geometry between idle, loading, error, and success.

## Elevation & Depth

Hierarchy comes from tonal surfaces and thin borders rather than large shadows. The city canvas is the deepest layer; controls sit on raised slate surfaces with a restrained shadow only where a popover needs separation. Avoid black-on-black panels and avoid blur that reduces code readability.

## Shapes

Controls and panels use small, deliberate radii: 6px for compact utility surfaces, 8px for controls, and 10–14px for larger cards. Dividers are one-pixel lines. Buttons are rectangular with a softened corner, never pills unless a compact status badge requires it.

## Components

### Foundational visual states

Interactive controls use a clear surface shift on hover, a two-layer mint/blue focus ring on keyboard focus, a pressed inset tone, and a stable disabled/busy geometry. Loading uses a named stage and animated survey dot; reduced motion removes the pulse while keeping the stage visible. Errors use coral plus explanatory text and recovery.

### Buttons and actions

The primary action is a mint solid button with dark text. Neutral actions use outlined slate controls. Cancel and utility actions stay ghost/outline. Busy labels preserve the button width. Destructive actions are not part of the current V1 flow.

### Navigation and data display

The explorer is a scrollable semantic navigation list with visible current selection. Findings are an ordered list of buttons with severity text and labels, not color alone. The city HUD is an always-visible orientation aid with district count and selected path.

### Forms and overlays

The repository form owns validation and uses an inline alert region. Search has a visible clear action when populated. No browser-native dialogs are used. Popovers must stay within the viewport and retain keyboard access.

### Iconography

V1 uses text labels and simple geometric marks; no icon font is required. Any future icon-only control needs an accessible name and a tooltip policy before shipping.

### Motion

Motion is a survey transition: a short city reveal, camera focus only after an explicit selection, and a subtle progress pulse during analysis. It never delays a task, and `prefers-reduced-motion` disables ornamental movement.

### Content and data visualization

Copy uses direct verbs: “Build my city,” “Analyze another repo,” “Cancel,” and “Find file or path.” Counts remain visible as text. Dependency lines use mint/blue structural contrast; findings use severity labels plus amber/coral treatment. The product never claims analysis success before the streamed result arrives.

## Do's and Don'ts

- **Do:** Make the first successful frame read as a city overview with visible depth, roads, and orientation.
- **Do:** Use the same semantic color role for selection, progress, and primary action across landing and workbench.
- **Don't:** Use pure black panels, low-contrast gray labels, or neon accents as the only information channel.
- **Don't:** Zoom into a file or hide the city before the user makes an explicit selection.
