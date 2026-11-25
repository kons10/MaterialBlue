/**
 * mb-post - MaterialBlue Post Web Component
 * 
 * A self-contained post renderer that accepts a Bluesky PostView object
 * and renders it with full Material Design 3 styling.
 * 
 * Usage:
 *   const postEl = document.createElement('mb-post');
 *   postEl.post = postView;
 *   container.appendChild(postEl);
 * 
 * Note: Uses Light DOM (not Shadow DOM) for compatibility with userscripts,
 * Stylus, browser extensions, and theme customization.
 */

// Standalone renderer: all application services are injected by the host.
const fallbackT = (key, params = {}) => String(key).replace(/\{(\w+)\}/g, (m, k) => params[k] ?? m);
const fallbackRelativeTime = (value, t = fallbackT) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return t('datetime.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('datetime.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('datetime.hoursAgo', { count: hours });
  return t('datetime.daysAgo', { count: Math.floor(hours / 24) });
};
const fallbackCompactNumber = value => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value);

// Material Symbols used by this component
const ICONS = {
  account: 'account_circle',
  reply: 'reply',
  repost: 'repeat',
  repostFilled: 'repeat_on',
  like: 'favorite',
  likeFilled: 'favorite',
  bookmark: 'bookmark',
  bookmarkFilled: 'bookmark',
  quote: 'format_quote',
  share: 'share',
  more: 'more_vert',
  verified: 'verified',
  image: 'image',
  video: 'videocam',
  link: 'link',
  external: 'open_in_new',
  warning: 'warning',
  analytics: 'analytics',
  share: 'share',
  bookmark: 'bookmark',
  bookmarkFilled: 'bookmark',
};

/**
 * Format count for display (uses formatCompactNumber from i18n)
 */
function formatCount(count, formatter = fallbackCompactNumber) {
  if (count === null || count === undefined || count <= 0) return '';
  return formatter(count);
}

/**
 * Create an avatar element for an author
 */
function createAvatar(author) {
  const avatar = document.createElement('img');
  avatar.className = 'mb-post-avatar';
  avatar.alt = author?.displayName || author?.handle || '';
  avatar.loading = 'lazy';
  if (author?.avatar) {
    avatar.src = author.avatar;
  }
  avatar.addEventListener('error', () => avatar.removeAttribute('src'), { once: true });
  return avatar;
}

/**
 * Create author line with display name and handle
 */
function createAuthorLine(author, isRepost = false, t = fallbackT) {
  const authorLine = document.createElement('div');
  authorLine.className = 'mb-post-author-line';

  const displayName = document.createElement('span');
  displayName.className = 'mb-post-author-name md-typescale-body-large';
  displayName.textContent = author?.displayName || author?.handle || t('post.authorFallback');
  authorLine.appendChild(displayName);

  if (author?.handle) {
    const handle = document.createElement('span');
    handle.className = 'mb-post-author-handle md-typescale-body-small';
    handle.textContent = `@${author.handle}`;
    authorLine.appendChild(handle);
  }

  // Verified badge
  if (author?.did && author.did.startsWith('did:plc:')) {
    // Could add verification check here if needed
  }

  return authorLine;
}

/**
 * Create action button using @material/web components
 * Returns { btn, container, update }; labeled actions use md-text-button,
 * while bookmark/share use md-icon-button.
 */
function createActionButton(iconKey, labelKey, count, options = {}) {
  const iconOnly = Boolean(options.iconOnly);
  const toggle = Boolean(options.toggle);
  const selected = Boolean(options.filled);
  const label = (options.t || fallbackT)(labelKey);
  const btn = document.createElement(iconOnly ? 'md-icon-button' : 'md-text-button');
  btn.type = 'button';

  const icon = document.createElement('md-icon');
  if (!iconOnly) {
    btn.hasIcon = true;
    icon.slot = 'icon';
  }
  icon.textContent = ICONS[iconKey];
  btn.appendChild(icon);

  let selectedIcon = null;
  if (toggle) {
    btn.setAttribute('aria-pressed', String(selected));
    if (iconOnly) {
      btn.toggle = true;
      btn.selected = selected;
      selectedIcon = document.createElement('md-icon');
      selectedIcon.slot = 'selected';
      selectedIcon.className = 'is-filled';
      selectedIcon.textContent = ICONS[iconKey + 'Filled'];
      btn.appendChild(selectedIcon);
    }
  }

  if (iconOnly) {
    btn.setAttribute('aria-label', label);
    btn.classList.add('mb-post-action-icon-button');
  }

  const container = document.createElement('span');
  container.className = 'mb-post-action';
  
  container.appendChild(btn);

  let textNode = null;
  if (!iconOnly) {
    textNode = document.createTextNode('');
    btn.appendChild(textNode);
  }

  const update = (newSelected = selected, newCount = count) => {
    if (toggle) {
      const isSelected = Boolean(newSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
      if (iconOnly) {
        btn.selected = isSelected;
      } else {
        icon.textContent = isSelected ? ICONS[iconKey + 'Filled'] : ICONS[iconKey];
        icon.classList.toggle('is-filled', isSelected);
      }
    }
    const countText = formatCount(newCount, options.formatCompactNumber);
    if (iconOnly) {
      const accessibleLabel = countText ? label + ', ' + countText : label;
      btn.setAttribute('aria-label', accessibleLabel);
    } else if (textNode) {
      textNode.textContent = countText || label;
    }
  };

  update(selected, count);
  return { btn, container, update };
}

/**
 * Create reply thread context (parent/root posts)
 */
function createReplyThread(reply, t = fallbackT) {
  if (!reply) return null;

  const posts = [];
  const { root, parent } = reply;

  if (root?.uri && root.uri !== parent?.uri) {
    posts.push({ ...root, _isRoot: true });
  }
  if (parent?.uri) {
    posts.push({ ...parent, _isParent: true });
  }

  if (posts.length === 0) return null;

  const threadContainer = document.createElement('div');
  threadContainer.className = 'mb-post-reply-thread';

  posts.forEach((replyPost, index) => {
    const card = document.createElement('div');
    card.className = 'mb-post-reply-card';
    card.className = 'mb-post-reply-card';

    const author = createAuthorLine(replyPost.author, false);
    author.classList.add('mb-post-reply-author');
    if (replyPost._isRoot) {
      const badge = document.createElement('span');
      badge.className = 'mb-post-reply-badge md-typescale-label-small';
      badge.textContent = t('post.replyRoot');
      badge.dataset.kind = 'root';
      author.appendChild(badge);
    } else if (replyPost._isParent) {
      const badge = document.createElement('span');
      badge.className = 'mb-post-reply-badge md-typescale-label-small';
      badge.textContent = t('post.replyParent');
      badge.dataset.kind = 'parent';
      author.appendChild(badge);
    }

    const text = document.createElement('div');
    text.className = 'mb-post-reply-text md-typescale-body-small';
    
    text.textContent = replyPost.record?.text || '';

    card.appendChild(author);
    if (text.textContent) card.appendChild(text);
    threadContainer.appendChild(card);
  });

  return threadContainer;
}

/**
 * Create post text content with facets (links, mentions, tags)
 */
function createPostText(record) {
  if (!record?.text) return null;

  const textContainer = document.createElement('div');
  textContainer.className = 'mb-post-text md-typescale-body-large';
  
  textContainer.textContent = record.text;

  // TODO: Implement facet rendering (links, mentions, hashtags)
  // This would require parsing record.facets and creating appropriate links

  return textContainer;
}

/**
 * Create embed content (images, video, external, record, recordWithMedia)
 */
function createEmbed(embed, record, context = {}) {
  const t = context.translator || fallbackT;
  if (!embed) return null;

  const embedContainer = document.createElement('div');
  embedContainer.className = 'mb-post-embed';

  switch (embed.$type?.replace(/#view$/, '')) {
    case 'app.bsky.embed.images': {
      const images = embed.images || record?.embed?.images || [];
      if (images.length > 0) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'mb-post-images';

        images.forEach((img) => {
          const imgElement = document.createElement('img');
          imgElement.className = 'mb-post-image';
          imgElement.src = img.fullsize || img.thumbnail;
          imgElement.alt = img.alt || '';
          imgElement.loading = 'lazy';

          imgElement.addEventListener('click', () => {
            embedContainer.dispatchEvent(new CustomEvent('mb-post-open-url', { bubbles: true, composed: true, detail: { url: img.fullsize || img.thumbnail } }));
          });

          imageContainer.appendChild(imgElement);
        });

        embedContainer.appendChild(imageContainer);
      }
      break;
    }

    case 'app.bsky.embed.video': {
      // Video embed - placeholder for now
      const videoContainer = document.createElement('div');
      videoContainer.className = 'mb-post-video';

      videoContainer.innerHTML = `
        <md-icon class="mb-post-video-icon">${ICONS.video}</md-icon>
        <div class="md-typescale-body-medium mb-post-video-label">${t('post.videoEmbed')}</div>
      `;
      embedContainer.appendChild(videoContainer);
      break;
    }

    case 'app.bsky.embed.external': {
      const external = embed.external;
      if (external) {
        const card = document.createElement('div');
        card.className = 'mb-post-external-card';

        if (external.thumb) {
          const thumb = document.createElement('img');
          thumb.src = external.thumb;
          thumb.alt = '';
          thumb.loading = 'lazy';

          card.appendChild(thumb);
        }

        const content = document.createElement('div');

        if (external.title) {
          const title = document.createElement('div');
          title.className = 'md-typescale-title-medium';

          title.textContent = external.title;
          content.appendChild(title);
        }

        if (external.description) {
          const desc = document.createElement('div');
          desc.className = 'md-typescale-body-small';

          desc.textContent = external.description;
          content.appendChild(desc);
        }

        const uri = document.createElement('div');
        uri.className = 'md-typescale-label-small';

        uri.textContent = external.uri;
        content.appendChild(uri);

        card.appendChild(content);
        card.classList.add('mb-post-external-card-link');
        card.addEventListener('click', () => {
          embedContainer.dispatchEvent(new CustomEvent('mb-post-open-url', { bubbles: true, composed: true, detail: { url: external.uri } }));
        });

        embedContainer.appendChild(card);
      }
      break;
    }

    case 'app.bsky.embed.record': {
      // Record embed (quote post or shared record)
      // AT Protocol embed views wrap the quoted record in `record.record`.
      const recordEmbed = embed.record?.record || embed.record;
      if (recordEmbed) {
        const card = document.createElement('div');
        card.className = 'mb-post-record-embed';

        // If it's a post record, render it as a nested post
        if (recordEmbed.$type === 'app.bsky.feed.post' || recordEmbed.author) {
          // Create a mini post view
          const miniPost = document.createElement('mb-post');
          miniPost.classList.add('mb-post-nested');
          // We need to convert recordEmbed to a PostView-like object
          const postView = {
            uri: recordEmbed.uri || '',
            cid: recordEmbed.cid || '',
            author: recordEmbed.author,
            record: recordEmbed.value || {},
            embed: recordEmbed.embeds?.[0] || recordEmbed.embed,
            indexedAt: recordEmbed.indexedAt || recordEmbed.value?.createdAt,
          };
          miniPost.translator = t;
          miniPost.formatters = context.formatters || {};
          miniPost.post = postView;
          card.appendChild(miniPost);
        } else {
          // Generic record display
          const content = document.createElement('div');

          content.innerHTML = `
            <md-icon class="mb-post-generic-record-icon">${ICONS.link}</md-icon>
            <span class="md-typescale-body-small">${t('post.recordEmbed')}</span>
          `;
          card.appendChild(content);
        }

        embedContainer.appendChild(card);
      }
      break;
    }

    case 'app.bsky.embed.recordWithMedia': {
      // Record with media (quote post with image/video)
      const { media } = embed;
      const recordView = embed.record?.record || embed.record;
      const card = document.createElement('div');
      card.className = 'mb-post-record-with-media';

      // Render the record part
      if (recordView) {
        const miniPost = document.createElement('mb-post');
        miniPost.classList.add('mb-post-nested');
        const postView = {
          uri: recordView.uri || '',
          cid: recordView.cid || '',
          author: recordView.author,
          record: recordView.value || {},
          embed: recordView.embeds?.[0] || recordView.embed,
          indexedAt: recordView.indexedAt || recordView.value?.createdAt,
        };
        miniPost.translator = t;
        miniPost.formatters = context.formatters || {};
        miniPost.post = postView;
        card.appendChild(miniPost);
      }

      // Render the media part
      if (media) {
        const mediaEmbed = document.createElement('div');

        const mediaPost = document.createElement('mb-post');
        mediaPost.classList.add('mb-post-nested');
        mediaPost.translator = t;
        mediaPost.formatters = context.formatters || {};
        mediaPost.post = { embed: media, record: { text: '' } };
        mediaEmbed.appendChild(mediaPost);
        card.appendChild(mediaEmbed);
      }

      embedContainer.appendChild(card);
      break;
    }
  }

  return embedContainer;
}

/**
 * Create action buttons row - X (Twitter) style
 * Order: Reply → Repost → Like → Analytics → Bookmark → Share
 * Labeled actions use md-text-button; bookmark/share remain icon-only.
 */
function createActions(post, actions = {}, t = fallbackT, formatCompactNumber = fallbackCompactNumber, host) {
  const row = document.createElement('div');
  row.className = 'mb-post-actions';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', t('post.actionsLabel'));
  const emit = (action, detail = {}) => host.dispatchEvent(new CustomEvent('mb-post-action', {
    bubbles: true, composed: true, detail: { action, post, ...detail },
  }));
  const run = async (name, detail = {}) => {
    if (typeof actions[name] !== 'function') return emit(name, detail);
    const result = await actions[name]({ post, ...detail });
    const legacyName = ({ unrepost: 'repost', unlike: 'like', unsave: 'save' })[name] || name;
    const state = ({ repost: { reposted: true }, unrepost: { reposted: false },
      like: { liked: true }, unlike: { liked: false },
      save: { saved: true }, unsave: { saved: false } })[name] || {};
    host.dispatchEvent(new CustomEvent('mb-post:' + legacyName, {
      bubbles: true, composed: true, detail: { postUri: post.uri, ...state, ...detail },
    }));
    return result;
  };
  const requestText = async kind => {
    if (typeof actions.requestText === 'function') return actions.requestText({ post, kind });
    emit('request-text', { kind }); return null;
  };
  const make = (icon, key, count, opts = {}) => createActionButton(icon, key, count, {
    ...opts, t, formatCompactNumber,
    iconOnly: ['bookmark', 'share'].includes(icon),
    toggle: ['repost', 'like', 'bookmark'].includes(icon),
  });
  const viewer = post.viewer || {};

  const reply = make('reply', 'post.reply', post.replyCount ?? 0);
  reply.btn.addEventListener('click', async () => {
    const text = await requestText('reply');
    if (typeof text === 'string' && text.trim()) await run('reply', { text: text.trim(), reply: post.record?.reply });
  });
  row.append(reply.container);

  let reposted = Boolean(viewer.repost), repostUri = viewer.repost || null, repostCount = post.repostCount ?? 0;
  const repost = make('repost', 'post.repost', repostCount, { filled: reposted });
  const menu = document.createElement('md-menu');
  menu.anchorElement = repost.btn; menu.menuCorner = 'start-start'; menu.anchorCorner = 'end-start'; menu.positioning = 'fixed';
  const item = (action, glyph, label) => {
    const el = document.createElement('md-menu-item'); el.dataset.action = action;
    const icon = document.createElement('md-icon'); icon.slot = 'start'; icon.textContent = glyph;
    const headline = document.createElement('div'); headline.slot = 'headline'; headline.textContent = label;
    el.append(icon, headline); menu.append(el); return el;
  };
  const repostItem = item('repost', ICONS.repost, t('post.repost'));
  const quoteItem = item('quote', ICONS.quote, t('post.quote'));
  repost.btn.addEventListener('click', e => { e.stopPropagation(); menu.open = !menu.open; });
  menu.addEventListener('close-menu', async e => {
    const action = e.detail?.itemPath?.[0]?.dataset?.action;
    try {
      if (action === 'repost') {
        repostItem.disabled = true;
        if (reposted) { await run('unrepost', { repostUri }); reposted = false; repostUri = null; repostCount = Math.max(0, repostCount - 1); }
        else { const result = await run('repost'); reposted = true; repostUri = result?.uri || null; repostCount += 1; }
        repost.update(reposted, repostCount); menu.open = false;
      } else if (action === 'quote') {
        const text = await requestText('quote');
        if (typeof text === 'string' && text.trim()) { quoteItem.disabled = true; await run('quote', { text: text.trim() }); menu.open = false; }
      }
    } catch (error) {
      host.dispatchEvent(new CustomEvent('mb-post-error', { bubbles: true, composed: true, detail: { action, error, post } }));
    } finally { repostItem.disabled = false; quoteItem.disabled = false; }
  });
  row.append(menu, repost.container);

  let liked = Boolean(viewer.like), likeUri = viewer.like || null, likeCount = post.likeCount ?? 0;
  const like = make('like', 'post.like', likeCount, { filled: liked });
  like.btn.addEventListener('click', async () => {
    like.btn.disabled = true;
    try {
      if (liked) { await run('unlike', { likeUri }); liked = false; likeUri = null; likeCount = Math.max(0, likeCount - 1); }
      else { const result = await run('like'); liked = true; likeUri = result?.uri || null; likeCount += 1; }
      like.update(liked, likeCount);
    } catch (error) { host.dispatchEvent(new CustomEvent('mb-post-error', { bubbles: true, composed: true, detail: { action: liked ? 'unlike' : 'like', error, post } })); }
    finally { like.btn.disabled = false; }
  });
  row.append(like.container);

  const analytics = make('analytics', 'post.analytics', post.viewCount ?? viewer.viewCount ?? 0);
  analytics.btn.addEventListener('click', () => run('analytics'));
  row.append(analytics.container);

  let saved = Boolean(viewer.bookmarked || actions.isSaved?.({ post }));
  const save = make('bookmark', 'post.save', null, { filled: saved });
  save.btn.addEventListener('click', async () => {
    save.btn.disabled = true;
    try { if (saved) { await run('unsave'); saved = false; } else { await run('save'); saved = true; } save.update(saved); }
    catch (error) { host.dispatchEvent(new CustomEvent('mb-post-error', { bubbles: true, composed: true, detail: { action: saved ? 'unsave' : 'save', error, post } })); }
    finally { save.btn.disabled = false; }
  });
  row.append(save.container);

  const share = make('share', 'post.share', null);
  share.btn.addEventListener('click', () => {
    const handle = post.author?.handle, rkey = post.uri?.split('/').pop();
    const url = handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : '';
    run('share', { url });
  });
  row.append(share.container);
  return row;
}

/**
 * Create post metadata (time, client, etc.)
 */
function createPostMeta(post, formatRelativeTime = fallbackRelativeTime) {
  const meta = document.createElement('div');
  meta.className = 'mb-post-meta';

  // Use the record timestamp when a nested or partial PostView has no indexedAt.
  const timestamp = post.indexedAt || post.record?.createdAt;
  if (timestamp && !Number.isNaN(Date.parse(timestamp))) {
    const time = document.createElement('time');
    time.className = 'mb-post-time';
    time.dateTime = timestamp;
    time.textContent = formatRelativeTime(timestamp);
    meta.appendChild(time);
  }

  // Client/source (if available)
  if (post.record?.createdAt && post.record.createdAt !== post.indexedAt) {
    // Could show edit indicator
  }

  return meta;
}

/**
 * Add responsive container query styles for the post component
 */
function addResponsiveStyles() {
  // Styles are handled via CSS in components-responsive.css
  // This function is a placeholder for any dynamic responsive logic needed
}

function createClientAdapter(client) {
  return {
    reply: ({ post, text, reply }) => client.reply(post.uri, post.cid, text, reply),
    repost: ({ post }) => client.repost(post.uri, post.cid),
    unrepost: ({ repostUri }) => client.unrepost(repostUri),
    quote: ({ post, text }) => client.quote(post.uri, post.cid, text),
    like: ({ post }) => client.like(post.uri, post.cid),
    unlike: ({ likeUri }) => client.unlike(likeUri),
    isSaved: ({ post }) => client.isSaved?.(post.uri) || false,
    save: ({ post }) => client.save(post.uri, post.cid),
    unsave: ({ post }) => client.unsave(post.uri, post.cid),
  };
}

/**
 * Main mb-post Web Component class
 */
export class MbPost extends HTMLElement {
  static get observedAttributes() {
    return ['post'];
  }

  constructor() {
    super();
    this._post = null;
    this._client = null;
    this._actions = null;
    this._translator = fallbackT;
    this._formatters = {};
    this._rendered = false;
  }

  set post(value) {
    this._post = value;
    if (this._rendered) {
      this.render();
    }
  }

  get post() {
    return this._post;
  }

  set client(value) {
    this._client = value;
    if (this._rendered) {
      this.render();
    }
  }

  get client() {
    return this._client;
  }

  set actions(value) {
    this._actions = value && typeof value === 'object' ? value : null;
    if (this._rendered) this.render();
  }
  get actions() { return this._actions; }

  set translator(value) {
    this._translator = typeof value === 'function' ? value : fallbackT;
    if (this._rendered) this.render();
  }
  get translator() { return this._translator; }

  set formatters(value) {
    this._formatters = value && typeof value === 'object' ? value : {};
    if (this._rendered) this.render();
  }
  get formatters() { return this._formatters; }

  connectedCallback() {
    this._rendered = true;
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'post' && oldValue !== newValue) {
      // Attribute-based setting (not recommended for complex objects)
      try {
        this._post = JSON.parse(newValue);
      } catch {
        this._post = null;
      }
      if (this._rendered) this.render();
    }
  }

  render() {
    if (!this._post) {
      this.innerHTML = '';
      return;
    }

    const post = this._post;
    const record = post.record || {};
    const author = post.author || {};
    const isRepost = (post.reason?.$type || post.reason?.pyType) === 'app.bsky.feed.defs#reasonRepost';

    // Clear and rebuild
    this.innerHTML = '';
    this.className = 'mb-post';

    // Repost indicator
    if (isRepost && post.reason?.by) {
      const repostIndicator = document.createElement('div');
      repostIndicator.className = 'mb-post-repost-indicator';

      const icon = document.createElement('md-icon');
      icon.textContent = ICONS.repost;

      repostIndicator.appendChild(icon);
      
      const label = document.createElement('span');
      label.textContent = this._translator('post.repostedBy', { name: post.reason.by.displayName || `@${post.reason.by.handle}` });
      repostIndicator.appendChild(label);
      
      this.appendChild(repostIndicator);
    }

    // Main post content
    const article = document.createElement('article');
    article.className = 'mb-post-article';

    // Avatar column
    const avatarCol = document.createElement('div');
    avatarCol.className = 'mb-post-avatar-column';

    const avatar = createAvatar(author);

    avatarCol.appendChild(avatar);
    article.appendChild(avatarCol);

    // Content column
    const contentCol = document.createElement('div');
    contentCol.className = 'mb-post-content-column';

    // Author line
    const authorLine = createAuthorLine(author, false, this._translator);

    contentCol.appendChild(authorLine);

    // Reply thread context
    const replyThread = createReplyThread(post.reply, this._translator);
    if (replyThread) {
      contentCol.appendChild(replyThread);
    }

    // Post text
    const postText = createPostText(record);
    if (postText) {
      contentCol.appendChild(postText);
    }

    // Embed
    const embed = createEmbed(post.embed || record.embed, record, { translator: this._translator, formatters: this._formatters });
    if (embed) {
      contentCol.appendChild(embed);
    }

    // Actions are optional and supplied by the host application.
    if (this._actions || this._client) {
      const handlers = this._actions || createClientAdapter(this._client);
      contentCol.appendChild(createActions(post, handlers, this._translator, this._formatters.formatCompactNumber || fallbackCompactNumber, this));
    }

    // Meta (time, etc.)
    const meta = createPostMeta(post, this._formatters.formatRelativeTime || ((value) => fallbackRelativeTime(value, this._translator)));
    contentCol.appendChild(meta);

    article.appendChild(contentCol);
    this.appendChild(article);

    // Set up container query for responsive behavior
    
  }
}

// Register the custom element
if (!customElements.get('mb-post')) {
  customElements.define('mb-post', MbPost);
}

export default MbPost;