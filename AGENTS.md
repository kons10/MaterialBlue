# AGENTS.md

## MaterialBlue — AI Agent Instructions

MaterialBlue is a static Bluesky client focused on simplicity, visual consistency, maintainability, and a self-contained user experience.

This document defines the rules and design principles that AI coding agents must follow when modifying this repository.

**Treat this document as the project's engineering constitution.**

---

### 1. Core Philosophy

MaterialBlue follows these principles, in priority order:

1. **Preserve the existing architecture before introducing new architecture.**
2. **Prefer simplicity over abstraction.**
3. **Prefer Web Platform APIs over unnecessary dependencies.**
4. **Keep the application static whenever possible.**
5. **Use Material Design 3 / Material You consistently.**
6. **Treat internationalization (i18n) as a first-class feature.**
7. **Keep Bluesky / AT Protocol concepts separate from UI implementation.**
8. **Avoid unnecessary build tooling.**
9. **Do not rewrite working code merely because another architecture is preferred.**
10. **Optimize for long-term maintainability, not short-term code generation convenience.**

AI agents must adapt to MaterialBlue's architecture.

Do **not** attempt to turn MaterialBlue into a framework-heavy application simply because that architecture is familiar.

---

### 2. Technology Stack

The project currently uses:

- Hugo
- HTML
- CSS
- JavaScript
- Material Web (`@material/web`)
- AT Protocol / Bluesky APIs
- Web Platform APIs
- Google Fonts / Material Symbols

Hugo is the static site generator.

The project is intentionally **not** a conventional Node.js application.

---

### 3. Build System

#### MUST

Use Hugo as the primary build system.

The normal development command is:

```bash
hugo server
```

The production build is:

```bash
hugo
```

The generated site is placed in:

```text
public/
```

#### MUST NOT

Do not introduce:

- Next.js
- React
- Vue
- Angular
- Svelte
- Astro
- unnecessary bundlers
- unnecessary npm-based application frameworks

unless explicitly requested by the project maintainer.

Do not replace Hugo with another static-site generator.

Do not add a package manager solely because an AI agent prefers one.

---

### 4. Dependency Policy

Dependencies are expensive.

Before adding a dependency, ask:

> Can this be implemented cleanly using an existing dependency or a standard Web API?

Prefer:

```text
Web Platform API
        ↓
existing project code
        ↓
existing dependency
        ↓
new dependency
```

in that order.

#### MUST NOT

Do not add an external library merely to perform trivial tasks such as:

- date formatting
- number formatting
- DOM manipulation
- simple state management
- simple event handling
- simple URL parsing
- simple string manipulation
- basic localization

Use standard APIs such as:

- `Intl`
- `URL`
- `URLSearchParams`
- `fetch`
- DOM APIs
- Web Components APIs
- browser storage APIs

where appropriate.

---

### 5. Material Design / Material You

MaterialBlue is a Material Design 3 application.

Visual consistency is an architectural concern, not merely a styling preference.

Use Material Web components where an appropriate component exists.

Prefer Material Design 3 concepts such as:

- color roles
- typography roles
- shape
- elevation
- state layers
- responsive layouts
- accessible interaction states

Do not create arbitrary UI patterns when an existing Material Design pattern already solves the problem.

#### Typography

MaterialBlue uses Google Sans / Roboto and Material typography concepts.

Do not introduce unrelated typography systems without a specific reason.

#### Icons

Prefer Material Symbols where appropriate.

Do not replace existing Material Symbols with arbitrary icon libraries.

---

### 6. Styling

Use the existing Material Design system variables and tokens whenever possible.

For example:

```css
var(--md-sys-color-primary)
var(--md-sys-color-surface)
var(--md-sys-color-on-surface)
```

Do not scatter unrelated hard-coded colors throughout the application.

If a new color is necessary, determine whether it should instead be represented as a semantic design token.

Avoid introducing large amounts of CSS duplication.

---

### 7. Internationalization

Internationalization is a core architectural requirement.

The project uses two i18n layers:

#### Hugo i18n

For:

- static content
- Hugo templates
- page titles
- static navigation
- build-time strings

#### JavaScript i18n

For:

- dynamic UI
- dialogs
- snackbars
- tooltips
- dynamic buttons
- API-dependent messages
- loading states
- accessibility labels

Translation data must remain separate from application logic.

---

### 8. Translation Rules

Never hard-code user-facing UI text directly into JavaScript when the text is intended to be localized.

Prefer:

```js
t("common.save")
```

over:

```js
"Save"
```

Translation keys should represent **meaning or purpose**, not the literal displayed text.

Prefer:

```text
settings.language
post.delete
errors.network
accessibility.home
```

over:

```text
save_button
delete_button_english
japanese_cancel
```

Do not duplicate the entire application for each language.

Do not create language-specific branches such as:

```js
if (locale === "ja") {
    ...
}
```

for ordinary translation purposes.

---

### 9. Locale Handling

Locale selection should follow this general priority:

1. Explicit user preference
2. Persisted user preference
3. `navigator.languages`
4. `navigator.language`
5. Default locale

The default locale is currently:

```text
ja
```

Locale fallback must be supported.

For example:

```text
en-US
 ↓
en
 ↓
ja
```

Translation data should be loaded only when needed and should be cached.

Use the Web Platform's `Intl` APIs for locale-aware formatting.

For example:

```js
new Intl.DateTimeFormat(locale)
new Intl.NumberFormat(locale)
```

Do not manually implement locale-specific date or number formatting.

---

### 10. User-Generated Content

Never treat Bluesky user content as application UI text.

The following must **not** be passed through the application's UI translation system:

- post text
- display names
- handles
- profile descriptions
- user-provided text
- external content
- API-provided user-generated content

Likewise, never automatically translate:

- DID
- handle
- URI
- URL
- API identifiers
- code
- user input

Application UI and user-generated content must remain clearly separated.

---

### 11. AT Protocol / Bluesky

Bluesky and AT Protocol concepts must remain technically accurate.

Do not casually rename protocol concepts merely to make them appear simpler.

Preserve distinctions between concepts such as:

- handle
- DID
- PDS
- session
- access token
- refresh token
- URI
- CID
- record
- repository

When changing API-related code, verify how the underlying AT Protocol API actually behaves before modifying abstractions.

Do not invent API fields or endpoints.

---

### 12. Authentication and Privacy

Authentication-related code is security-sensitive.

Never log:

- app passwords
- access tokens
- refresh tokens
- session credentials
- other authentication secrets

Do not send credentials to services unrelated to authentication.

Do not introduce analytics or tracking without explicit project requirements.

Do not add telemetry merely because a library provides it.

---

### 13. Static Architecture

MaterialBlue is designed to work as a static site.

Do not introduce a server-side dependency unless explicitly required.

The application should remain deployable to static hosting services such as:

- GitHub Pages
- Cloudflare Pages
- Netlify
- equivalent static hosts

Avoid assumptions that a custom backend is available.

---

### 14. External Resources

External resources must be considered carefully.

Before adding a CDN or external service, ask:

1. Is it actually necessary?
2. Can the resource be bundled or served locally?
3. Does the dependency introduce an unnecessary runtime failure point?
4. Does it conflict with the project's self-contained architecture?

Do not add random CDNs.

Do not add tracking scripts.

Do not add third-party services merely for convenience.

Existing external dependencies must not be removed blindly; understand why they are currently used first.

---

### 15. `@material/web`

Material Web is a core UI dependency.

Do not replace it with another component framework simply because another framework is more familiar.

When modifying Material Web integration:

- check the currently used API
- preserve Web Components behavior
- avoid unnecessary polyfills
- avoid importing unnecessary components
- consider browser compatibility
- avoid breaking Shadow DOM behavior

Do not blindly upgrade `@material/web` to `latest`.

A dependency upgrade must be intentional and tested.

---

### 16. Browser Compatibility

MaterialBlue is a browser application.

Prefer standards-based browser APIs.

Do not add compatibility workarounds without understanding the browser behavior that requires them.

If a browser limitation requires a polyfill, document why it exists.

Do not remove an existing compatibility layer without verifying that it is no longer necessary.

---

### 17. Accessibility

Accessibility is part of correctness.

Interactive elements must remain keyboard accessible.

Use semantic HTML where appropriate.

Accessibility-related strings must also be localized.

This includes:

- `aria-label`
- `aria-description`
- `title`
- tooltip text
- dialog labels
- snackbar messages
- screen-reader-only text

Do not sacrifice accessibility for visual appearance.

---

### 18. Responsive Design

MaterialBlue must work across:

- desktop
- tablet
- mobile

Do not implement layouts that only work at the development viewport size.

When modifying layout:

- test narrow widths
- test wide widths
- consider long text
- consider localization
- consider user-generated content
- avoid unnecessary fixed dimensions

---

### 19. Performance

Prefer simple, efficient browser-side code.

Avoid:

- unnecessary DOM recreation
- unnecessary network requests
- repeated API requests
- loading every locale at startup
- loading unused libraries
- unnecessary timers
- unnecessary event listeners

Cache data when appropriate.

Do not optimize prematurely at the expense of maintainability.

---

### 20. Existing Code

Before changing an existing subsystem:

1. Read the relevant code.
2. Identify its current responsibility.
3. Identify dependencies on it.
4. Understand why it is structured that way.
5. Make the smallest reasonable change.

Do not perform unrelated refactors during feature work.

A request such as:

> "Fix the post button"

does not authorize:

> "Rewrite the entire application architecture."

---

### 21. AI Agent Behavior

AI agents must distinguish between:

#### Safe autonomous changes

Generally acceptable:

- fixing an obvious bug
- correcting a typo
- improving accessibility
- fixing broken responsive behavior
- adding a small localized UI string
- correcting an obvious CSS issue
- updating documentation related to the change

#### Changes requiring extra caution

Be cautious before:

- adding dependencies
- changing build tooling
- changing authentication
- changing API abstractions
- restructuring directories
- changing the i18n architecture
- replacing Material Web
- changing deployment assumptions
- changing persistent storage
- changing session behavior

#### Changes requiring explicit approval

Do not perform these merely as part of an unrelated task:

- framework migration
- build-system migration
- complete architecture rewrite
- replacing Hugo
- replacing Material Web
- introducing a backend
- introducing analytics/tracking
- removing major existing dependencies
- changing authentication architecture

---

### 22. Do Not Optimize for AI Convenience

The architecture must serve the application, not the AI agent.

Do not introduce abstractions simply because they make generated code easier.

Do not create:

- unnecessary service layers
- unnecessary factories
- unnecessary repositories
- unnecessary managers
- unnecessary state frameworks
- unnecessary wrapper APIs

A small function is preferable to a five-layer abstraction when the problem is small.

---

### 23. Avoid Clever Code

Prefer readable code.

Bad:

```js
const x = a?.b?.c?.map?.(fn)?.filter?.(Boolean) ?? [];
```

when a clearer implementation would be easier to maintain.

Good code should be understandable by a human contributor who did not generate it.

---

### 24. Comments

Comments should explain **why**, not merely **what**.

Do not add comments such as:

```js
// Set the text content
element.textContent = text;
```

Prefer comments that explain architectural constraints:

```js
// Keep the locale loader separate from Hugo i18n because this UI
// is generated dynamically after the page has loaded.
```

Do not add excessive comments to obvious code.

---

### 25. Documentation

When an architectural decision is non-obvious, document it.

The `.docs/` directory contains project-specific technical documentation and implementation specifications.

Before implementing a feature covered by an existing document, read the relevant documentation first.

Documentation is part of the project's architecture.

Do not silently contradict an existing specification.

If implementation intentionally deviates from a specification, update the specification or clearly document the reason.

---

### 26. Validation

Before considering a change complete:

#### Build

Run:

```bash
hugo
```

and ensure the build succeeds.

#### Check

Verify:

- no obvious console errors
- no broken navigation
- no broken layout
- no broken localization
- no accidental credential exposure
- no unnecessary network requests
- no accessibility regression

For UI changes, test both desktop and mobile layouts when possible.

---

### 27. Git Hygiene

Keep changes focused.

A commit or pull request should not mix unrelated changes.

Avoid:

- mass formatting unrelated files
- renaming unrelated variables
- changing indentation across the entire project
- rewriting files unnecessarily
- dependency changes unrelated to the task

Small, reviewable changes are preferred.

---

### 28. Priority When Rules Conflict

When deciding between possible implementations, use this order:

1. User's explicit request
2. Security and privacy
3. Existing MaterialBlue architecture
4. This `AGENTS.md`
5. Existing project documentation
6. Material Design principles
7. Web standards
8. Simplicity and maintainability
9. Performance optimizations
10. AI agent convenience

When uncertain, preserve existing behavior rather than inventing new behavior.

---

### 29. Final Rule

**Do not make MaterialBlue more complicated than it needs to be.**

The ideal implementation is not the one with the most abstractions, dependencies, frameworks, or generated code.

The ideal implementation is the smallest design that:

- works correctly
- remains accessible
- remains localized
- follows Material Design
- respects AT Protocol
- preserves the static architecture
- remains maintainable by humans
- can be understood by future contributors

**Be static, and be beautiful.**

## Material Symbols / Icon Registry

MaterialBlue uses Material Symbols for icons.

The project maintains an **icon list / icon registry** that serves as the authoritative list of icons available to the application.

### MUST

When adding a new Material Symbol icon:

1. **First check the existing icon list / registry.**
2. If the icon already exists, reuse the existing entry.
3. If the icon does not exist, add it to the icon list / registry as part of the same change.
4. Ensure the icon name exactly matches the Material Symbols icon name.
5. Update all relevant references if the icon registry is used to generate or validate icon resources.

Adding an icon to application code without updating the icon list is considered an **incomplete implementation**.

### MUST NOT

Do not:

* invent a new icon name when an existing Material Symbol is appropriate
* duplicate an icon entry
* add an icon directly to UI code while ignoring the icon registry
* assume that adding the icon to HTML/JavaScript is sufficient
* remove existing icons from the registry merely because they are not currently visible in the UI

### Workflow

When an implementation requires a new icon:

```text
Feature requires icon
        ↓
Check icon list / registry
        ↓
Already registered?
   ┌────┴────┐
  YES       NO
   ↓         ↓
Reuse      Add icon
             ↓
       Implement feature
             ↓
       Verify icon usage
```

The icon registry is the **source of truth** for Material Symbols used by MaterialBlue.

When reviewing a change that introduces a new Material Symbol, verify both:

* the icon is correctly used by the UI
* the icon is present in the icon list / registry

A feature is not complete if only the first condition is satisfied.


## Responsive Design Rules (Mandatory)

- Mobile-first: start from the narrow layout and progressively enhance.
- Do not add static inline `style` attributes; use semantic classes.
- Use Compact (<600px), Medium (600–1199px), and Expanded (>=1200px).
- Do not add arbitrary one-off breakpoints to patch isolated symptoms.
- Prefer fluid sizing primitives: `min()`, `max()`, `clamp()`, `minmax()`, Flexbox, and Grid.
- Shrinkable text containers must consider `min-width: 0`; long user content must wrap safely.
- Images and videos must never exceed their containers.
- Do not hide overflow globally to conceal responsive bugs; fix the overflowing element.
- Keep viewport layout in CSS and interaction state in JavaScript.
- Keep responsive state separate from drawer/sidebar open state.
- Prefer Container Queries when component width matters more than viewport width.
- Use centralized z-index layers and shared design tokens.
- Prefer `100dvh` with sensible fallback for full-height mobile layouts.
- Test around 320px, 600px, 900px, and 1200px with long localized strings, handles, URLs, and media grids.
- No new UI may introduce unintended horizontal page scrolling.

The complete migration plan is documented in `.docs/responsive-design.md`.
