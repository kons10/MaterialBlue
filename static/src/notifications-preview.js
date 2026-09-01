import { createBskyClient } from '/src/bsky-client.js';
import { t, getCurrentLocale } from '/src/i18n.js';

const client = createBskyClient();
let rendering = false;
let observer = null;
let viewObserver = null;
let lastNotificationSignature = '';

const reasonKeyMap = {
  like: 'notification.reason.like',
  repost: 'notification.reason.repost',
  reply: 'notification.reason.reply',
  quote: 'notification.reason.quote',
  mention: 'notification.reason.mention',
  follow: 'notification.reason.follow',
};

function injectStyles() {
  if (document.getElementById('notification-preview-styles')) return;
  const style = document.createElement('style');
  style.id = 'notification-preview-styles';
  style.textContent = `
    .notification-preview-list {
      display: flex;
      flex-direction: column;
    }
    .notification-preview-item {
      display: grid;
      grid-template-columns: minmax(220px, 0.8fr) minmax(300px, 1.2fr);
      gap: 20px;
      align-items: center;
      padding: 18px 16px;
      border-bottom: 1px solid var(--md-sys-color-outline);
    }
    .notification-preview-meta {
      min-width: 0;
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      column-gap: 12px;
      align-items: start;
    }
    .notification-preview-icon {
      grid-row: 1 / span 3;
      align-self: center;
    }
    .notification-preview-author {
      min-width: 0;
    }
    .notification-preview-author-name {
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .notification-preview-handle {
      color: var(--md-sys-color-on-surface-variant, #49454f);
      overflow-wrap: anywhere;
    }
    .notification-preview-reason {
      margin-top: 4px;
    }
    .notification-preview-time {
      display: flex;
      flex-direction: column;
      margin-top: 10px;
      color: var(--md-sys-color-on-surface-variant, #49454f);
    }
    .notification-post-card {
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 14px;
      background: var(--md-sys-color-surface, #fff);
      overflow: hidden;
    }
    .notification-post-author {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      margin-bottom: 8px;
    }
    .notification-post-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      flex: 0 0 auto;
      background: var(--md-sys-color-surface-container-high, #ece6f0);
    }
    .notification-post-author-text {
      min-width: 0;
    }
    .notification-post-author-name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .notification-post-date {
      color: var(--md-sys-color-on-surface-variant, #49454f);
      margin-left: 4px;
      white-space: nowrap;
    }
    .notification-post-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .notification-post-images {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-top: 10px;
    }
    .notification-post-image {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      border-radius: 8px;
      background: var(--md-sys-color-surface-container-high, #ece6f0);
    }
    .notification-post-stats {
      display: flex;
      gap: 18px;
      margin-top: 10px;
      color: var(--md-sys-color-on-surface-variant, #49454f);
    }
    .notification-post-stat {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    @media (max-width: 760px) {
      .notification-preview-item {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .notification-post-images {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;
  document.head.appendChild(style);
}

function createAvatar(src, alt = '') {
  const avatar = document.createElement('img');
  avatar.className = 'notification-post-avatar';
  avatar.alt = alt;
  if (src) avatar.src = src;
  avatar.loading = 'lazy';
  avatar.addEventListener('error', () => {
    avatar.removeAttribute('src');
  }, { once: true });
  return avatar;
}

function createStat(icon, count) {
  const stat = document.createElement('span');
  stat.className = 'notification-post-stat';
  const iconElement = document.createElement('md-icon');
  iconElement.textContent = icon;
  iconElement.style.fontSize = '18px';
  const value = document.createElement('span');
  value.textContent = String(count ?? 0);
  stat.append(iconElement, value);
  return stat;
}

function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'notification-post-card';

  const authorRow = document.createElement('div');
  authorRow.className = 'notification-post-author';
  authorRow.appendChild(createAvatar(post.author?.avatar, post.author?.handle || ''));

  const authorText = document.createElement('div');
  authorText.className = 'notification-post-author-text';

  const authorName = document.createElement('span');
  authorName.className = 'notification-post-author-name';
  authorName.textContent = post.author?.displayName || post.author?.handle || t('notification.authorFallback');
  authorText.appendChild(authorName);

  if (post.record?.createdAt) {
    const date = document.createElement('span');
    date.className = 'notification-post-date';
    date.textContent = `· ${new Date(post.record.createdAt).toLocaleDateString(getCurrentLocale(), { month: 'numeric', day: 'numeric' })}`;
    authorText.appendChild(date);
  }

  authorRow.appendChild(authorText);
  card.appendChild(authorRow);

  if (post.record?.text) {
    const text = document.createElement('div');
    text.className = 'notification-post-text md-typescale-body-medium';
    text.textContent = post.record.text;
    card.appendChild(text);
  }

  const images = post.embed?.images || [];
  if (images.length > 0) {
    const imageGrid = document.createElement('div');
    imageGrid.className = 'notification-post-images';
    images.slice(0, 4).forEach((image) => {
      const imageElement = document.createElement('img');
      imageElement.className = 'notification-post-image';
      imageElement.src = image.thumbnail || image.fullsize;
      imageElement.alt = image.alt || '';
      imageElement.loading = 'lazy';
      imageElement.addEventListener('click', () => {
        if (image.fullsize) window.open(image.fullsize, '_blank', 'noopener,noreferrer');
      });
      imageGrid.appendChild(imageElement);
    });
    card.appendChild(imageGrid);
  }

  const stats = document.createElement('div');
  stats.className = 'notification-post-stats';
  stats.append(
    createStat('favorite', post.likeCount),
    createStat('repeat', post.repostCount),
    createStat('chat_bubble', post.replyCount),
  );
  card.appendChild(stats);

  return card;
}

function createNotificationItem(notification, post) {
  const item = document.createElement('article');
  item.className = 'notification-preview-item';

  const meta = document.createElement('div');
  meta.className = 'notification-preview-meta';

  const icon = document.createElement('md-icon');
  icon.className = 'notification-preview-icon';
  icon.textContent = notification.isRead ? 'notifications' : 'notifications_active';
  meta.appendChild(icon);

  const author = document.createElement('div');
  author.className = 'notification-preview-author';

  const authorName = document.createElement('div');
  authorName.className = 'notification-preview-author-name md-typescale-title-medium';
  authorName.textContent = notification.author?.displayName || notification.author?.handle || t('notification.sourceFallback');
  author.appendChild(authorName);

  if (notification.author?.handle) {
    const handle = document.createElement('div');
    handle.className = 'notification-preview-handle md-typescale-body-small';
    handle.textContent = `@${notification.author.handle}`;
    author.appendChild(handle);
  }

  const reason = document.createElement('div');
  reason.className = 'notification-preview-reason md-typescale-body-medium';
  const reasonKey = reasonKeyMap[notification.reason];
  reason.textContent = reasonKey ? t(reasonKey) : t('notification.reason.unknown', { action: notification.reason || '通知' });
  author.appendChild(reason);

  if (notification.indexedAt) {
    const time = document.createElement('div');
    time.className = 'notification-preview-time md-typescale-body-small';
    const date = new Date(notification.indexedAt);
    const dateText = document.createElement('span');
    dateText.textContent = date.toLocaleDateString(getCurrentLocale());
    const timeText = document.createElement('span');
    timeText.textContent = date.toLocaleTimeString(getCurrentLocale());
    time.append(dateText, timeText);
    author.appendChild(time);
  }

  meta.appendChild(author);
  item.appendChild(meta);

  // ❗️ FIX: Show reply text when available (for reply notifications)
  if (notification.record?.text) {
    const replyText = document.createElement('div');
    replyText.className = 'notification-post-text md-typescale-body-medium';
    replyText.style.whiteSpace = 'pre-wrap';
    replyText.style.overflowWrap = 'anywhere';
    replyText.style.marginTop = '8px';
    replyText.style.color = 'var(--md-sys-color-on-surface-variant)';
    replyText.textContent = notification.record.text;
    item.appendChild(replyText);
  }

  // SHOW POST CONTENT IF AVAILABLE
  if (post) {
    item.appendChild(createPostCard(post));
  }

  return item;
}

function notificationTargetUri(notification) {
  if (notification.reasonSubject) return notification.reasonSubject;
  if (['like', 'repost', 'reply', 'quote', 'mention'].includes(notification.reason)) {
    return notification.uri || null;
  }
  return null;
}

function isPreviewRendered(container) {
  return container.firstElementChild?.classList.contains('notification-preview-list') === true;
}

async function fetchAndRender() {
    const container = document.getElementById('notifications');
    if (!container || rendering) return;

    rendering = true;
    try {
      await client.ready();
      if (!client.isLoggedIn) return;

      const notifications = await client.notifications();
      // ❗️ FIX: For reply notifications, fetch the actual reply record URI
      // For other notifications, use the reasonSubject (parent post URI)
      const targetUris = [...new Set(notifications.map((notification) => {
        // For reply notifications, fetch the actual reply record
        if (notification.reason === 'reply' && notification.uri) {
          return notification.uri;
        }
        // For other notifications, use parent post URI
        return notificationTargetUri(notification);
      }).filter(Boolean))];
      const posts = await client.posts(targetUris);
      const postsByUri = new Map(posts.map((post) => [post.uri, post]));

      const signature = notifications.map((notification) => `${notification.uri}:${notification.isRead}:${notification.indexedAt}`).join('|');
      if (signature === lastNotificationSignature && isPreviewRendered(container)) return;
      lastNotificationSignature = signature;

      if (observer) observer.disconnect();
      container.innerHTML = '';
      container.dataset.notificationPreview = 'ready';

      const list = document.createElement('div');
      list.className = 'notification-preview-list';

      if (notifications.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'md-typescale-body-medium';
        empty.style.padding = '24px 16px';
        empty.textContent = t('notification.empty');
        list.appendChild(empty);
      } else {
        notifications.forEach((notification) => {
          // For reply notifications, we want to show:
          // 1. The actual reply text (from notification.record.text)
          // 2. The parent post context (from postsByUri using subjectUri or notificationTargetUri)
          const postUri = notification.reason === 'reply' && notification.subjectUri
            ? notification.subjectUri
            : notificationTargetUri(notification);
          const post = postsByUri.get(postUri);
          list.appendChild(createNotificationItem(notification, post));
        });
      }

      container.appendChild(list);
    } catch (error) {
      console.error('Notification preview load error:', error);
    } finally {
      rendering = false;
      if (observer) {
        observer.observe(document.getElementById('notifications'), { childList: true });
      }
    }
  }

function refreshPreview() {
  lastNotificationSignature = '';
  void fetchAndRender();
}

function setup() {
    injectStyles();
    const container = document.getElementById('notifications');
    if (!container) {
      setTimeout(setup, 100);
      return;
    }

    observer = new MutationObserver(() => {
      if (rendering) return;
      // Only refresh when container is empty (avoid fighting with main.js)
      if (container.children.length === 0 && !isPreviewRendered(container)) {
        refreshPreview();
      }
    });
    observer.observe(container, { childList: true });

    const card = document.getElementById('notifications-card');
    if (card) {
      viewObserver = new MutationObserver(() => {
        if (card.hidden === false && !rendering) {
          refreshPreview();
        }
      });
      viewObserver.observe(card, { attributes: true, attributeFilter: ['hidden', 'style'] });
    }

    window.refreshNotificationPreview = refreshPreview;

    fetchAndRender();

    document.getElementById('notificationsRefreshBtn')?.addEventListener('click', refreshPreview);
    document.getElementById('notificationsSeenBtn')?.addEventListener('click', () => {
      lastNotificationSignature = '';
      setTimeout(fetchAndRender, 350);
    });
  }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup, { once: true });
} else {
  setup();
}
