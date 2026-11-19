import { t, getCurrentLocale } from '/src/i18n.js';

let rendering = false;

const reasonKeyMap = {
  like: 'notification.reason.like',
  repost: 'notification.reason.repost',
  reply: 'notification.reason.reply',
  quote: 'notification.reason.quote',
  mention: 'notification.reason.mention',
  follow: 'notification.reason.follow',
};

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

function renderNotifications(notifications = []) {
  const container = document.getElementById('notifications');
  if (!container || rendering) return;

  rendering = true;
  try {
    const list = document.createElement('div');
    list.className = 'notification-preview-list';

    if (notifications.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notification-preview-empty md-typescale-body-medium';
      empty.textContent = t('notification.empty');
      list.appendChild(empty);
    } else {
      notifications.forEach((notification) => {
        list.appendChild(createNotificationItem(notification, notification.post || null));
      });
    }

    container.replaceChildren(list);
    container.dataset.notificationPreview = 'ready';
  } finally {
    rendering = false;
  }
}

function setup() {
  const container = document.getElementById('notifications');
  if (!container) return;

  window.addEventListener('materialblue:notifications', (event) => {
    renderNotifications(event.detail?.notifications || []);
  });

  if (Array.isArray(window.__materialBlueNotifications)) {
    renderNotifications(window.__materialBlueNotifications);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup, { once: true });
} else {
  setup();
}
