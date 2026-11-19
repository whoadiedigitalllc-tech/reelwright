# Components

Dark, dense editor UI. Icons: Lucide (MIT, `lucide-react`). Font: Inter (OFL), falling back to Segoe UI.
No Tailwind: components use the CSS variables in `tokens.css` (`var(--c-surface)`), never raw hex.
Global focus style: `:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px }`.

```
Button
  variants  primary (accent bg, on-accent text), secondary (surface-2 bg), ghost (transparent), icon (28px square)
  sizes     sm 28px, md 32px
  states    default, hover (+6% lightness), active, focus-visible ring, disabled (50% opacity, no pointer), loading (spinner, label kept)
  tokens    radius md, fs-base / 600
  a11y      real <button>; icon buttons get aria-label + title (tooltip shows shortcut)
  used on   all

TabRail (left panel tabs)
  variants  vertical icon + label
  states    default, hover, active (accent text + 2px left bar), focus-visible
  a11y      role=tablist / tab / tabpanel, arrow keys move between tabs
  used on   S02 (Media, Text, Transitions)

AssetTile
  variants  video, image, audio, text preset, transition
  content   thumb (16:9, cover), name (1 line, ellipsis), duration badge (mono, xs)
  states    default, hover (border accent, "+" add button), dragging (50% opacity), offline (danger border, "Missing" badge), error
  a11y      button; Enter adds at playhead (keyboard alternative to drag)
  used on   S03, S04, S05

ProjectCard
  content   thumb, name, "Edited <relative date>", duration
  states    default, hover (show menu button), menu open (Rename, Delete), renaming (inline input)
  a11y      Enter opens; menu is a real menu (role=menu), Delete confirms in Modal
  used on   S01

NumberSlider (slider + number input pair)
  states    default, focus, dragging, disabled
  a11y      <input type=range> + <input type=number> share a <label>; arrow keys step, shift = x10
  used on   S07

ColorInput
  native <input type=color> + hex text input; invalid hex shows danger border and keeps last valid value
  used on   S07

Select
  native <select> styled; used for aspect ratio, resolution, fps
  used on   S06, S09

TimelineClip
  variants  video (clip-video, filmstrip thumb), audio (clip-audio), text (clip-text, shows text), image
  states    default, hover (trim handles visible), selected (2px accent border), trimming, dragging, offline (striped danger)
  a11y      focusable; arrow keys nudge 1 frame, shift+arrow 1s; Delete removes
  used on   S08

Playhead
  1px playhead colour line + handle in the ruler; drag to scrub; click ruler to seek
  used on   S08 (and drives S06)

Modal
  states    open, busy (actions disabled)
  a11y      <dialog> with showModal(): focus trap + Esc for free; focus returns to the opener
  used on   S09 export, delete confirm

Toast
  variants  info, error
  bottom-right, auto-hide 4s (errors stay until dismissed), role=status / role=alert
  used on   import errors, export done, autosave failure

ProgressBar
  <progress> element, accent fill, label with percent
  used on   S03 import, S09 export
```

Empty states (copy written fresh):
- S01: "No projects yet. Start one to begin editing." + New project button
- S03: "Drop video, audio or images here, or click Import."
- S08: "Drag clips from Media to start your timeline."
- S07: "Select a clip to edit it."
