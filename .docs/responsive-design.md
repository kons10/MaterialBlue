# MaterialBlue Responsive Design Roadmap

## Status

- Phase 1 — Foundation: design-rule baseline.
- Phase 2 — Application Shell and Navigation: **implemented**.
- Phase 3 — Component Adaptation: pending.
- Phase 4 — Robustness Hardening: pending.
- Phase 5 — Enforcement: pending.

## Size classes

### Compact (<600px)
Single-column content with an off-canvas drawer. The drawer has a real scrim, click-to-dismiss behavior, and Escape-to-close behavior.

### Medium (600–1199px)
An 88px navigation rail keeps content fluid. Drawer interaction is disabled because navigation is persistent.

### Expanded (>=1200px)
A persistent 280px sidebar shows full navigation labels while content remains width-constrained.

## Phase 2 implementation

### Application shell
The shell is mobile-first: Compact starts as one content column, Medium adds a navigation rail, and Expanded upgrades to the full sidebar.

### State separation
CSS decides the viewport layout. JavaScript only controls `data-sidebar-open` for Compact drawer interaction. Crossing into Medium/Expanded clears drawer interaction state.

### Scrim and layering
The old body pseudo-element overlay is replaced by `.sidebar-scrim`. Layering is centralized with header, scrim, sidebar, and splash variables.

### Viewport height
Full-height regions use `100dvh` with `100vh` fallback.

### Accessibility
The menu trigger uses `aria-expanded` and `aria-controls`. The drawer supports scrim dismissal and Escape-to-close with focus returned to the trigger.

## Validation matrix

| Width | Focus |
|---|---|
| 320px | Narrow Compact safety |
| 600px | Compact → Medium transition |
| 900px | Tablet regression |
| 1200px | Medium → Expanded transition |
| 1440px | Wide desktop readability |

## Phase 3 next

Adapt settings rows, composer action rows, post headers, notification cards, media grids, and account controls. Use semantic component classes, stacking where horizontal competition is excessive, safe text wrapping, and Container Queries where component width is the correct trigger.
