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

import { t, formatRelativeTime, formatCompactNumber } from '../i18n.js';

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
};

/**
 * Format count for display (uses formatCompactNumber from i18n)
 */
function formatCount(count) {
  if (count === null || count === undefined || count <= 0) return '';
  return formatCompactNumber(count);
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
function createAuthorLine(author, isRepost = false) {
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
 * Create a properly labeled action button with ARIA support
 */
function createAccessibleActionButton(icon, labelKey, count, options = {}) {
  const btn = document.createElement('button');
  btn.className = 'mb-post-action-btn';
  btn.type = 'button';
  
  const filled = options.filled || false;
  const iconName = filled ? ICONS[`${options.iconKey}Filled`] : ICONS[options.iconKey];
  const label = t(labelKey);
  const countStr = formatCount(count);
  
  btn.setAttribute('aria-label', countStr ? `${label}, ${countStr}` : label);
  btn.setAttribute('aria-pressed', String(filled));
  
  btn.innerHTML = `
    <md-icon class="mb-post-action-icon${filled ? ' is-filled' : ''}" style="font-size:20px;" aria-hidden="true">${iconName}</md-icon>
    ${countStr ? `<span class="mb-post-action-count" aria-hidden="true">${countStr}</span>` : ''}
  `;
  
  btn.style.cssText = `
    display:inline-flex;align-items:center;gap:4px;padding:8px 12px;
    border:none;background:transparent;color:var(--md-sys-color-on-surface-variant);
    font:inherit;border-radius:var(--catalog-shape-xl);cursor:pointer;
    transition:background-color 0.2s;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent';
  });

  return { 
    btn, 
    update: (newFilled, newCount) => {
      const iconEl = btn.querySelector('.mb-post-action-icon');
      const countEl = btn.querySelector('.mb-post-action-count');
      const newCountStr = formatCount(newCount);
      if (newFilled) {
        iconEl.classList.add('is-filled');
        iconEl.textContent = ICONS[`${options.iconKey}Filled`];
      } else {
        iconEl.classList.remove('is-filled');
        iconEl.textContent = ICONS[options.iconKey];
      }
      btn.setAttribute('aria-pressed', String(newFilled));
      btn.setAttribute('aria-label', newCountStr ? `${label}, ${newCountStr}` : label);
      if (countEl) countEl.textContent = newCountStr;
      else if (newCountStr) {
        const newCountEl = document.createElement('span');
        newCountEl.className = 'mb-post-action-count';
        newCountEl.setAttribute('aria-hidden', 'true');
        newCountEl.textContent = newCountStr;
        btn.appendChild(newCountEl);
      }
    }
  };
}

/**
 * Create reply thread context (parent/root posts)
 */
function createReplyThread(reply) {
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
    card.style.cssText = 'padding:8px;border-radius:12px;background:var(--md-sys-color-surface-container-high);margin-bottom:6px;';

    const author = createAuthorLine(replyPost.author, false);
    author.classList.add('mb-post-reply-author');
    if (replyPost._isRoot) {
      const badge = document.createElement('span');
      badge.className = 'mb-post-reply-badge md-typescale-label-small';
      badge.textContent = t('post.replyRoot');
      badge.style.cssText = 'background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);padding:2px 6px;border-radius:4px;font-size:0.65rem;margin-left:8px;';
      author.appendChild(badge);
    } else if (replyPost._isParent) {
      const badge = document.createElement('span');
      badge.className = 'mb-post-reply-badge md-typescale-label-small';
      badge.textContent = t('post.replyParent');
      badge.style.cssText = 'background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container);padding:2px 6px;border-radius:4px;font-size:0.65rem;margin-left:8px;';
      author.appendChild(badge);
    }

    const text = document.createElement('div');
    text.className = 'mb-post-reply-text md-typescale-body-small';
    text.style.whiteSpace = 'pre-wrap';
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
  textContainer.style.whiteSpace = 'pre-wrap';
  textContainer.textContent = record.text;

  // TODO: Implement facet rendering (links, mentions, hashtags)
  // This would require parsing record.facets and creating appropriate links

  return textContainer;
}

/**
 * Create embed content (images, video, external, record, recordWithMedia)
 */
function createEmbed(embed, record) {
  if (!embed) return null;

  const embedContainer = document.createElement('div');
  embedContainer.className = 'mb-post-embed';

  switch (embed.$type) {
    case 'app.bsky.embed.images': {
      const images = embed.images || record?.embed?.images || [];
      if (images.length > 0) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'mb-post-images';
        imageContainer.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';

        images.forEach((img) => {
          const imgElement = document.createElement('img');
          imgElement.className = 'mb-post-image';
          imgElement.src = img.fullsize || img.thumbnail;
          imgElement.alt = img.alt || '';
          imgElement.loading = 'lazy';
          imgElement.style.cssText = 'width:120px;height:120px;object-fit:cover;border-radius:8px;cursor:pointer;';

          imgElement.addEventListener('click', () => {
            window.open(img.fullsize || img.thumbnail, '_blank');
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
      videoContainer.style.cssText = 'background:var(--md-sys-color-surface-container-high);border-radius:12px;padding:16px;text-align:center;';
      videoContainer.innerHTML = `
        <md-icon style="font-size:48px;color:var(--md-sys-color-on-surface-variant);">${ICONS.video}</md-icon>
        <div class="md-typescale-body-medium" style="margin-top:8px;">${t('post.videoEmbed')}</div>
      `;
      embedContainer.appendChild(videoContainer);
      break;
    }

    case 'app.bsky.embed.external': {
      const external = embed.external;
      if (external) {
        const card = document.createElement('div');
        card.className = 'mb-post-external-card';
        card.style.cssText = 'border:1px solid var(--md-sys-color-outline-variant);border-radius:12px;overflow:hidden;background:var(--md-sys-color-surface);margin-top:8px;';

        if (external.thumb) {
          const thumb = document.createElement('img');
          thumb.src = external.thumb;
          thumb.alt = '';
          thumb.loading = 'lazy';
          thumb.style.cssText = 'width:100%;height:160px;object-fit:cover;';
          card.appendChild(thumb);
        }

        const content = document.createElement('div');
        content.style.cssText = 'padding:12px;';

        if (external.title) {
          const title = document.createElement('div');
          title.className = 'md-typescale-title-medium';
          title.style.cssText = 'font-weight:600;margin-bottom:4px;';
          title.textContent = external.title;
          content.appendChild(title);
        }

        if (external.description) {
          const desc = document.createElement('div');
          desc.className = 'md-typescale-body-small';
          desc.style.cssText = 'color:var(--md-sys-color-on-surface-variant);margin-bottom:8px;';
          desc.textContent = external.description;
          content.appendChild(desc);
        }

        const uri = document.createElement('div');
        uri.className = 'md-typescale-label-small';
        uri.style.cssText = 'color:var(--md-sys-color-primary);';
        uri.textContent = external.uri;
        content.appendChild(uri);

        card.appendChild(content);
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          window.open(external.uri, '_blank');
        });

        embedContainer.appendChild(card);
      }
      break;
    }

    case 'app.bsky.embed.record': {
      // Record embed (quote post or shared record)
      const recordEmbed = embed.record;
      if (recordEmbed) {
        const card = document.createElement('div');
        card.className = 'mb-post-record-embed';
        card.style.cssText = 'border:1px solid var(--md-sys-color-outline-variant);border-radius:12px;background:var(--md-sys-color-surface);margin-top:8px;overflow:hidden;';

        // If it's a post record, render it as a nested post
        if (recordEmbed.$type === 'app.bsky.feed.post' || recordEmbed.author) {
          // Create a mini post view
          const miniPost = document.createElement('mb-post');
          miniPost.style.cssText = 'margin:0;border-radius:0;border:none;background:transparent;';
          // We need to convert recordEmbed to a PostView-like object
          const postView = {
            uri: recordEmbed.uri || '',
            cid: recordEmbed.cid || '',
            author: recordEmbed.author,
            record: recordEmbed.value || recordEmbed,
            embed: recordEmbed.embed,
            indexedAt: recordEmbed.indexedAt || new Date().toISOString(),
          };
          miniPost.post = postView;
          card.appendChild(miniPost);
        } else {
          // Generic record display
          const content = document.createElement('div');
          content.style.cssText = 'padding:12px;';
          content.innerHTML = `
            <md-icon style="color:var(--md-sys-color-on-surface-variant);">${ICONS.link}</md-icon>
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
      const { record, media } = embed;
      const card = document.createElement('div');
      card.className = 'mb-post-record-with-media';
      card.style.cssText = 'border:1px solid var(--md-sys-color-outline-variant);border-radius:12px;background:var(--md-sys-color-surface);margin-top:8px;overflow:hidden;';

      // Render the record part
      if (record) {
        const miniPost = document.createElement('mb-post');
        miniPost.style.cssText = 'margin:0;border-radius:0;border:none;background:transparent;';
        const postView = {
          uri: record.uri || '',
          cid: record.cid || '',
          author: record.author,
          record: record.value || record,
          embed: record.embed,
          indexedAt: record.indexedAt || new Date().toISOString(),
        };
        miniPost.post = postView;
        card.appendChild(miniPost);
      }

      // Render the media part
      if (media) {
        const mediaEmbed = document.createElement('div');
        mediaEmbed.style.cssText = 'border-top:1px solid var(--md-sys-color-outline-variant);';
        const mediaPost = document.createElement('mb-post');
        mediaPost.style.cssText = 'margin:0;border-radius:0;border:none;background:transparent;';
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
 * Create action buttons row (reply, repost, like, bookmark, share)
 */
function createActions(post, client) {
  const actionRow = document.createElement('div');
  actionRow.className = 'mb-post-actions';
  actionRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;';
  actionRow.setAttribute('role', 'group');
  actionRow.setAttribute('aria-label', t('post.actionsLabel'));

  const viewer = post.viewer || {};

  // Reply button
  const replyCount = post.replyCount ?? 0;
  const { btn: replyBtn, update: updateReplyBtn } = createAccessibleActionButton(
    ICONS.reply, 'post.reply', replyCount, { iconKey: 'reply' }
  );
  replyBtn.addEventListener('click', async () => {
    const text = window.prompt(t('post.replyPrompt'));
    if (!text || !text.trim()) return;
    replyBtn.disabled = true;
    try {
      const record = post.record || {};
      await client.reply(post.uri, post.cid, text.trim(), record.reply);
      // Dispatch event for parent to handle timeline refresh
      document.dispatchEvent(new CustomEvent('mb-post:reply', { detail: { postUri: post.uri } }));
    } catch (e) {
      console.error('Reply failed:', e);
    } finally {
      replyBtn.disabled = false;
    }
  });
  actionRow.appendChild(replyBtn);

  // Repost button with menu
  const repostCount = post.repostCount ?? 0;
  let reposted = Boolean(viewer.repost);
  let repostRecordUri = viewer.repost || null;
  const { btn: repostBtn, update: updateRepostBtn } = createAccessibleActionButton(
    reposted ? ICONS.repostFilled : ICONS.repost,
    'post.repost',
    repostCount,
    { iconKey: 'repost', filled: reposted }
  );

  // Create repost menu
  const repostMenu = document.createElement('md-menu');
  repostMenu.anchorElement = repostBtn;
  repostMenu.menuCorner = 'start-start';
  repostMenu.anchorCorner = 'end-start';
  repostMenu.positioning = 'fixed';

  const doRepostItem = document.createElement('md-menu-item');
  doRepostItem.dataset.action = 'repost';
  doRepostItem.innerHTML = `
    <md-icon slot="start">repeat</md-icon>
    <div slot="headline">${t('post.repost')}</div>
  `;

  const quoteItem = document.createElement('md-menu-item');
  quoteItem.dataset.action = 'quote';
  quoteItem.innerHTML = `
    <md-icon slot="start">format_quote</md-icon>
    <div slot="headline">${t('post.quote')}</div>
  `;

  repostMenu.appendChild(doRepostItem);
  repostMenu.appendChild(quoteItem);

  repostBtn.addEventListener('click', () => {
    repostMenu.open = !repostMenu.open;
  });

  const handleRepost = async () => {
    doRepostItem.disabled = true;
    try {
      if (reposted) {
        await client.unrepost(repostRecordUri);
        reposted = false;
        repostRecordUri = null;
        updateRepostBtn(false, repostCount);
      } else {
        const res = await client.repost(post.uri, post.cid);
        reposted = true;
        repostRecordUri = res?.uri || null;
        updateRepostBtn(true, (repostCount ?? 0) + 1);
      }
      repostMenu.open = false;
      document.dispatchEvent(new CustomEvent('mb-post:repost', { detail: { postUri: post.uri, reposted } }));
    } catch (e) {
      console.error('Repost failed:', e);
    } finally {
      doRepostItem.disabled = false;
    }
  };

  const handleQuote = async () => {
    const text = window.prompt(t('post.quotePrompt'));
    if (!text || !text.trim()) return;
    quoteItem.disabled = true;
    try {
      await client.quote(post.uri, post.cid, text.trim());
      repostMenu.open = false;
      document.dispatchEvent(new CustomEvent('mb-post:quote', { detail: { postUri: post.uri } }));
    } catch (e) {
      console.error('Quote failed:', e);
    } finally {
      quoteItem.disabled = false;
    }
  };

  repostMenu.addEventListener('close-menu', async (event) => {
    const action = event.detail?.itemPath?.[0]?.dataset?.action;
    if (action === 'repost') await handleRepost();
    if (action === 'quote') await handleQuote();
  });

  // Append menu to body to avoid overflow issues
  document.body.appendChild(repostMenu);
  actionRow.appendChild(repostBtn);

  // Like button
  const likeCount = post.likeCount ?? 0;
  let liked = Boolean(viewer.like);
  let likeRecordUri = viewer.like || null;
  let currentLikeCount = likeCount;
  const { btn: likeBtn, update: updateLikeBtn } = createAccessibleActionButton(
    liked ? ICONS.likeFilled : ICONS.like,
    'post.like',
    likeCount,
    { iconKey: 'like', filled: liked }
  );
  likeBtn.addEventListener('click', async () => {
    likeBtn.disabled = true;
    try {
      if (liked) {
        await client.unlike(likeRecordUri);
        liked = false;
        likeRecordUri = null;
        currentLikeCount = Math.max(0, (currentLikeCount ?? 1) - 1);
        updateLikeBtn(false, currentLikeCount);
      } else {
        const res = await client.like(post.uri, post.cid);
        liked = true;
        likeRecordUri = res?.uri || null;
        currentLikeCount = (currentLikeCount ?? 0) + 1;
        updateLikeBtn(true, currentLikeCount);
      }
      document.dispatchEvent(new CustomEvent('mb-post:like', { detail: { postUri: post.uri, liked } }));
    } catch (e) {
      console.error('Like failed:', e);
    } finally {
      likeBtn.disabled = false;
    }
  });
  actionRow.appendChild(likeBtn);

  // Bookmark/Save button
  let saved = client.isSaved?.(post.uri) || false;
  const { btn: saveBtn, update: updateSaveBtn } = createAccessibleActionButton(
    saved ? ICONS.bookmarkFilled : ICONS.bookmark,
    'post.save',
    null,
    { iconKey: 'bookmark', filled: saved }
  );
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      if (saved) {
        await client.unsave(post.uri, post.cid);
        saved = false;
        updateSaveBtn(false);
      } else {
        await client.save(post.uri, post.cid);
        saved = true;
        updateSaveBtn(true);
      }
      document.dispatchEvent(new CustomEvent('mb-post:save', { detail: { postUri: post.uri, saved } }));
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      saveBtn.disabled = false;
    }
  });
  actionRow.appendChild(saveBtn);

  // Share button
  const { btn: shareBtn } = createAccessibleActionButton(ICONS.share, 'post.share', null, { iconKey: 'share' });
  shareBtn.addEventListener('click', async () => {
    const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('post.shareTitle', { handle: post.author.handle }),
          text: post.record?.text,
          url: postUrl,
        });
      } catch (e) {
        if (e.name !== 'AbortError') console.error('Share failed:', e);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(postUrl);
      // TODO: Show toast/snackbar
    }
  });
  actionRow.appendChild(shareBtn);

  return actionRow;
}

/**
 * Create post metadata (time, client, etc.)
 */
function createPostMeta(post) {
  const meta = document.createElement('div');
  meta.className = 'mb-post-meta';
  meta.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.75rem;color:var(--md-sys-color-on-surface-variant);';

  // Relative time
  const time = document.createElement('time');
  time.className = 'mb-post-time';
  time.dateTime = post.indexedAt;
  time.textContent = formatRelativeTime(post.indexedAt);
  meta.appendChild(time);

  // Separator
  const sep = document.createElement('span');
  sep.textContent = '·';
  meta.appendChild(sep);

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
    const isRepost = post.reason?.pyType === 'app.bsky.feed.defs#reasonRepost';

    // Clear and rebuild
    this.innerHTML = '';
    this.className = 'mb-post';
    this.style.cssText = `
      display:block;
      padding:16px;
      border-radius:16px;
      background:var(--md-sys-color-surface);
      border:1px solid var(--md-sys-color-outline-variant);
      min-width:0;
      max-width:100%;
      box-sizing:border-box;
    `;

    // Repost indicator
    if (isRepost && post.reason?.by) {
      const repostIndicator = document.createElement('div');
      repostIndicator.className = 'mb-post-repost-indicator';
      repostIndicator.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:0.75rem;color:var(--md-sys-color-on-surface-variant);';
      
      const icon = document.createElement('md-icon');
      icon.textContent = ICONS.repost;
      icon.style.fontSize = '16px';
      repostIndicator.appendChild(icon);
      
      const label = document.createElement('span');
      label.textContent = t('post.repostedBy', { name: post.reason.by.displayName || `@${post.reason.by.handle}` });
      repostIndicator.appendChild(label);
      
      this.appendChild(repostIndicator);
    }

    // Main post content
    const article = document.createElement('article');
    article.className = 'mb-post-article';
    article.style.cssText = 'display:flex;gap:12px;min-width:0;';

    // Avatar column
    const avatarCol = document.createElement('div');
    avatarCol.className = 'mb-post-avatar-column';
    avatarCol.style.cssText = 'flex:0 0 40px;';
    const avatar = createAvatar(author);
    avatar.style.cssText = 'width:40px;height:40px;border-radius:50%;object-fit:cover;';
    avatarCol.appendChild(avatar);
    article.appendChild(avatarCol);

    // Content column
    const contentCol = document.createElement('div');
    contentCol.className = 'mb-post-content-column';
    contentCol.style.cssText = 'flex:1;min-width:0;';

    // Author line
    const authorLine = createAuthorLine(author);
    authorLine.style.cssText = 'display:flex;align-items:baseline;gap:6px;margin-bottom:4px;';
    contentCol.appendChild(authorLine);

    // Reply thread context
    const replyThread = createReplyThread(post.reply);
    if (replyThread) {
      contentCol.appendChild(replyThread);
    }

    // Post text
    const postText = createPostText(record);
    if (postText) {
      contentCol.appendChild(postText);
    }

    // Embed
    const embed = createEmbed(post.embed, record);
    if (embed) {
      contentCol.appendChild(embed);
    }

    // Actions (only if client is available)
    if (this._client) {
      const actions = createActions(post, this._client);
      contentCol.appendChild(actions);
    }

    // Meta (time, etc.)
    const meta = createPostMeta(post);
    contentCol.appendChild(meta);

    article.appendChild(contentCol);
    this.appendChild(article);

    // Set up container query for responsive behavior
    this.style.containerType = 'inline-size';
  }
}

// Register the custom element
if (!customElements.get('mb-post')) {
  customElements.define('mb-post', MbPost);
}

export default MbPost;