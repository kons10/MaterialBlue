// mb-notification — 通知一覧の1項目を表示するコンポーネント
//
// 設計方針: .docs/post-notification-components.md
// - 通知という「出来事・文脈」を表示する（通知種別アイコン、アクター、通知文、通知時刻、未読状態）。
// - 対象投稿がある場合:
//   - いいね / リポスト → アクションボタンのない簡易プレビュー（通知専用UI）
//   - 返信 / 引用 / メンション → 対象投稿は mb-post に委譲（投稿UIを再実装しない）
//   - フォローなど対象投稿がない通知 → 投稿領域を表示しない
// - 通知API・既読化APIの呼び出し、取得・ページング・認証は行わない（ホスト側担当）。
// - データはJSプロパティで受け取る。表示用CSSは外部スタイルシート（/css/mb-notification.css）。

import './mb-post.js';

const FALLBACK_TRANSLATOR = (key) => key;

const REASON_ICONS = {
  like: 'favorite',
  repost: 'repeat',
  reply: 'chat_bubble',
  quote: 'format_quote',
  mention: 'alternate_email',
  follow: 'person_add',
};

const REASON_LABEL_KEYS = {
  like: 'notification.reason.like',
  repost: 'notification.reason.repost',
  reply: 'notification.reason.reply',
  quote: 'notification.reason.quote',
  mention: 'notification.reason.mention',
  follow: 'notification.reason.follow',
};

class MbNotification extends HTMLElement {
  static get observedAttributes() {
    return ['unread'];
  }

  constructor() {
    super();
    this._notification = null;
    this._actors = [];
    this._post = null;
    this._translator = FALLBACK_TRANSLATOR;
    this._formatters = {};
    this._actions = {};
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  // ------------------------------------------------------------------
  // ホスト注入用のプロパティAPI
  // ------------------------------------------------------------------

  /** 通知理由・通知時刻・未読状態などの通知データ */
  set notification(value) {
    this._notification = value || null;
    if (value && typeof value.isRead === 'boolean') {
      this.toggleAttribute('unread', !value.isRead);
    }
    this.render();
  }

  get notification() {
    return this._notification;
  }

  /** 通知したユーザーの表示情報（複数人をまとめた整形済み配列をホストが渡す） */
  set actors(value) {
    this._actors = Array.isArray(value) ? value : [];
    this.render();
  }

  /** 通知対象の投稿。返信系では mb-post に渡す。いいね・リポストでは簡易プレビューに使う。 */
  set post(value) {
    this._post = value || null;
    this.render();
  }

  get post() {
    return this._post;
  }

  set translator(fn) {
    this._translator = typeof fn === 'function' ? fn : FALLBACK_TRANSLATOR;
    this.render();
  }

  set formatters(value) {
    this._formatters = value && typeof value === 'object' ? value : {};
    this.render();
  }

  /** 必要な場合に限りホストが提供する操作ハンドラー { open, openPost } 等 */
  set actions(value) {
    this._actions = value && typeof value === 'object' ? value : {};
    this.render();
  }

  get unread() {
    return this.hasAttribute('unread');
  }

  t(key, params) {
    try {
      return this._translator(key, params) || key;
    } catch {
      return key;
    }
  }

  formatRelativeTime(value) {
    if (!value) return '';
    if (typeof this._formatters.relativeTime === 'function') {
      return this._formatters.relativeTime(value);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  }

  // ------------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------------

  render() {
    if (!this.isConnected) return;
    const notification = this._notification;
    if (!notification) {
      this.replaceChildren();
      return;
    }

    const reason = notification.reason || 'unknown';
    const frag = document.createDocumentFragment();

    // --- 通知ヘッダー: 種別アイコン / アバター / 名前 / 通知文 / 時刻 ---
    const header = document.createElement('div');
    header.className = 'mb-notification-header';

    const icon = document.createElement('md-icon');
    icon.className = `mb-notification-reason-icon mb-notification-reason-${reason}`;
    icon.textContent = REASON_ICONS[reason] || 'notifications';
    icon.setAttribute('aria-hidden', 'true');
    header.appendChild(icon);

    const avatars = document.createElement('div');
    avatars.className = 'mb-notification-avatars';
    (this._actors.length ? this._actors : [notification]).slice(0, 7).forEach((actorItem) => {
      const author = actorItem.author || actorItem;
      const img = document.createElement('img');
      img.className = 'mb-notification-avatar';
      img.alt = author.displayName || author.handle || '';
      img.loading = 'lazy';
      if (author.avatar) {
        img.src = author.avatar;
        img.addEventListener('error', () => img.removeAttribute('src'), { once: true });
      }
      avatars.appendChild(img);
    });
    header.appendChild(avatars);

    const summary = document.createElement('div');
    summary.className = 'mb-notification-summary';

    const names = document.createElement('span');
    names.className = 'mb-notification-names';
    const actorList = this._actors.length ? this._actors : [notification];
    const displayNames = actorList.slice(0, 2).map((actorItem) => {
      const author = actorItem.author || actorItem;
      return author.displayName || author.handle || this.t('notification.sourceFallback');
    });
    names.textContent = displayNames.join('、') +
      (actorList.length > 2 ? ` ${this.t('notification.andOthers', { count: actorList.length - 2 })}` : '');
    summary.appendChild(names);

    const actionLabel = document.createElement('span');
    actionLabel.className = 'mb-notification-action-label';
    actionLabel.textContent = REASON_LABEL_KEYS[reason]
      ? this.t(REASON_LABEL_KEYS[reason])
      : this.t('notification.reason.unknown', { action: reason });
    summary.appendChild(actionLabel);

    const time = document.createElement('time');
    time.className = 'mb-notification-time';
    if (notification.indexedAt) time.dateTime = notification.indexedAt;
    time.textContent = ` · ${this.formatRelativeTime(notification.indexedAt)}`;
    summary.appendChild(time);

    header.appendChild(summary);
    frag.appendChild(header);

    // --- 通知自身のテキスト（返信・引用・メンションで本文がある場合） ---
    const ownText = notification.record?.text?.trim();
    const targetText = this._post?.record?.text?.trim();
    if (ownText && ownText !== targetText) {
      const own = document.createElement('div');
      own.className = 'mb-notification-own-text';
      own.textContent = ownText;
      frag.appendChild(own);
    }

    // --- 対象投稿（通知種別に応じた表示） ---
    if (this._post) {
      if (reason === 'like' || reason === 'repost') {
        frag.appendChild(this.createCompactPreview(this._post));
      } else {
        frag.appendChild(this.createPostView(this._post));
      }
    }

    this.replaceChildren(frag);
    this.setAttribute('role', 'listitem');
    this.dataset.notificationReason = reason;
  }

  /** いいね・リポスト通知用の簡易プレビュー（アクションボタンなしの通知専用UI） */
  createCompactPreview(post) {
    const preview = document.createElement('div');
    preview.className = 'mb-notification-preview';

    const text = document.createElement('div');
    text.className = 'mb-notification-preview-text';
    text.textContent = post.record?.text || '';
    preview.appendChild(text);

    const images = post.embed?.images || post.record?.embed?.images || [];
    if (images.length) {
      const grid = document.createElement('div');
      grid.className = 'mb-notification-preview-images';
      images.slice(0, 4).forEach((image) => {
        const img = document.createElement('img');
        img.className = 'mb-notification-preview-image';
        img.loading = 'lazy';
        img.alt = image.alt || '';
        img.src = image.thumbnail || image.fullsize || '';
        grid.appendChild(img);
      });
      preview.appendChild(grid);
    }

    return preview;
  }

  /** 返信・引用・メンション通知: 投稿表示は mb-post に委譲する（再実装しない） */
  createPostView(post) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-notification-target';

    const postEl = document.createElement('mb-post');
    postEl.translator = this._translator;
    postEl.formatters = this._formatters;
    postEl.post = post;
    if (this.mbForwardActions && Object.keys(this._actions || {}).length) {
      postEl.actions = this._actions;
      postEl.setAttribute('show-actions', '');
    }
    wrap.appendChild(postEl);
    return wrap;
  }
}

if (!customElements.get('mb-notification')) {
  customElements.define('mb-notification', MbNotification);
}

export { MbNotification };
