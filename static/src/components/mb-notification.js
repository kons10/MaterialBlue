/**
 * mb-notification - MaterialBlue Notification Web Component
 *
 * Renders notification metadata and delegates target-post rendering to mb-post.
 * Uses Light DOM so themes, userscripts, and browser extensions can customize it.
 *
 * Usage:
 *   const element = document.createElement('mb-notification');
 *   element.notification = notificationView;
 *   element.post = targetPostView;
 *   element.groupedNotifications = groupedNotifications;
 */

import { t, formatRelativeTime, formatCompactNumber } from '../i18n.js';
import './mb-post.js';

const REASONS = {
  like: { icon: 'favorite', key: 'notification.reason.like' },
  repost: { icon: 'repeat', key: 'notification.reason.repost' },
  reply: { icon: 'chat_bubble', key: 'notification.reason.reply' },
  quote: { icon: 'format_quote', key: 'notification.reason.quote' },
  mention: { icon: 'alternate_email', key: 'notification.reason.mention' },
  follow: { icon: 'person_add', key: 'notification.reason.follow' },
};

function createAvatar(author) {
  const image = document.createElement('img');
  image.className = 'mb-notification-avatar';
  image.alt = author?.displayName || author?.handle || '';
  image.loading = 'lazy';
  if (author?.avatar) image.src = author.avatar;
  image.addEventListener('error', () => image.removeAttribute('src'), { once: true });
  return image;
}

function getActorName(actor) {
  return actor?.author?.displayName || actor?.author?.handle || t('notification.sourceFallback');
}

export class MbNotification extends HTMLElement {
  constructor() {
    super();
    this._notification = null;
    this._post = null;
    this._groupedNotifications = [];
    this._client = null;
  }

  set notification(value) {
    this._notification = value || null;
    this.render();
  }
  get notification() { return this._notification; }

  set post(value) {
    this._post = value || null;
    this.render();
  }
  get post() { return this._post; }

  set groupedNotifications(value) {
    this._groupedNotifications = Array.isArray(value) ? value : [];
    this.render();
  }
  get groupedNotifications() { return this._groupedNotifications; }

  set client(value) {
    this._client = value || null;
    this.render();
  }
  get client() { return this._client; }

  connectedCallback() { this.render(); }

  render() {
    if (!this.isConnected || !this._notification) return;

    const notification = this._notification;
    const actors = this._groupedNotifications.length
      ? this._groupedNotifications
      : [notification];
    const reason = notification.reason || 'unknown';
    const reasonInfo = REASONS[reason];
    const article = document.createElement('article');
    article.className = 'mb-notification-item';

    const header = document.createElement('div');
    header.className = 'mb-notification-activity';

    const icon = document.createElement('md-icon');
    icon.className = 'mb-notification-activity-icon mb-notification-' + reason;
    icon.textContent = reasonInfo?.icon || 'notifications';
    icon.setAttribute('aria-hidden', 'true');
    header.appendChild(icon);

    const actorArea = document.createElement('div');
    actorArea.className = 'mb-notification-actors';
    actors.slice(0, 7).forEach((actor) => actorArea.appendChild(createAvatar(actor.author)));
    header.appendChild(actorArea);

    const description = document.createElement('div');
    description.className = 'mb-notification-description';
    const names = actors.slice(0, 2).map(getActorName);
    const name = document.createElement('span');
    name.className = 'mb-notification-names';
    name.textContent = names.join('、') + (actors.length > 2 ? ' ほか' + (actors.length - 2) + '人' : '');
    description.appendChild(name);

    const action = document.createElement('span');
    action.textContent = reasonInfo
      ? t(reasonInfo.key)
      : t('notification.reason.unknown', { action: reason });
    description.appendChild(action);

    const timestamp = notification.indexedAt || notification.record?.createdAt;
    if (timestamp) {
      const time = document.createElement('time');
      time.className = 'mb-notification-time';
      time.dateTime = timestamp;
      time.textContent = ' · ' + formatRelativeTime(timestamp);
      description.appendChild(time);
    }
    header.appendChild(description);
    article.appendChild(header);

    const ownText = notification.record?.text?.trim();
    const targetText = this._post?.record?.text?.trim();
    if (ownText && ownText !== targetText) {
      const text = document.createElement('div');
      text.className = 'mb-notification-own-text';
      text.textContent = ownText;
      article.appendChild(text);
    }

    if (this._post) {
      const post = document.createElement('mb-post');
      post.className = 'mb-notification-post';
      post.post = this._post;
      post.translator = t;
      post.formatters = { formatRelativeTime, formatCompactNumber };
      if (this._client) post.client = this._client;
      article.appendChild(post);
    }

    this.replaceChildren(article);
  }
}

if (!customElements.get('mb-notification')) {
  customElements.define('mb-notification', MbNotification);
}

export default MbNotification;
