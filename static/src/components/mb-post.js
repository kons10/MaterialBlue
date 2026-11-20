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
  analytics: 'analytics',
  share: 'share',
  bookmark: 'bookmark',
  bookmarkFilled: 'bookmark',
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
 * Create action button using @material/web components
 * Returns { btn, container, update }; labeled actions use md-text-button,
 * while bookmark/share use md-icon-button.
 */
function createActionButton(iconKey, labelKey, count, options = {}) {
  const iconOnly = Boolean(options.iconOnly);
  const toggle = Boolean(options.toggle);
  const selected = Boolean(options.filled);
  const label = t(labelKey);
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
    const countText = formatCount(newCount);
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
function createEmbed(embed, record) {
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
          window.open(external.uri, '_blank');
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
        miniPost.post = postView;
        card.appendChild(miniPost);
      }

      // Render the media part
      if (media) {
        const mediaEmbed = document.createElement('div');

        const mediaPost = document.createElement('mb-post');
        mediaPost.classList.add('mb-post-nested');
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
function createActions(post, client) {
  const actionRow = document.createElement('div');
  actionRow.className = 'mb-post-actions';

  actionRow.setAttribute('role', 'group');
  actionRow.setAttribute('aria-label', t('post.actionsLabel'));

  const viewer = post.viewer || {};

  // Use text buttons for labeled actions and icon buttons for bookmark/share.
  const createIconButton = (iconKey, labelKey, count, options = {}) =>
    createActionButton(iconKey, labelKey, count, {
      ...options,
      iconOnly: ['bookmark', 'share'].includes(iconKey),
      toggle: ['repost', 'like', 'bookmark'].includes(iconKey),
    });

  // 1. Reply
  const replyCount = post.replyCount ?? 0;
  const { btn: replyBtn, container: replyAction } = createIconButton('reply', 'post.reply', replyCount);
  replyBtn.addEventListener('click', async () => {
    const text = window.prompt(t('post.replyPrompt'));
    if (!text || !text.trim()) return;
    replyBtn.disabled = true;
    try {
      const record = post.record || {};
      await client.reply(post.uri, post.cid, text.trim(), record.reply);
      document.dispatchEvent(new CustomEvent('mb-post:reply', { detail: { postUri: post.uri } }));
    } catch (e) {
      console.error('Reply failed:', e);
    } finally {
      replyBtn.disabled = false;
    }
  });
  actionRow.appendChild(replyAction);

  // 2. Repost (メニュー付き)
  const repostCount = post.repostCount ?? 0;
  let reposted = Boolean(viewer.repost);
  let repostRecordUri = viewer.repost || null;
  const { btn: repostBtn, container: repostAction, update: updateRepostBtn } = createIconButton('repost', 'post.repost', repostCount, { filled: reposted });

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

  repostBtn.addEventListener('click', (e) => {
    // メニュー開閉のみ、クリックイベント伝播防止
    e.stopPropagation();
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

  // Keep the menu inside the component so rerendering/removing a post cannot leak it into document.body.
  actionRow.appendChild(repostMenu);
  actionRow.appendChild(repostAction);

  // 3. Like
  const likeCount = post.likeCount ?? 0;
  let liked = Boolean(viewer.like);
  let likeRecordUri = viewer.like || null;
  let currentLikeCount = likeCount;
  const { btn: likeBtn, container: likeAction, update: updateLikeBtn } = createIconButton('like', 'post.like', likeCount, { filled: liked });
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
  actionRow.appendChild(likeAction);

  // 4. Analytics (表示数) - post.viewCount または viewer?.viewCount
  const viewCount = post.viewCount ?? post.viewer?.viewCount ?? 0;
  const { btn: analyticsBtn, container: analyticsAction } = createIconButton('analytics', 'post.analytics', viewCount);
  analyticsBtn.addEventListener('click', () => {
    // TODO: 詳細統計モーダル表示
  });
  actionRow.appendChild(analyticsAction);

  // 5. Bookmark
  let saved = client.isSaved?.(post.uri) || false;
  const { btn: saveBtn, container: saveAction, update: updateSaveBtn } = createIconButton('bookmark', 'post.save', null, { filled: saved });
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
  actionRow.appendChild(saveAction);

  // 6. Share
  const { btn: shareBtn, container: shareAction } = createIconButton('share', 'post.share', null);
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
      await navigator.clipboard.writeText(postUrl);
    }
  });
  actionRow.appendChild(shareAction);

  return actionRow;
}

/**
 * Create post metadata (time, client, etc.)
 */
function createPostMeta(post) {
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
      label.textContent = t('post.repostedBy', { name: post.reason.by.displayName || `@${post.reason.by.handle}` });
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
    const authorLine = createAuthorLine(author);

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
    const embed = createEmbed(post.embed || record.embed, record);
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
    
  }
}

// Register the custom element
if (!customElements.get('mb-post')) {
  customElements.define('mb-post', MbPost);
}

export default MbPost;