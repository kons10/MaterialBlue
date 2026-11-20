# mb-post Integration Guide

## Overview

The `mb-post` Web Component has been implemented at `static/src/components/mb-post.js`. It's a self-contained post renderer that accepts a Bluesky PostView object and renders it with full Material Design 3 styling.

## Features Implemented

### Core Rendering
- ✅ Author avatar, display name, handle
- ✅ Post text content with proper wrapping
- ✅ Reply thread context (root/parent posts)
- ✅ Image embeds (multiple images in responsive grid)
- ✅ Video embeds (placeholder)
- ✅ External link cards (with thumbnail, title, description)
- ✅ Record embeds (quote posts)
- ✅ Record with media embeds
- ✅ Repost indicator ("Reposted by X")

### Actions
- ✅ Reply button with prompt
- ✅ Repost button with dropdown menu (Repost / Quote)
- ✅ Like button with count
- ✅ Bookmark/Save button
- ✅ Share button (Web Share API + clipboard fallback)

### Accessibility
- ✅ Semantic HTML structure (`<article>`, `<time>`, proper headings)
- ✅ ARIA labels on all action buttons
- ✅ `aria-pressed` state for toggle buttons
- ✅ Proper focus management
- ✅ Keyboard accessible

### Internationalization
- ✅ All UI strings use `t()` translation function
- ✅ Translation keys added to both `ja.json` and `en.json`
- ✅ Relative time formatting via `formatRelativeTime()`
- ✅ Compact number formatting via `formatCompactNumber()`

### Responsive Design
- ✅ Container queries for component-level responsiveness
- ✅ Media query fallbacks for older browsers
- ✅ Fluid image sizing
- ✅ Action button adaptation at narrow widths
- ✅ Text truncation and wrapping for long content
- ✅ Minimum touch targets (48px)

### Architecture Compliance
- ✅ Light DOM (no Shadow DOM) for compatibility with userscripts, Stylus, extensions, themes
- ✅ Uses Material Design 3 design tokens (`var(--md-sys-color-*)`, `var(--catalog-shape-*)`)
- ✅ Follows MaterialBlue coding conventions
- ✅ No external dependencies beyond existing project deps

## Usage

```javascript
import '/src/components/mb-post.js';

// Create and configure
const postEl = document.createElement('mb-post');
postEl.post = postView;  // Bluesky PostView object
postEl.client = bskyClient;  // Optional: for action buttons (like, repost, etc.)
container.appendChild(postEl);
```

### Required PostView Properties

```typescript
interface PostView {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    $type: string;
    text: string;
    createdAt: string;
    reply?: { root: Ref; parent: Ref };
    embed?: Embed;
    facets?: Facet[];
  };
  embed?: Embed;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt: string;
  viewer?: {
    like?: string;      // Like record URI
    repost?: string;    // Repost record URI
  };
  reason?: ReasonRepost;  // For reposts in timeline
}
```

### Client Interface

The `client` property expects an object with these methods:

```typescript
interface BskyClient {
  isLoggedIn: boolean;
  isSaved(uri: string): boolean;
  like(uri: string, cid: string): Promise<{ uri: string }>;
  unlike(uri: string): Promise<void>;
  repost(uri: string, cid: string): Promise<{ uri: string }>;
  unrepost(uri: string): Promise<void>;
  quote(uri: string, cid: string, text: string): Promise<{ uri: string }>;
  reply(uri: string, cid: string, text: string, replyContext?: object): Promise<{ uri: string }>;
  save(uri: string, cid: string): Promise<{ uri: string; saved: boolean }>;
  unsave(uri: string, cid: string): Promise<{ uri: string; saved: boolean }>;
}
```

## Integration with main.js

To replace the current `md-list-item` based timeline rendering with `mb-post`:

### 1. Import the component

Add to the top of `main.js`:
```javascript
import '/src/components/mb-post.js';
```

### 2. Update `loadTimeline()` function

Replace the `feed.forEach()` block that creates `md-list-item` elements with:

```javascript
feed.forEach(item => {
  const post = item.post;
  if (!post?.uri || existingPostUris.has(post.uri)) return;
  existingPostUris.add(post.uri);
  
  const postEl = document.createElement('mb-post');
  postEl.post = post;
  postEl.client = client;  // Enable action buttons
  
  // Handle repost indicator
  const reason = item.reason;
  const isRepost = reason?.$type === 'app.bsky.feed.defs#reasonRepost';
  if (isRepost) {
    postEl.post.reason = reason;  // The component handles this
  }
  
  fragment.appendChild(postEl);
  
  // Add divider between posts
  const divider = document.createElement('md-divider');
  fragment.appendChild(divider);
});
```

### 3. Update timeline container

Change the timeline container from `md-list` to a regular `div`:

```html
<!-- In timeline-card.html -->
<div id="timeline" class="timeline-list"></div>
```

### 4. Add CSS for timeline spacing

```css
/* In components-responsive.css */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.timeline-list > mb-post {
  flex-shrink: 0;
}

.timeline-list > md-divider {
  margin: 0;
}
```

### 5. Handle events from mb-post

Listen for custom events dispatched by the component:

```javascript
document.addEventListener('mb-post:like', (e) => {
  const { postUri, liked } = e.detail;
  // Update local state or refresh timeline
});

document.addEventListener('mb-post:repost', (e) => {
  const { postUri, reposted } = e.detail;
});

document.addEventListener('mb-post:reply', (e) => {
  const { postUri } = e.detail;
});

document.addEventListener('mb-post:save', (e) => {
  const { postUri, saved } = e.detail;
});

document.addEventListener('mb-post:quote', (e) => {
  const { postUri } = e.detail;
});
```

## Testing

A test file has been created at `test-mb-post.html` that demonstrates the component with various post types:
- Simple text post
- Post with multiple images
- Reply post with thread context
- Quote post (record embed)
- External link embed
- Repost

To test, serve the Hugo site and open `test-mb-post.html`.

## Files Modified/Created

### New Files
- `static/src/components/mb-post.js` - Main component
- `test-mb-post.html` - Test page

### Modified Files
- `static/locales/ja.json` - Added Japanese translations
- `static/locales/en.json` - Added English translations
- `static/css/components-responsive.css` - Added responsive styles for mb-post

## Next Steps (MaterialBlue 2.0 Roadmap)

1. **mb-embed** - Extract embed rendering logic into separate component
2. **mb-actions** - Extract action buttons into separate component
3. **mb-notification** - Notification component that composes mb-post
4. **Plugin API** - Hook system for extensibility
5. **Core modules** - Split main.js into api.js, state.js, router.js, plugin.js

## Notes

- The component uses Light DOM intentionally (no Shadow DOM) per MaterialBlue architecture decision
- All styles use CSS custom properties from Material Design 3 token system
- Container queries are used for component-level responsiveness with media query fallbacks
- The component is designed to be framework-agnostic and works with vanilla JS