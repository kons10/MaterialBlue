// static/src/bsky-client.js を読み込み（Hugo は static/ 以下をルートとして配信するよ）
import { createBskyClient } from '/src/bsky-client.js';
import { initI18n, t, formatDate, formatRelativeTime, formatCompactNumber, setLocale, getCurrentLocale } from '/src/i18n.js';

// mb-post コンポーネントを登録
import '/src/components/mb-post.js';

// ============================================================================
// 定数・設定
// ============================================================================
const MAX_IMAGES = 4;
const MAX_POST_GRAPHEMES = 300;
const ERROR_DISPLAY_DURATION = 5000;
const SUCCESS_DISPLAY_DURATION = 3000;

/**
 * Grapheme（ユーザーが認識する文字）の数を数える
 * 絵文字、結合文字などを1文字として数える
 * @param {string} text - 数えるテキスト
 * @returns {number} グラフェムの数
 */
function countGraphemes(text) {
  if (!text) return 0;
  
  // 正規表現を使ってグラフェムクラスターを分割
  // この実装は基本的な絵文字と結合文字に対応
  const graphemeRegex = /[\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?=[^\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g;
  const matches = text.match(graphemeRegex);
  return matches ? matches.length : 0;
}

// ============================================================================
// クライアント初期化
// ============================================================================
const client = createBskyClient();

// ============================================================================
// DOM 要素のキャッシュ
// ============================================================================
const elements = {
  loginBtn: document.getElementById('loginBtn'),
  timelineCard: document.getElementById('timeline-card'),
  notificationsCard: document.getElementById('notifications-card'),
  refreshBtn: document.getElementById('refreshBtn'),
  seeMoreBtn: document.getElementById('seeMoreBtn'),
  timelineBottom: document.getElementById('timelineBottom'),
  logoutBtn: document.getElementById('logoutBtn'),
  notificationsRefreshBtn: document.getElementById('notificationsRefreshBtn'),
  notificationsSeenBtn: document.getElementById('notificationsSeenBtn'),
  postBtn: document.getElementById('postBtn'),
  imageUploadBtn: document.getElementById('imageUploadBtn'),
  imageInput: document.getElementById('imageInput'),
  imageCount: document.getElementById('imageCount'),
  imagePreview: document.getElementById('imagePreview'),
  loading: document.getElementById('loading'),
  errorMessage: document.getElementById('errorMessage'),
  settingsCard: document.getElementById('settings-card'),
  clearCacheBtn: document.getElementById('clearCacheBtn'),
  clearCookiesBtn: document.getElementById('clearCookiesBtn'),
  loginCard: document.getElementById('login'),
  timeline: document.getElementById('timeline'),
  notifications: document.getElementById('notifications'),
  postText: document.getElementById('postText'),
};

// ============================================================================
// アプリケーション状態
// ============================================================================
let timelineLoading = false;
let timelineCursor = null;
let timelineHasMore = false;
let notificationsLoading = false;
let selectedImages = [];

// エラーメッセージ表示関数（i18n 対応）
function showError(messageKey, params = {}) {
  if (!errorMessage) return;
  const message = t(messageKey, params);
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// 成功メッセージ表示関数（i18n 対応）
function showSuccess(messageKey, params = {}) {
  if (!errorMessage) return;
  const message = t(messageKey, params);
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  
  errorMessage.style.background = 'var(--md-sys-color-primary-container, #bbdefb)';
  errorMessage.style.color = 'var(--md-sys-color-on-primary-container, #0d47a1)';
  
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, SUCCESS_DISPLAY_DURATION);
}

/**
 * ローディング表示の切り替え
 */
function showLoading(show) {
  const { loading } = elements;
  if (!loading) return;
  loading.style.display = show ? 'block' : 'none';
}

/**
 * パスの正規化（末尾のスラッシュ確保）
 */
function normalizePath(pathname) {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/**
 * クライアントサイドナビゲーション
 */
function navigateTo(path) {
  const target = normalizePath(path);
  if (normalizePath(window.location.pathname) !== target) {
    window.history.pushState({}, '', target);
    initializeView();
  }
}

/**
 * ナビゲーションイベントの処理可否判定
 */
function shouldHandleClientNavigation(event) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * カードの表示/非表示を管理
 */
function showCard(activeCardId) {
  const cardStates = {
    login: activeCardId === 'login',
    timeline: activeCardId === 'timeline',
    notifications: activeCardId === 'notifications',
    settings: activeCardId === 'settings',
  };
  
  Object.entries(cardStates).forEach(([key, isVisible]) => {
    const card = elements[`${key}Card`];
    if (!card) return;
    
    card.hidden = !isVisible;
    card.style.display = isVisible ? 'block' : 'none';
  });
}

bootstrap();

window.addEventListener('popstate', () => {
  initializeView();
});

document.querySelectorAll('.sidebar-nav md-text-button').forEach((link) => {
  link.addEventListener('mouseenter', () => {
    // SPA では HTML ドキュメントの prefetch は不要。ナビゲーションはクライアント側で処理されるため
    // 代わりに必要に応じてデータのみを事前ロードする
  }, { passive: true });

  link.addEventListener('click', (event) => {
    if (!shouldHandleClientNavigation(event)) return;
    const href = link.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    navigateTo(href);
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('sidebar-collapsed');
    }
  });
});


async function bootstrap() {
  try {
    // i18n を初期化
    await initI18n();
    
    await client.ready();
  } catch (e) {
    console.error('Client initialization failed:', e);
    // セッション復元に失敗してもアプリは続行（未ログイン状態として扱う）
  }
  initializeView();
}

if (loginBtn) loginBtn.addEventListener('click', async () => {
  const id = document.getElementById('id').value.trim();
  const pw = document.getElementById('pw').value.trim();
  const pds = document.getElementById('pds').value.trim();
  
  if (!id || !pw || !pds) {
    showError('login.required');
    return;
  }
  
  loginBtn.disabled = true;
  showLoading(true);
  
  try {
    await client.login(id, pw, pds);
    // Reload and replace the login entry so browser back cannot return to it.
    window.location.replace('/home/');
  } catch (e) {
    showError('errors.loginFailed');
  } finally {
    loginBtn.disabled = false;
    showLoading(false);
  }
});

if (refreshBtn) refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  await loadTimeline(true);
  refreshBtn.disabled = false;
});

if (seeMoreBtn) seeMoreBtn.addEventListener('click', async () => {
  seeMoreBtn.disabled = true;
  await loadTimeline(false, true);
  seeMoreBtn.disabled = false;
});

if (notificationsRefreshBtn) notificationsRefreshBtn.addEventListener('click', async () => {
  notificationsRefreshBtn.disabled = true;
  try {
    await loadNotifications();
  } catch (e) {
    showError('errors.fetchFailed');
  } finally {
    notificationsRefreshBtn.disabled = false;
  }
});

if (notificationsSeenBtn) notificationsSeenBtn.addEventListener('click', async () => {
  notificationsSeenBtn.disabled = true;
  try {
    await client.markNotificationsSeen();
    await loadNotifications();
    showSuccess('notifications.markedAsSeen');
  } catch (e) {
    showError('errors.notificationFailed');
  } finally {
    notificationsSeenBtn.disabled = false;
  }
});

if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  await client.logout();
  navigateTo("/login/");
  showLogin();
  syncSidebarByAuthState();
});

// 言語切り替え機能
const localeSelect = document.getElementById('localeSelect');

function syncLocaleSelect() {
  if (!localeSelect) return;
  const current = getCurrentLocale();
  localeSelect.value = current;
}

async function handleLocaleChange(locale) {
  if (!locale) return;
  try {
    await setLocale(locale);
    // 翻訳が反映された状態でページ全体を再読み込み
    location.reload();
  } catch (e) {
    console.error('Locale change failed:', e);
    showError('errors.localeChangeFailed');
  }
}

if (localeSelect) {
  localeSelect.addEventListener('change', () => {
    handleLocaleChange(localeSelect.value);
  });
}

if (clearCacheBtn) clearCacheBtn.addEventListener('click', async () => {
  clearCacheBtn.disabled = true;
  try {
    let cleared = false;
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
      cleared = true;
    }
    
    if (cleared) {
      showSuccess('settings.cacheCleared');
    } else {
    showError('errors.cacheNotSupported');
    }
  } catch (e) {
    showError('errors.cacheDeleteError');
  } finally {
    clearCacheBtn.disabled = false;
  }
});

if (clearCookiesBtn) clearCookiesBtn.addEventListener('click', async () => {
  if (!confirm('本当にCookieを全削除しますか？\n（実行するとログアウトされます）')) {
    return;
  }
  clearCookiesBtn.disabled = true;
  try {
    if (client.isLoggedIn) {
      await client.logout();
    }
    
    // 全Cookie削除
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      const trimmedName = name.trim();
      document.cookie = `${trimmedName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${trimmedName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;Secure;SameSite=Lax`;
    }
    
    showSuccess('settings.cookiesCleared');
    setTimeout(() => {
      window.location.href = '/login/';
    }, 1500);
  } catch (e) {
    showError('errors.cookieDeleteError');
    clearCookiesBtn.disabled = false;
  }
});

/**
 * 投稿処理の設定
 */
function setupPostHandler() {
  const { postBtn, postText } = elements;
  if (!postBtn) return;

  postBtn.addEventListener('click', async () => {
    const text = getPostText(postText);

    if (!text && selectedImages.length === 0) {
      showError('post.required');
      return;
    }

    // グラフェム数をチェック
    const graphemeCount = countGraphemes(text);
    if (graphemeCount > MAX_POST_GRAPHEMES) {
      showError('errors.graphemeLimit', { count: graphemeCount });
      return;
    }

    postBtn.disabled = true;
    postBtn.textContent = t('post.posting');

    try {
      console.log('投稿開始:', { text, imageCount: selectedImages.length, graphemeCount });

      if (selectedImages.length > 0) {
        await client.postWithImage(text, selectedImages);
        selectedImages = [];
        updateImagePreview();
      } else {
        await client.post(text);
      }

      clearPostText(postText);
      showSuccess('投稿しました！');
      await loadTimeline(true);
    } catch (e) {
      console.error('投稿エラー詳細:', e);
      showError(`投稿エラー：${e.message}`);
    } finally {
      postBtn.disabled = false;
      postBtn.innerHTML = '<md-icon slot="icon">send</md-icon>' + t('post.submit');
    }
  });
}

/**
 * 投稿テキストの取得（shadow DOM 対応）
 */
function getPostText(postTextField) {
  if (postTextField?.value) {
    return postTextField.value.trim();
  }

  // shadow DOM 内の textarea から直接取得
  const textarea = postTextField?.querySelector('textarea') ||
                   postTextField?.shadowRoot?.querySelector('textarea') ||
                   postTextField?.shadowRoot?.querySelector('input');
  return textarea ? textarea.value.trim() : '';
}

/**
 * 投稿テキストのクリア（shadow DOM 対応）
 */
function clearPostText(postTextField) {
  if (postTextField?.value) {
    postTextField.value = '';
  } else {
    const textarea = postTextField?.querySelector('textarea') || 
                     postTextField?.shadowRoot?.querySelector('textarea');
    if (textarea) textarea.value = '';
  }
}

setupPostHandler();

/**
 * 画像アップロードボタンの設定
 */
if (elements.imageUploadBtn) {
  elements.imageUploadBtn.addEventListener('click', () => {
    elements.imageInput.click();
  });
}

/**
 * 画像選択時の処理
 */
if (elements.imageInput) {
  elements.imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const remainingSlots = MAX_IMAGES - selectedImages.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
      showError(`画像は最大${MAX_IMAGES}枚まで添付できます。残り${remainingSlots}枚です。`);
    }
    
    filesToAdd.forEach(file => {
      selectedImages.push(file);
    });
    
    updateImagePreview();
    elements.imageInput.value = '';
  });
}

/**
 * 画像プレビューの更新
 */
function updateImagePreview() {
  const { imagePreview, imageCount } = elements;
  
  // 既存の画像 URL を解放
  Array.from(imagePreview.querySelectorAll('img')).forEach((img) => {
    if (img.dataset.objectUrl) {
      URL.revokeObjectURL(img.dataset.objectUrl);
    }
  });
  
  imagePreview.innerHTML = '';
  imageCount.textContent = selectedImages.length > 0 ? t('post.imageCountSelected', { count: selectedImages.length }) : '';
  
  selectedImages.forEach((file, index) => {
    const container = createImagePreviewItem(file, index);
    imagePreview.appendChild(container);
  });
}

/**
 * 画像プレビューアイテムの作成
 */
function createImagePreviewItem(file, index) {
  const container = document.createElement('div');
  container.style.position = 'relative';
  
  const img = document.createElement('img');
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  img.dataset.objectUrl = objectUrl;
  img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;';
  
  const removeBtn = createImageRemoveButton(index);
  
  container.appendChild(img);
  container.appendChild(removeBtn);
  return container;
}

/**
 * 画像削除ボタンの作成
 */
function createImageRemoveButton(index) {
  const removeBtn = document.createElement('md-icon-button');
  const icon = document.createElement('md-icon');
  icon.textContent = 'close';
  removeBtn.appendChild(icon);
  removeBtn.style.cssText = 'position:absolute;top:-8px;right:-8px;background-color:var(--md-sys-color-error);color:white;border-radius:50%;width:24px;height:24px;font-size:16px;';
  
  removeBtn.addEventListener('click', () => {
    selectedImages.splice(index, 1);
    updateImagePreview();
  });
  
  return removeBtn;
}


/**
 * リプライスレッドの投稿を取得
 */
function getReplyThreadPosts(reply) {
  if (!reply) return [];
  
  const posts = [];
  const { root, parent } = reply;

  if (root?.uri && root.uri !== parent?.uri) {
    posts.push(root);
  }
  if (parent?.uri) {
    posts.push(parent);
  }

  return posts;
}

/**
 * 著者情報行の作成
 */
function createAuthorLine(author = {}, fallbackName = '', nameTypeClass = 'md-typescale-body-large') {
  const authorLine = document.createElement('div');
  authorLine.className = 'post-author-line';

  const displayName = document.createElement('span');
  displayName.className = `post-author-name ${nameTypeClass}`;
  displayName.textContent = author.displayName || author.handle || (fallbackName ? t(fallbackName) : t('post.authorFallback'));
  authorLine.appendChild(displayName);

  if (author.handle) {
    const authorId = document.createElement('span');
    authorId.className = 'post-author-id md-typescale-body-small';
    authorId.textContent = `@${author.handle}`;
    authorLine.appendChild(authorId);
  }

  return authorLine;
}

/**
 * リプライスレッドの追加
 */
function appendReplyThread(supporting, reply) {
  const replyPosts = getReplyThreadPosts(reply);
  if (replyPosts.length === 0) return;

  const threadContainer = createReplyThreadContainer();

  replyPosts.forEach((replyPost) => {
    const card = createReplyCard(replyPost);
    threadContainer.appendChild(card);
  });

  supporting.appendChild(threadContainer);
}

/**
 * リプライスレッドコンテナの作成
 */
function createReplyThreadContainer() {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:10px;padding-left:10px;border-left:3px solid var(--md-sys-color-outline);';
  return container;
}

/**
 * リプライカードの作成
 */
function createReplyCard(replyPost) {
  const replyRecord = replyPost.record || {};
  const replyAuthor = replyPost.author || {};

  const card = document.createElement('div');
  card.style.cssText = 'padding:8px;border-radius:12px;background:var(--md-sys-color-surface-container-high);';

  const author = createAuthorLine(replyAuthor, t('post.replyAuthorFallback'), 'md-typescale-body-small');

  const text = document.createElement('div');
  text.className = 'md-typescale-body-small';
  text.style.whiteSpace = 'pre-wrap';
  text.textContent = replyRecord.text || '';

  card.appendChild(author);
  if (text.textContent) card.appendChild(text);
  return card;
}

/**
 * サイドバーの認証状態同期
 */
function syncSidebarByAuthState() {
  const loginNav = document.querySelector('[data-nav-item="login"]');
  const composerNav = document.querySelector('[data-nav-item="composer"]');
  const timelineNav = document.querySelector('[data-nav-item="timeline"]');
  const notificationsNav = document.querySelector('[data-nav-item="notifications"]');
  const settingsNav = document.querySelector('[data-nav-item="settings"]');

  const loggedIn = client.isLoggedIn;
  
  if (loginNav) {
    loginNav.style.display = loggedIn ? 'none' : 'flex';
    loginNav.setAttribute('aria-disabled', loggedIn ? 'true' : 'false');
  }

  [composerNav, timelineNav, notificationsNav].forEach((navItem) => {
    if (!navItem) return;
    navItem.style.display = loggedIn ? 'flex' : 'none';
    navItem.setAttribute('aria-disabled', loggedIn ? 'false' : 'true');
  });

  if (settingsNav) {
    settingsNav.style.display = 'flex';
    settingsNav.setAttribute('aria-disabled', 'false');
  }
}

/**
 * アクティブなサイドバーアイテムの設定
 */
function setActiveSidebarItem(key) {
  document.querySelectorAll('.sidebar-nav md-text-button').forEach((link) => {
    link.classList.toggle('active', link.dataset.navItem === key);
  });
}

/**
 * ビューの初期化（ルーティング）
 */
function initializeView() {
  syncSidebarByAuthState();
  const path = normalizePath(window.location.pathname);

  const routeHandlers = {
    '/settings/': () => showSettings(),
    '/home/': () => client.isLoggedIn ? showTimeline() : navigateToLogin(),
    '/notifications/': () => client.isLoggedIn ? showNotifications() : navigateToLogin(),
    '/login/': () => client.isLoggedIn ? navigateToHome() : showLogin(),
  };

  const handler = routeHandlers[path];
  if (handler) {
    handler();
    return;
  }

  // デフォルトルート
  if (client.isLoggedIn) {
    navigateToHome();
  } else {
    navigateToLogin();
  }
}

function navigateToLogin() {
  navigateTo('/login/');
  showLogin();
}

function navigateToHome() {
  navigateTo('/home/');
  showTimeline();
}

/**
 * ログイン画面表示
 */
function showLogin() {
  showCard('login');
  setActiveSidebarItem('login');
}

/**
 * タイムライン画面表示
 */
function showTimeline() {
  showCard('timeline');
  setActiveSidebarItem('timeline');
  loadTimeline();
}

/**
 * 通知画面表示
 */
function showNotifications() {
  showCard('notifications');
  setActiveSidebarItem('notifications');
  loadNotifications();
}

/**
 * 設定画面表示
 */
function showSettings() {
  showCard('settings');
  setActiveSidebarItem('settings');
  syncLocaleSelect();
}

async function loadTimeline(force = false, append = false) {
  if (timelineLoading) return;
  if (append && !timelineHasMore) return;

  timelineLoading = true;
  showLoading(true);
  updateSeeMoreButton(true);
  try {
    await client.syncBookmarks();
    const page = append
      ? await client.timelinePage(20, { cursor: timelineCursor })
      : await client.timelinePage(20, { force });
    const feed = page.feed || [];
    timelineCursor = page.cursor;
    timelineHasMore = Boolean(page.cursor);

    const container = document.getElementById('timeline');
    if (!container) return;

    const existingPostUris = new Set(
      Array.from(container.querySelectorAll('mb-post[data-post-uri]'))
        .map((item) => item.dataset.postUri)
    );

    if (feed.length === 0 && container.children.length > 0) {
      showError(append ? 'notifications.noMorePosts' : 'notifications.noNewPosts');
      return;
    }

    // mb-post 要素を生成
    const fragment = document.createDocumentFragment();

    feed.forEach(item => {
      const post = item.post;
      if (!post?.uri || existingPostUris.has(post.uri)) return;
      existingPostUris.add(post.uri);
      const reason = item.reason;
      const isRepost = reason?.$type === 'app.bsky.feed.defs#reasonRepost';

      // repost情報をpostに付与（mb-post側で表示するため）
      if (isRepost) {
        post.reason = reason;
      }

      const postEl = document.createElement('mb-post');
      postEl.post = post;
      postEl.translator = t;
      postEl.formatters = { formatRelativeTime, formatCompactNumber };
      postEl.actions = {
        requestText: ({ kind }) => window.prompt(t(kind === 'quote' ? 'post.quotePrompt' : 'post.replyPrompt')),
        reply: ({ post: target, text, reply }) => client.reply(target.uri, target.cid, text, reply),
        repost: ({ post: target }) => client.repost(target.uri, target.cid),
        unrepost: ({ repostUri }) => client.unrepost(repostUri),
        quote: ({ post: target, text }) => client.quote(target.uri, target.cid, text),
        like: ({ post: target }) => client.like(target.uri, target.cid),
        unlike: ({ likeUri }) => client.unlike(likeUri),
        isSaved: ({ post: target }) => client.isSaved?.(target.uri) || false,
        save: ({ post: target }) => client.save(target.uri, target.cid),
        unsave: ({ post: target }) => client.unsave(target.uri, target.cid),
        share: async ({ post: target, url }) => {
          if (!url) return;
          if (navigator.share) {
            try {
              await navigator.share({ title: t('post.shareTitle', { handle: target.author?.handle || '' }), text: target.record?.text || '', url });
            } catch (error) {
              if (error.name !== 'AbortError') throw error;
            }
          } else {
            await navigator.clipboard.writeText(url);
          }
        },
      };
      postEl.dataset.postUri = post.uri;

      fragment.appendChild(postEl);

      // 区切り線
      const divider = document.createElement('md-divider');
      fragment.appendChild(divider);
    });

    if (fragment.childNodes.length === 0) {
      showError(append ? 'notifications.noMorePosts' : 'notifications.noNewPosts');
      return;
    }

    if (append) {
      container.appendChild(fragment);
    } else {
      container.insertBefore(fragment, container.firstChild);
    }

    // mb-post からのイベントをリッスンしてタイムライン更新
    setupMbPostListeners();
  } catch (e) {
    console.error('Timeline load error:', e);
    showError('errors.fetchFailed');
  } finally {
    showLoading(false);
    timelineLoading = false;
    updateSeeMoreButton(false);
  }
}

function setupMbPostListeners() {
  // 重複登録防止
  if (window.__mbPostListenersSetup) return;
  window.__mbPostListenersSetup = true;

  document.addEventListener('mb-post-open-url', (event) => {
    const url = event.detail?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  });

  document.addEventListener('mb-post:like', () => {
    // 必要ならローカル状態更新、またはタイムライン再読み込み
  });

  document.addEventListener('mb-post:repost', () => {
    // リポスト後はタイムライン再読み込みが安全
    loadTimeline(true);
  });

  document.addEventListener('mb-post:reply', () => {
    loadTimeline(true);
  });

  document.addEventListener('mb-post:quote', () => {
    loadTimeline(true);
  });

  document.addEventListener('mb-post:save', () => {
    // ブックマークは即時反映されるので再読み込み不要
  });
}


function getNotificationReasonLabel(reason) {
  const keyMap = {
    like: 'notification.label.like',
    repost: 'notification.label.repost',
    follow: 'notification.label.follow',
    mention: 'notification.label.mention',
    reply: 'notification.label.reply',
    quote: 'notification.label.quote'
  };
  const key = keyMap[reason];
  return key ? t(key) : t('notification.label.fallback');
}

function appendNotificationActions(supporting, notification) {
  const post = notification.post;
  if (!post?.uri || !post.cid) return;

  const actionRow = document.createElement('div');
  actionRow.style.display = 'flex';
  actionRow.style.gap = '8px';
  actionRow.style.alignItems = 'center';
  actionRow.style.marginTop = '10px';
  actionRow.style.flexWrap = 'wrap';

  const createButton = (icon, count) => {
    const button = document.createElement('md-filled-tonal-button');
    button.innerHTML = `<md-icon slot="icon">${icon}</md-icon>${count > 0 ? `<span class="action-count">${count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}</span>` : ''}`;
    return button;
  };

  const replyButton = createButton('reply', post.replyCount ?? 0);
  replyButton.addEventListener('click', async () => {
    const text = window.prompt(t('post.replyPrompt'));
    if (!text || !text.trim()) return;
    replyButton.disabled = true;
    try {
      const trimmed = text.trim();
      const record = notification.record;

      // Build reply context: new reply's parent is the reply record,
      // root is the thread root (from record.reply.root) or the reply record itself
      const root = record?.reply?.root || { uri: notification.uri, cid: notification.cid };
      const parent = { uri: notification.uri, cid: notification.cid };

      await client.reply(parent.uri, parent.cid, trimmed, { root, parent });
      showSuccess('post.replied');
      await loadNotifications();
    } catch (e) {
      showError('errors.replyFailed');
    } finally {
      replyButton.disabled = false;
    }
  });

  const viewer = post.viewer || {};
  let liked = Boolean(viewer.like);
  let likeRecordUri = viewer.like || null;
  let likeCount = post.likeCount ?? 0;
  const likeButton = createButton('favorite', likeCount);
  const updateLikeButton = () => {
    likeButton.innerHTML = `<md-icon class="favorite-icon${liked ? ' is-filled' : ''}" slot="icon">favorite</md-icon>${likeCount > 0 ? `<span class="action-count">${likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}K` : likeCount}</span>` : ''}`;
  };
  updateLikeButton();
  likeButton.addEventListener('click', async () => {
    likeButton.disabled = true;
    try {
      if (liked) {
        await client.unlike(likeRecordUri);
        liked = false;
        likeRecordUri = null;
        likeCount = Math.max(0, likeCount - 1);
        showSuccess('post.likeRemoved');
      } else {
        const result = await client.like(post.uri, post.cid);
        liked = true;
        likeRecordUri = result?.uri || null;
        likeCount += 1;
        showSuccess('post.liked');
      }
      updateLikeButton();
    } catch (e) {
      showError('errors.likeFailed');
    } finally {
      likeButton.disabled = false;
    }
  });

  actionRow.append(replyButton, likeButton);
  supporting.appendChild(actionRow);
}

async function loadNotifications() {
  if (notificationsLoading) return;
  notificationsLoading = true;
  showLoading(true);
  try {
    const notifications = await client.notifications();

    // uri は通知レコード、reasonSubject は通知の対象投稿。
    // like/repost では uri が like/repost レコードなので、必ず reasonSubject を優先する。
    const postUris = [...new Set(notifications
      .map((notification) => {
        if (notification.reasonSubject) return notification.reasonSubject;
        if (notification.record?.$type === 'app.bsky.feed.post') return notification.uri || null;
        return null;
      })
      .filter(Boolean))];

    const posts = await client.posts(postUris);
    const postsByUri = new Map(posts.map((post) => [post.uri, post]));

    notifications.forEach((notification) => {
      const targetUri = notification.reasonSubject ||
        (notification.record?.$type === 'app.bsky.feed.post' ? notification.uri : null);
      notification.targetPostUri = targetUri || null;
      notification.post = targetUri ? (postsByUri.get(targetUri) || null) : null;
    });

    window.__materialBlueNotifications = notifications;
    window.dispatchEvent(new CustomEvent('materialblue:notifications', { detail: { notifications } }));
    updateNotificationBadge(notifications);
  } catch (e) {
    console.error('Notifications load error:', e);
    showError('errors.fetchFailed');
  } finally {
    showLoading(false);
    notificationsLoading = false;
  }
}

function updateNotificationBadge(notifications) {
  const notificationsNav = document.querySelector('[data-nav-item="notifications"]');
  if (!notificationsNav) return;

  // 既存バッジを削除
  const existingBadge = notificationsNav.querySelector('.notification-badge');
  if (existingBadge) existingBadge.remove();

  const unreadCount = notifications.filter(n => !n.isRead).length;
  if (unreadCount === 0) return;

  const badge = document.createElement('span');
  badge.className = 'notification-badge';
  badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  notificationsNav.appendChild(badge);
}

function updateSeeMoreButton(loadingMore) {
  if (!timelineBottom || !seeMoreBtn) return;
  timelineBottom.style.display = timelineHasMore ? 'flex' : 'none';
  seeMoreBtn.disabled = loadingMore || !timelineHasMore;
  seeMoreBtn.innerHTML = loadingMore
    ? '<md-icon slot="icon">hourglass_empty</md-icon>読み込み中...'
    : '<md-icon slot="icon">expand_more</md-icon>See more';
}

// エンターキーで投稿（Ctrl+Enter または Cmd+Enter）
const postTextarea = document.querySelector('#postText textarea[slot="textarea"]');
if (postTextarea) {
  postTextarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!postBtn.disabled) {
        postBtn.click();
      }
    }
  });
}
