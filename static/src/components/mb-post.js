// mb-post — 投稿の共通表示コンポーネント
//
// 設計方針: .docs/post-notification-components.md
// - 投稿そのものの表示（作者・本文・日時・埋め込み・引用・リポスト表示・アクションUI）を担当する。
// - AT Protocol の取得処理・セッション管理は行わない。データと関数はホスト側から注入する。
//   - post / translator / formatters / actions は JS プロパティで受け取る（DOM属性へのJSON文字列化は使わない）。
// - 表示用CSSは直書きせず、外部スタイルシート（/css/mb-post.css）で管理する。
// - 通知理由など通知固有の表示は担当しない（mb-notification が担当）。

const FALLBACK_TRANSLATOR = (key) => key;
const NOOP_ACTIONS = {};

class MbPost extends HTMLElement {
  static get observedAttributes() {
    return ['show-actions', 'compact'];
  }

  constructor() {
    super();
    this._post = null;
    this._translator = FALLBACK_TRANSLATOR;
    this._formatters = {};
    this._actions = NOOP_ACTIONS;
    this.mbThreadContext = [];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  // ------------------------------------------------------------------
  // ホスト注入用のプロパティAPI（設計文書の契約案に合わせる）
  // ------------------------------------------------------------------

  /** AT Protocol PostView 相当の投稿データ */
  set post(value) {
    this._post = value || null;
    this.render();
  }

  get post() {
    return this._post;
  }

  /** UI文字列の翻訳関数 (key, params) => string */
  set translator(fn) {
    this._translator = typeof fn === 'function' ? fn : FALLBACK_TRANSLATOR;
    this.render();
  }

  /** 日時・数値などのフォーマッター { relativeTime?, absoluteTime?, compactNumber? } */
  set formatters(value) {
    this._formatters = value && typeof value === 'object' ? value : {};
    this.render();
  }

  /** ホストが提供する操作ハンドラー { reply, repost, like, unlike, save, unsave, isSaved, ... } */
  set actions(value) {
    this._actions = value && typeof value === 'object' ? value : NOOP_ACTIONS;
    this.render();
  }

  get showActions() {
    return this.hasAttribute('show-actions');
  }

  get compact() {
    return this.hasAttribute('compact');
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

  formatCount(count) {
    if (count === null || count === undefined || count <= 0) return '';
    if (typeof this._formatters.compactNumber === 'function') {
      return this._formatters.compactNumber(count);
    }
    return String(count);
  }

  // ------------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------------

  render() {
    if (!this.isConnected) return;
    const post = this._post;
    if (!post || !post.uri) {
      this.replaceChildren();
      return;
    }

    const record = post.record || {};
    const author = post.author || {};
    const frag = document.createDocumentFragment();

    // リポスト表示（投稿データに付随する表示情報。ホストが整形して渡す）
    const repostedBy = post.mbRepostedBy;
    if (repostedBy) {
      const overline = document.createElement('div');
      overline.className = 'mb-post-repost-label';
      const icon = document.createElement('md-icon');
      icon.textContent = 'repeat';
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = this.t('post.repostedBy', { name: repostedBy });
      overline.append(icon, label);
      frag.appendChild(overline);
    }

    const body = document.createElement('div');
    body.className = 'mb-post-body';

    // 返信スレッド文脈（取得済みデータをホストから受け取るだけ）
    const threadPosts = Array.isArray(this.mbThreadContext) ? this.mbThreadContext : [];
    if (threadPosts.length) {
      const thread = document.createElement('div');
      thread.className = 'mb-post-thread';
      threadPosts.forEach((replyPost) => {
        thread.appendChild(this.createThreadCard(replyPost));
      });
      body.appendChild(thread);
    }

    // 作者行
    body.appendChild(this.createAuthorLine(author));

    // 日時
    const indexedAt = record.createdAt || post.indexedAt;
    if (indexedAt) {
      const time = document.createElement('time');
      time.className = 'mb-post-time';
      time.dateTime = indexedAt;
      time.textContent = this.formatRelativeTime(indexedAt);
      time.title = indexedAt;
      body.appendChild(time);
    }

    // 本文
    if (record.text) {
      const text = document.createElement('div');
      text.className = 'mb-post-text';
      text.textContent = record.text;
      body.appendChild(text);
    }

    // 埋め込み（画像・外部リンク・引用）
    const embeds = this.createEmbeds(post);
    if (embeds.length) body.append(...embeds);

    // アクションUI（ホストが show-actions を有効にした場合のみ）
    if (this.showActions) {
      body.appendChild(this.createActions(post, record));
    }

    frag.appendChild(body);
    this.replaceChildren(frag);
  }

  createAuthorLine(author) {
    const line = document.createElement('div');
    line.className = 'mb-post-author-line';

    const avatar = document.createElement('img');
    avatar.className = 'mb-post-avatar';
    avatar.alt = '';
    avatar.loading = 'lazy';
    if (author.avatar) {
      avatar.src = author.avatar;
      avatar.addEventListener('error', () => avatar.removeAttribute('src'), { once: true });
    }
    line.appendChild(avatar);

    const names = document.createElement('div');
    names.className = 'mb-post-author-names';

    const displayName = document.createElement('span');
    displayName.className = 'mb-post-author-name';
    displayName.textContent = author.displayName || author.handle || this.t('post.authorFallback');
    names.appendChild(displayName);

    if (author.handle) {
      const handle = document.createElement('span');
      handle.className = 'mb-post-author-handle';
      handle.textContent = `@${author.handle}`;
      names.appendChild(handle);
    }
    line.appendChild(names);

    return line;
  }

  createThreadCard(replyPost) {
    const card = document.createElement('div');
    card.className = 'mb-post-thread-card';
    const replyAuthor = replyPost.author || {};
    const replyRecord = replyPost.record || {};

    const name = document.createElement('span');
    name.className = 'mb-post-thread-author';
    name.textContent = replyAuthor.displayName || replyAuthor.handle || this.t('post.replyAuthorFallback');
    card.appendChild(name);

    if (replyRecord.text) {
      const text = document.createElement('div');
      text.className = 'mb-post-thread-text';
      text.textContent = replyRecord.text;
      card.appendChild(text);
    }
    return card;
  }

  createEmbeds(post) {
    const record = post.record || {};
    const nodes = [];
    const embed = post.embed || record.embed || null;

    // 画像
    const images = embed?.images || record?.embed?.images || [];
    if (images.length) {
      const grid = document.createElement('div');
      grid.className = 'mb-post-images';
      images.slice(0, 4).forEach((image) => {
        const img = document.createElement('img');
        img.className = 'mb-post-image';
        img.loading = 'lazy';
        img.alt = image.alt || '';
        img.src = image.thumbnail || image.fullsize || '';
        img.addEventListener('click', () => {
          const src = image.fullsize || image.thumbnail;
          if (src) window.open(src, '_blank', 'noopener');
        });
        grid.appendChild(img);
      });
      nodes.push(grid);
    }

    // 外部リンク
    const external = embed?.external || record?.embed?.external;
    if (external?.uri) {
      const link = document.createElement('a');
      link.className = 'mb-post-external';
      link.href = external.uri;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const title = document.createElement('span');
      title.className = 'mb-post-external-title';
      title.textContent = external.title || external.uri;
      const meta = document.createElement('span');
      meta.className = 'mb-post-external-meta';
      let host = '';
      try { host = new URL(external.uri).host; } catch { host = ''; }
      meta.textContent = external.description || host;
      link.append(title, meta);
      nodes.push(link);
    }

    // 引用投稿（mb-post を再利用した埋め込み表示）
    const embedIsRecord = embed?.$type === 'app.bsky.embed.record#view';
    const quotedView = embedIsRecord ? embed.record : null;
    if (quotedView && quotedView.$type !== 'app.bsky.embed.record#viewNotFound') {
      const wrap = document.createElement('div');
      wrap.className = 'mb-post-quote';
      const child = document.createElement('mb-post');
      child.setAttribute('compact', '');
      child.translator = this._translator;
      child.formatters = this._formatters;
      if (quotedView.$type === 'app.bsky.embed.record#viewDetached') {
        const note = document.createElement('div');
        note.className = 'mb-post-unavailable';
        note.textContent = this.t('notification.targetUnavailable');
        wrap.appendChild(note);
      } else {
        child.post = quotedView;
        wrap.appendChild(child);
      }
      nodes.push(wrap);
    }

    return nodes;
  }

  createActions(post, record) {
    const row = document.createElement('div');
    row.className = 'mb-post-actions';
    const viewer = post.viewer || {};
    const actions = this._actions || {};

    const makeButton = (iconName, labelKey, fallbackLabel, count) => {
      const btn = document.createElement('md-text-button');
      btn.className = 'mb-post-action';
      const label = this.t(labelKey) || fallbackLabel;
      btn.title = label;
      btn.setAttribute('aria-label', label);
      const icon = document.createElement('md-icon');
      icon.setAttribute('slot', 'icon');
      icon.textContent = iconName;
      btn.appendChild(icon);
      const countStr = this.formatCount(count);
      if (countStr) {
        const badge = document.createElement('span');
        badge.className = 'action-count';
        badge.textContent = countStr;
        btn.appendChild(badge);
      }
      return btn;
    };

    // 返信
    const replyBtn = makeButton('chat_bubble_outline', 'post.reply', 'Reply', post.replyCount ?? null);
    replyBtn.dataset.action = 'reply';
    row.appendChild(replyBtn);

    // リポスト
    const repostBtn = makeButton(viewer.repost ? 'repeat_on' : 'repeat', 'post.repost', 'Repost', post.repostCount ?? null);
    repostBtn.dataset.action = 'repost';
    row.appendChild(repostBtn);

    // いいね
    const liked = Boolean(viewer.like);
    const likeBtn = makeButton(liked ? 'favorite' : 'favorite_border', 'post.like', 'Like', post.likeCount ?? null);
    likeBtn.dataset.action = 'like';
    if (liked) likeBtn.classList.add('is-active');
    row.appendChild(likeBtn);

    // ブックマーク（保存状態の判定関数はホストから注入）
    const saved = typeof actions.isSaved === 'function' ? Boolean(actions.isSaved(post.uri)) : false;
    const saveBtn = makeButton(saved ? 'bookmark' : 'bookmark_border', 'post.save', 'Save', null);
    saveBtn.dataset.action = 'save';
    if (saved) saveBtn.classList.add('is-active');
    row.appendChild(saveBtn);

    // 操作の意図をホストへ通知する。API呼び出しはこの要素では行わない。
    row.addEventListener('click', async (event) => {
      const btn = event.target.closest?.('.mb-post-action');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      const intentEvent = new CustomEvent(`mb-post:${action}`, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { post, record, element: this },
      });
      const proceed = this.dispatchEvent(intentEvent);
      if (!proceed) return;

      const handler = this.resolveActionHandler(action, post);
      if (typeof handler === 'function') {
        btn.disabled = true;
        try {
          await handler(post, record);
        } finally {
          btn.disabled = false;
        }
      }
    });

    return row;
  }

  resolveActionHandler(action, post) {
    const actions = this._actions || {};
    const viewer = post.viewer || {};
    switch (action) {
      case 'reply': return actions.reply;
      case 'repost': return viewer.repost ? actions.unrepost : actions.repost;
      case 'like': return viewer.like ? actions.unlike : actions.like;
      case 'save': return (typeof actions.isSaved === 'function' && actions.isSaved(post.uri))
        ? actions.unsave
        : actions.save;
      default: return null;
    }
  }
}

if (!customElements.get('mb-post')) {
  customElements.define('mb-post', MbPost);
}

export { MbPost };
