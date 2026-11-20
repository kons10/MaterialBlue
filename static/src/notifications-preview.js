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

import './components/mb-notification.js';

function createActorRow(notification, post, grouped = []) {
  const item = document.createElement('mb-notification');
  item.notification = notification;
  item.post = post;
  item.groupedNotifications = grouped;
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
