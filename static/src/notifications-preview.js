import { t, getCurrentLocale } from '/src/i18n.js';

let rendering = false;
let activeTab = 'all';
let currentNotifications = [];

const reasonKeys = {
  like: 'notification.reason.like',
  repost: 'notification.reason.repost',
  reply: 'notification.reason.reply',
  quote: 'notification.reason.quote',
  mention: 'notification.reason.mention',
  follow: 'notification.reason.follow',
};

function avatar(src, alt = '') {
  const img = document.createElement('img');
  img.className = 'notification-avatar';
  img.alt = alt;
  img.loading = 'lazy';
  if (src) img.src = src;
  img.addEventListener('error', () => img.removeAttribute('src'), { once: true });
  return img;
}

function relativeTime(value) {
  if (!value) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const units = [
    ['年', 31536000], ['か月', 2592000], ['週間', 604800],
    ['日', 86400], ['時間', 3600], ['分', 60],
  ];
  for (const [label, size] of units) {
    if (seconds >= size) return Math.floor(seconds / size) + label;
  }
  return 'たった今';
}

function makeIconButton(iconName, label, count = null) {
  const button = document.createElement('span');
  button.className = 'notification-action';
  button.title = label;
  button.setAttribute('aria-label', label);
  const icon = document.createElement('md-icon');
  icon.textContent = iconName;
  button.appendChild(icon);
  if (count !== null && count !== undefined) {
    const value = document.createElement('span');
    value.textContent = String(count);
    button.appendChild(value);
  }
  return button;
}

function createPostActions(post) {
  const actions = document.createElement('div');
  actions.className = 'notification-post-actions';
  actions.append(
    makeIconButton('chat_bubble_outline', '返信', post?.replyCount ?? 0),
    makeIconButton('repeat', 'リポスト'),
    makeIconButton('favorite_border', 'いいね', post?.likeCount ?? 0),
    makeIconButton('bar_chart', '閲覧数', post?.viewCount ?? 0),
    makeIconButton('bookmark_border', 'ブックマーク'),
    makeIconButton('ios_share', '共有'),
  );
  return actions;
}

function createPostContent(post) {
  const content = document.createElement('div');
  content.className = 'notification-post-content';
  const text = post?.record?.text || '';
  if (text) {
    const body = document.createElement('div');
    body.className = 'notification-post-text';
    body.textContent = text;
    content.appendChild(body);
  }

  const images = post?.embed?.images || post?.record?.embed?.images || [];
  if (images.length) {
    const grid = document.createElement('div');
    grid.className = 'notification-post-images';
    images.slice(0, 4).forEach((image) => {
      const img = document.createElement('img');
      img.className = 'notification-post-image';
      img.loading = 'lazy';
      img.alt = image.alt || '';
      img.src = image.thumbnail || image.fullsize || '';
      grid.appendChild(img);
    });
    content.appendChild(grid);
  }
  return content;
}

function createActorRow(notification, post, grouped = []) {
  const item = document.createElement('article');
  item.className = 'notification-preview-item';

  const actors = grouped.length ? grouped : [notification];
  const reason = notification.reason;
  const isReaction = reason === 'like' || reason === 'repost';
  const activity = document.createElement('div');
  activity.className = 'notification-activity';

  const icon = document.createElement('md-icon');
  const activityIcons = {
    like: 'favorite',
    repost: 'repeat',
    reply: 'chat_bubble',
    quote: 'format_quote',
    mention: 'alternate_email',
    follow: 'person_add',
  };
  icon.className = 'notification-activity-icon notification-activity-' + reason;
  icon.textContent = activityIcons[reason] || 'notifications';
  icon.setAttribute('aria-hidden', 'true');
  activity.appendChild(icon);

  const avatars = document.createElement('div');
  avatars.className = 'notification-actor-avatars';
  actors.slice(0, 7).forEach((actor) => {
    avatars.appendChild(avatar(actor.author?.avatar, actor.author?.handle || ''));
  });
  activity.appendChild(avatars);

  const description = document.createElement('div');
  description.className = 'notification-activity-description';
  const names = actors.slice(0, 2).map((actor) =>
    actor.author?.displayName || actor.author?.handle || t('notification.sourceFallback')
  );
  const label = document.createElement('span');
  label.className = 'notification-activity-names';
  label.textContent = names.join('、') + (actors.length > 2 ? ' ほか' + (actors.length - 2) + '人' : '');
  description.appendChild(label);

  const action = document.createElement('span');
  action.textContent = reasonKeys[reason] ? t(reasonKeys[reason]) : t('notification.reason.unknown', { action: reason || '通知' });
  description.appendChild(action);

  const time = document.createElement('span');
  time.className = 'notification-time';
  time.textContent = ' · ' + relativeTime(notification.indexedAt);
  description.appendChild(time);
  activity.appendChild(description);
  item.appendChild(activity);

  const ownText = notification.record?.text?.trim();
  const targetText = post?.record?.text?.trim();
  if (ownText && ownText !== targetText) {
    const reply = document.createElement('div');
    reply.className = 'notification-own-text';
    reply.textContent = ownText;
    item.appendChild(reply);
  }

  if (post) {
    const postBlock = document.createElement('div');
    postBlock.className = 'notification-target-post';
    postBlock.appendChild(createPostContent(post));
    if (!isReaction) postBlock.appendChild(createPostActions(post));
    item.appendChild(postBlock);
  } else if (ownText && ownText === targetText) {
    const reply = document.createElement('div');
    reply.className = 'notification-own-text';
    reply.textContent = ownText;
    item.appendChild(reply);
  }
  return item;
}

function buildEntries(notifications) {
  const entries = [];
  const reactionGroups = new Map();

  notifications.forEach((notification) => {
    const isReaction = notification.reason === 'like' || notification.reason === 'repost';
    const key = isReaction && notification.targetPostUri
      ? notification.reason + ':' + notification.targetPostUri
      : null;

    if (key) {
      if (!reactionGroups.has(key)) {
        const entry = { notification, post: notification.post || null, grouped: [] };
        reactionGroups.set(key, entry);
        entries.push(entry);
      }
      reactionGroups.get(key).grouped.push(notification);
    } else {
      entries.push({ notification, post: notification.post || null, grouped: [] });
    }
  });
  return entries;
}

function renderNotifications(notifications = currentNotifications) {
  const container = document.getElementById('notifications');
  if (!container || rendering) return;
  rendering = true;
  currentNotifications = notifications;

  try {
    const list = document.createElement('div');
    list.className = 'notification-preview-list';
    const filtered = activeTab === 'mentions'
      ? notifications.filter((item) => ['mention', 'reply', 'quote'].includes(item.reason))
      : notifications;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'notification-preview-empty';
      empty.textContent = t('notification.empty');
      list.appendChild(empty);
    } else {
      buildEntries(filtered).forEach(({ notification, post, grouped }) => {
        list.appendChild(createActorRow(notification, post, grouped));
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

  // Let Material Web own tab selection, keyboard interaction and indicator rendering.
  const tabs = document.getElementById('notificationsTabs');
  tabs?.addEventListener('change', () => {
    activeTab = tabs.activeTab?.dataset.notificationTab || 'all';
    renderNotifications();
  });

  const settingsButton = document.getElementById('notificationsSettingsBtn');
  const actions = document.getElementById('notificationsActions');
  settingsButton?.addEventListener('click', () => {
    if (!actions) return;
    actions.hidden = !actions.hidden;
  });

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
