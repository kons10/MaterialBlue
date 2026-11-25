import { t, formatRelativeTime, formatCompactNumber } from '/src/i18n.js';
import '/src/components/mb-notification.js';

// 通知欄のレンダリングは mb-notification（Web Components）が担当する。
// このモジュール（ホスト側）の責務:
// - 通知データの整形（グループ化・アクター抽出）
// - translator / formatters の注入
// - API通信・既読化などのアプリケーション処理（main.js 側で実施）
// 投稿本文の再実装は行わない（返信系は mb-notification 経由で mb-post を再利用）。

let rendering = false;
let activeTab = 'all';
let currentNotifications = [];

const formatters = {
  relativeTime: (value) => {
    try {
      return formatRelativeTime(value);
    } catch {
      return value || '';
    }
  },
  compactNumber: formatCompactNumber,
};

/** ホスト側で通知をまとめた項目（entry）を作る。複数人の集約表示もここで整形する。 */
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
        const entry = { notification, post: notification.post || null, actors: [] };
        reactionGroups.set(key, entry);
        entries.push(entry);
      }
      reactionGroups.get(key).actors.push(notification);
    } else {
      entries.push({ notification, post: notification.post || null, actors: [notification] });
    }
  });
  return entries;
}

/** 1件の通知項目を mb-notification として生成する（投稿UIの組み立ては委譲）。 */
function createNotificationItem(entry) {
  const item = document.createElement('mb-notification');
  item.translator = t;
  item.formatters = formatters;
  item.actors = entry.actors;
  item.notification = entry.notification; // isRead から unread 属性を反映する
  item.post = entry.post;
  return item;
}

function renderNotifications(notifications = currentNotifications) {
  const container = document.getElementById('notifications');
  if (!container || rendering) return;
  rendering = true;
  currentNotifications = notifications;

  try {
    const list = document.createElement('div');
    list.className = 'notification-preview-list mb-notification-list';
    list.setAttribute('role', 'list');
    const filtered = activeTab === 'mentions'
      ? notifications.filter((item) => ['mention', 'reply', 'quote'].includes(item.reason))
      : notifications;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'notification-preview-empty';
      empty.textContent = t('notification.empty');
      list.appendChild(empty);
    } else {
      buildEntries(filtered).forEach((entry) => {
        list.appendChild(createNotificationItem(entry));
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
