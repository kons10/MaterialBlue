// static/src/bsky-client.js を読み込み（Hugo は static/ 以下をルートとして配信するよ）
import { createBskyClient } from '/src/bsky-client.js';

const client = createBskyClient();
const loginBtn = document.getElementById('loginBtn');
const timelineCard = document.getElementById('timeline-card');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const postBtn = document.getElementById('postBtn');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageInput = document.getElementById('imageInput');
const imageCount = document.getElementById('imageCount');
const imagePreview = document.getElementById('imagePreview');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
let timelineLoading = false;

// 選択された画像を保持する配列
let selectedImages = [];

// エラーメッセージ表示関数
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

bootstrap();

window.addEventListener('popstate', () => {
  initializeView();
});

function shouldHandleClientNavigation(event) {
  return !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

document.querySelectorAll('.sidebar-nav md-filled-tonal-button').forEach((link) => {
  link.addEventListener('mouseenter', () => {
    const href = link.getAttribute('href');
    if (!href) return;
    if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
    const prefetch = document.createElement('link');
    prefetch.rel = 'prefetch';
    prefetch.href = href;
    prefetch.as = 'document';
    document.head.appendChild(prefetch);
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
  await client.ready();
  initializeView();
}

if (loginBtn) loginBtn.addEventListener('click', async () => {
  const id = document.getElementById('id').value.trim();
  const pw = document.getElementById('pw').value.trim();
  
  if (!id || !pw) {
    showError('ハンドルとアプリパスワードを入力してください');
    return;
  }
  
  loginBtn.disabled = true;
  showLoading(true);
  
  try {
    await client.login(id, pw);
    syncSidebarByAuthState();
    navigateTo("/home/");
    showTimeline();
  } catch (e) {
    showError(`ログインエラー：${e.message}`);
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

if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  await client.logout();
  navigateTo("/login/");
  showLogin();
  syncSidebarByAuthState();
});

if (postBtn) postBtn.addEventListener('click', async () => {
  const postTextField = document.getElementById('postText');
  let text = '';
  if (postTextField.value) {
    text = postTextField.value.trim();
  } else {
    // shadow DOM 内の textarea から直接取得
    const textarea = postTextField.querySelector('textarea') || 
                     postTextField.shadowRoot?.querySelector('textarea') ||
                     postTextField.shadowRoot?.querySelector('input');
    text = textarea ? textarea.value.trim() : '';
  }
  
  if (!text && selectedImages.length === 0) {
    showError('投稿内容または画像を入力してください');
    return;
  }
  
  postBtn.disabled = true;
  postBtn.textContent = '投稿中...';
  
  try {
    console.log('投稿開始:', { text, imageCount: selectedImages.length });
    
    if (selectedImages.length > 0) {
      // 画像付き投稿
      await client.postWithImage(text, selectedImages);
      selectedImages = [];
      updateImagePreview();
    } else {
      // テキストのみ投稿
      await client.post(text);
    }
    
    if (postTextField.value) {
      postTextField.value = '';
    } else {
      const textarea = postTextField.querySelector('textarea') || 
                       postTextField.shadowRoot?.querySelector('textarea');
      if (textarea) textarea.value = '';
    }
    
    showError('投稿しました！');
    errorMessage.style.background = 'var(--md-sys-color-primary-container, #bbdefb)';
    errorMessage.style.color = 'var(--md-sys-color-on-primary-container, #0d47a1)';
    setTimeout(() => {
      errorMessage.style.background = '';
      errorMessage.style.color = '';
    }, 3000);
    await loadTimeline(true);
  } catch (e) {
    console.error('投稿エラー詳細:', e);
    showError(`投稿エラー：${e.message}`);
  } finally {
    postBtn.disabled = false;
    postBtn.innerHTML = '<md-icon slot="icon">send</md-icon>投稿';
  }
});

// 画像アップロードボタンクリック
if (imageUploadBtn) imageUploadBtn.addEventListener('click', () => {
  imageInput.click();
});

// 画像選択時の処理
if (imageInput) imageInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  // 最大 4 枚まで（Bluesky の制限）
  const remainingSlots = 4 - selectedImages.length;
  const filesToAdd = files.slice(0, remainingSlots);
  
  if (files.length > remainingSlots) {
    showError(`画像は最大 4 枚まで添付できます。残り${remainingSlots}枚です。`);
  }
  
  filesToAdd.forEach(file => {
    selectedImages.push(file);
  });
  
  updateImagePreview();
  imageInput.value = ''; // 同じファイルを再度選択できるようにリセット
});

// 画像プレビュー更新関数
function updateImagePreview() {
  Array.from(imagePreview.querySelectorAll('img')).forEach((img) => {
    if (img.dataset.objectUrl) {
      URL.revokeObjectURL(img.dataset.objectUrl);
    }
  });
  imagePreview.innerHTML = '';
  imageCount.textContent = selectedImages.length > 0 ? `${selectedImages.length}枚選択中` : '';
  
  selectedImages.forEach((file, index) => {
    const container = document.createElement('div');
    container.style.position = 'relative';
    
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.dataset.objectUrl = objectUrl;
    img.style.width = '80px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '8px';
    
    // 削除ボタン
    const removeBtn = document.createElement('md-icon-button');
    removeBtn.textContent = 'close';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '-8px';
    removeBtn.style.right = '-8px';
    removeBtn.style.backgroundColor = 'var(--md-sys-color-error)';
    removeBtn.style.color = 'white';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.width = '24px';
    removeBtn.style.height = '24px';
    removeBtn.style.fontSize = '16px';
    
    removeBtn.addEventListener('click', () => {
      selectedImages.splice(index, 1);
      updateImagePreview();
    });
    
    container.appendChild(img);
    container.appendChild(removeBtn);
    imagePreview.appendChild(container);
  });
}

function showLoading(show) {
  loading.style.display = show ? 'block' : 'none';
}

function normalizePath(pathname) {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function navigateTo(path) {
  const target = normalizePath(path);
  if (normalizePath(window.location.pathname) !== target) {
    window.history.pushState({}, "", target);
    initializeView();
  }
}

function syncSidebarByAuthState() {
  const loginNav = document.querySelector('[data-nav-item="login"]');
  const composerNav = document.querySelector('[data-nav-item="composer"]');
  const timelineNav = document.querySelector('[data-nav-item="timeline"]');

  const loggedIn = client.isLoggedIn;
  if (loginNav) {
    loginNav.style.display = loggedIn ? 'none' : 'flex';
    loginNav.setAttribute('aria-disabled', loggedIn ? 'true' : 'false');
  }

  [composerNav, timelineNav].forEach((navItem) => {
    if (!navItem) return;
    navItem.style.display = loggedIn ? 'flex' : 'none';
    navItem.setAttribute('aria-disabled', loggedIn ? 'false' : 'true');
  });
}

function setActiveSidebarItem(key) {
  document.querySelectorAll('.sidebar-nav md-filled-tonal-button').forEach((link) => {
    link.classList.toggle('active', link.dataset.navItem === key);
  });
}

function initializeView() {
  syncSidebarByAuthState();
  const path = normalizePath(window.location.pathname);

  if (path === '/home/') {
    if (client.isLoggedIn) {
      showTimeline();
    } else {
      navigateTo('/login/');
      showLogin();
    }
    return;
  }

  if (path === '/login/') {
    if (client.isLoggedIn) {
      navigateTo('/home/');
      showTimeline();
    } else {
      showLogin();
    }
    return;
  }

  if (client.isLoggedIn) {
    navigateTo('/home/');
    showTimeline();
    return;
  }

  navigateTo('/login/');
  showLogin();
}

function showLogin() {
  const loginCard = document.getElementById('login');
  if (loginCard) {
    loginCard.hidden = false;
    loginCard.style.display = 'block';
  }
  if (timelineCard) {
    timelineCard.hidden = true;
    timelineCard.style.display = 'none';
  }
  setActiveSidebarItem('login');
}

function showTimeline() {
  const loginCard = document.getElementById('login');
  if (loginCard) {
    loginCard.hidden = true;
    loginCard.style.display = 'none';
  }
  if (timelineCard) {
    timelineCard.hidden = false;
    timelineCard.style.display = 'block';
  }
  setActiveSidebarItem('timeline');
  loadTimeline();
}

async function loadTimeline(force = false) {
  if (timelineLoading) return;
  timelineLoading = true;
  showLoading(true);
  try {
    await client.syncBookmarks();
    const feed = await client.timeline(20, { force });
    const container = document.getElementById('timeline');
    if (!container) return;

    // リストアイテムを生成
    container.textContent = '';
    const fragment = document.createDocumentFragment();

    // 🔹 md-menu用のオーバーレイコンテナの準備・クリーンアップ
    let menuContainer = document.getElementById('menu-overlay-container');
    if (!menuContainer) {
      menuContainer = document.createElement('div');
      menuContainer.id = 'menu-overlay-container';
      document.body.appendChild(menuContainer);
    }
    menuContainer.innerHTML = ''; // 古いポップアップメニューを完全消去してメモリリークを防ぐよ

    feed.forEach(item => {
      const post = item.post;
      const record = post.record;
      const reason = item.reason;
      const isRepost = reason?.$type === 'app.bsky.feed.defs#reasonRepost';
      const reposterHandle = reason?.by?.handle;
      const reposterName = reason?.by?.displayName || (reposterHandle ? `@${reposterHandle}` : null);
      
      // メインのリストアイテム作成
      const listItem = document.createElement('md-list-item');
      listItem.type = 'link';

      // 「〇〇による拡散」表示
      if (isRepost && reposterName) {
        const overline = document.createElement('div');
        overline.slot = 'overline';
        overline.className = 'md-typescale-body-small';
        overline.style.display = 'flex';
        overline.style.alignItems = 'center';
        overline.style.gap = '4px';

        const repostIcon = document.createElement('md-icon');
        repostIcon.textContent = 'repeat';
        repostIcon.style.fontSize = '16px';

        const repostLabel = document.createElement('span');
        repostLabel.textContent = `${reposterName}による拡散`;

        overline.appendChild(repostIcon);
        overline.appendChild(repostLabel);
        listItem.appendChild(overline);
      }
      
      // アイコンスロット
      const avatarIcon = document.createElement('md-icon');
      avatarIcon.slot = 'start';
      avatarIcon.textContent = 'account_circle';
      
      // ヘッドライン
      const headline = document.createElement('div');
      headline.slot = 'headline';
      headline.textContent = `@${post.author.handle}`;
      headline.className = 'md-typescale-body-large';
      
      // サポーティングテキスト
      const supporting = document.createElement('div');
      supporting.slot = 'supporting-text';
      supporting.className = 'md-typescale-body-medium';

      const bodyText = document.createElement('div');
      bodyText.textContent = record.text;
      supporting.appendChild(bodyText);

      const actionRow = document.createElement('div');
      actionRow.style.display = 'flex';
      actionRow.style.gap = '8px';
      actionRow.style.alignItems = 'center';
      actionRow.style.marginTop = '8px';
      actionRow.style.flexWrap = 'wrap';

      const createActionButton = (icon, label, iconClass = '') => {
        const btn = document.createElement('md-filled-tonal-button');
        btn.innerHTML = `<md-icon slot="icon" class="${iconClass}">${icon}</md-icon>${label}`;
        return btn;
      };

      const replyBtn = createActionButton('reply', '返信');
      replyBtn.addEventListener('click', async () => {
        const text = window.prompt('返信内容を入力してください');
        if (!text || !text.trim()) return;
        replyBtn.disabled = true;
        try {
          await client.reply(post.uri, post.cid, text.trim());
          showError('返信しました');
          await loadTimeline(true);
        } catch (e) {
          showError(`返信エラー：${e.message}`);
        } finally {
          replyBtn.disabled = false;
        }
      });

      const viewer = post.viewer || {};

      const repostWrap = document.createElement('div');
      repostWrap.style.position = 'relative';
      let reposted = Boolean(viewer.repost);
      const repostBtn = createActionButton('repeat', reposted ? '再浮済み' : '再浮', 'repost-icon');
      if (reposted) {
        const repostIcon = repostBtn.querySelector('.repost-icon');
        if (repostIcon) repostIcon.classList.add('is-filled');
      }

      // 🔹 リポスト用メニューの作成 (Body直下のオーバーレイコンテナに置くことで、見切れを防ぐよ！)
      const repostMenu = document.createElement('md-menu');
      // DOMツリーが離れるとanchorElementでの自動配置がバグるので外すよ
      repostMenu.menuCorner = 'start-start';
      repostMenu.positioning = 'absolute'; // 絶対配置にする

      const doRepostItem = document.createElement('md-menu-item');
      doRepostItem.dataset.action = 'repost';
      doRepostItem.innerHTML = `
        <md-icon slot="start">repeat</md-icon>
        <div slot="headline">拡散</div>
      `;

      const quoteItem = document.createElement('md-menu-item');
      quoteItem.dataset.action = 'quote';
      quoteItem.innerHTML = `
        <md-icon slot="start">format_quote</md-icon>
        <div slot="headline">引用</div>
      `;

      repostBtn.addEventListener('click', () => {
        // ボタンの画面上の座標を取得して、メニューを正確な位置に移動させる
        const rect = repostBtn.getBoundingClientRect();
        repostMenu.style.position = 'absolute';
        repostMenu.style.top = `${rect.bottom + window.scrollY}px`; // ボタンの下端＋スクロール量
        repostMenu.style.left = `${rect.left + window.scrollX}px`;  // ボタンの左端＋スクロール量
        repostMenu.style.zIndex = '9999'; // 最前面に出す
        
        repostMenu.open = !repostMenu.open;
      });

      async function handleRepost() {
        if (reposted) return;
        doRepostItem.disabled = true;
        try {
          await client.repost(post.uri, post.cid);
          reposted = true;
          repostBtn.innerHTML = '<md-icon slot="icon" class="repost-icon is-filled">repeat</md-icon>再浮済み';
          repostMenu.open = false;
          showError('拡散しました');
          await loadTimeline(true);
        } catch (e) {
          showError(`拡散エラー：${e.message}`);
        } finally {
          doRepostItem.disabled = false;
        }
      }

      async function handleQuote() {
        const text = window.prompt('引用文を入力してください');
        if (!text || !text.trim()) return;
        quoteItem.disabled = true;
        try {
          await client.quote(post.uri, post.cid, text.trim());
          repostMenu.open = false;
          showError('引用しました');
          await loadTimeline(true);
        } catch (e) {
          showError(`引用エラー：${e.message}`);
        } finally {
          quoteItem.disabled = false;
        }
      }
      repostMenu.addEventListener('close-menu', async (event) => {
        const action = event.detail?.itemPath?.[0]?.dataset?.action;
        if (action === 'repost') await handleRepost();
        if (action === 'quote') await handleQuote();
      });

      repostMenu.appendChild(doRepostItem);
      repostMenu.appendChild(quoteItem);
      
      // ボタンだけをタイムラインの中に配置
      repostWrap.appendChild(repostBtn);
      // メニュー本体はオーバーフローで切られないようにBodyのオーバーレイコンテナに流し込むよ
      menuContainer.appendChild(repostMenu);

      let liked = Boolean(viewer.like);
      const likeBtn = createActionButton('favorite', liked ? 'いいね済み' : 'いいね', 'favorite-icon');
      if (liked) {
        const likeIcon = likeBtn.querySelector('.favorite-icon');
        if (likeIcon) likeIcon.classList.add('is-filled');
      }
      likeBtn.addEventListener('click', async () => {
        if (liked) return;
        likeBtn.disabled = true;
        try {
          await client.like(post.uri, post.cid);
          liked = true;
          likeBtn.innerHTML = '<md-icon slot="icon" class="favorite-icon is-filled">favorite</md-icon>いいね済み';
          showError('いいねしました');
        } catch (e) {
          showError(`いいねエラー：${e.message}`);
        } finally {
          likeBtn.disabled = false;
        }
      });

      let saved = client.isSaved(post.uri);
      const saveBtn = createActionButton('bookmark', saved ? '保存済み' : '保存', 'save-icon');
      if (saved) {
        const saveIcon = saveBtn.querySelector('.save-icon');
        if (saveIcon) saveIcon.classList.add('is-filled');
      }
      saveBtn.addEventListener('click', async () => {
        if (saved) return;
        saveBtn.disabled = true;
        try {
          await client.save(post.uri, post.cid);
          saved = true;
          saveBtn.innerHTML = '<md-icon slot="icon" class="save-icon is-filled">bookmark</md-icon>保存済み';
          showError('保存しました');
        } catch (e) {
          showError(`保存エラー：${e.message}`);
        } finally {
          saveBtn.disabled = false;
        }
      });

      actionRow.appendChild(replyBtn);
      actionRow.appendChild(repostWrap);
      actionRow.appendChild(likeBtn);
      actionRow.appendChild(saveBtn);
      supporting.appendChild(actionRow);

      // 画像がある場合は表示
      const images = post.embed?.images || record.embed?.images || [];
      if (images.length > 0) {
        const imageContainer = document.createElement('div');
        imageContainer.style.display = 'flex';
        imageContainer.style.gap = '8px';
        imageContainer.style.flexWrap = 'wrap';
        imageContainer.style.marginTop = '8px';
        
        images.forEach(img => {
          const imgElement = document.createElement('img');
          imgElement.src = img.fullsize || img.thumbnail;
          imgElement.style.width = '120px';
          imgElement.style.height = '120px';
          imgElement.style.objectFit = 'cover';
          imgElement.style.borderRadius = '8px';
          imgElement.style.cursor = 'pointer';
          
          imgElement.addEventListener('click', () => {
            window.open(img.fullsize || img.thumbnail, '_blank');
          });
          
          imageContainer.appendChild(imgElement);
        });
        
        supporting.appendChild(imageContainer);
      }

      listItem.appendChild(avatarIcon);
      listItem.appendChild(headline);
      listItem.appendChild(supporting);
      fragment.appendChild(listItem);

      const divider = document.createElement('md-divider');
      fragment.appendChild(divider);
    });

    container.appendChild(fragment);
  } catch (e) {
    console.error('Timeline load error:', e);
    showError('タイムラインの取得に失敗しました');
  } finally {
    showLoading(false);
    timelineLoading = false;
  }
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
