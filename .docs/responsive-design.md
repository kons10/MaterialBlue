# MaterialBlue Responsive Design Roadmap

## Purpose
This is the source of truth for migrating MaterialBlue from a desktop-first single-breakpoint UI to a maintainable responsive architecture.

## Target philosophy
Responsiveness must be a system, not a pile of emergency media queries. Layout adapts intentionally; components remain valid at different available widths; interaction state is separate from viewport state; long text, URLs, media, and translations must never cause page-wide overflow.

## Target size classes
### Compact — below 600px
Single-column layout, overlay drawer navigation, compact padding, and safe operation down to approximately 320px.

### Medium — 600px to below 1200px
Adaptive tablet/narrow-desktop layout with compact navigation patterns. Do not allow a full sidebar to starve content.

### Expanded — 1200px and above
Persistent full sidebar, expanded spacing, and constrained readable content width.

## Phase 1 — Foundation
**Status: Implemented**

- Externalize static CSS from the base layout.
- Add shared responsive design tokens.
- Replace static inline presentation styles in the base layout with semantic classes.
- Add mandatory responsive rules to AGENTS.md.
- Establish this roadmap.

Files:
- `static/css/tokens.css`
- `static/css/app.css`
- `AGENTS.md`
- `.docs/responsive-design.md`

Phase 1 preserves current visual behavior. Structural adaptation is deferred.

## Phase 2 — Application shell and navigation
- Convert the shell to Compact / Medium / Expanded.
- Separate viewport layout behavior from sidebar interaction state.
- Replace shared sidebar-collapsed state with explicit compact drawer state.
- Use a real scrim element instead of a body pseudo-element.
- Adopt 100dvh with fallback.
- Centralize z-index layers.

Acceptance: resizing never leaves navigation invalid; CSS owns viewport layout; dialogs, drawers, and scrims stack predictably.

## Phase 3 — Component adaptation
Targets: settings items, action rows, post headers, notification items, media grids, composer controls, and login/account controls.

Rules: semantic component classes; stack controls when horizontal competition is excessive; `min-width: 0` for shrinkable text; safe wrapping for URLs and unbreakable user content; Container Queries when component width is the real trigger.

Acceptance: translated strings, long names, handles, URLs, and media do not break layout.

## Phase 4 — Robustness hardening
- Audit width/min-width/max-width.
- Replace unjustified fixed widths with fluid constraints.
- Audit flex/grid shrink behavior.
- Audit image/video sizing.
- Audit embeds and plugin-provided UI.
- Audit touch targets, reduced motion, keyboard navigation, and horizontal overflow.

### Test matrix
| Width | Focus |
|---|---|
| 320px | Extreme compact safety |
| 360px | Small phone |
| 600px | Compact/Medium transition |
| 768px | Tablet |
| 900px | Legacy breakpoint regression |
| 1200px | Medium/Expanded transition |
| 1440px | Wide desktop readability |

Test long localized strings, long names, handles, URLs, 1–4 media items, embeds, notifications, settings controls, and navigation states.

## Phase 5 — Enforcement
Recommended: code-review checklist based on AGENTS.md; optional checks flagging newly introduced inline styles; visual/manual regression checks at documented widths; responsive review before merging every new component.

## Definition of done
A responsive change is complete only when it works in all applicable layout modes, introduces no unintended horizontal overflow, keeps interaction state valid after resizing, safely handles localized and user-generated long text, preserves accessibility, and does not require unrelated compensating CSS patches.

## Anti-patterns
Do not add random media queries for isolated symptoms, use `overflow-x: hidden` to conceal overflow, keep presentation-critical values inline, duplicate breakpoint logic between CSS and JavaScript, add arbitrary `z-index: 9999` values, assume components always have desktop-width space, or force fixed-width controls into narrow rows.

## Future CSS organization
As ownership grows, split deliberately: `tokens.css`, `base.css`, `layout.css`, `components.css`, and `responsive.css`. Do not split files merely for aesthetics; split when maintainability improves.