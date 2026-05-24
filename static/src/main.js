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

  initializeView();

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
    // Material Web Components の text field から値を取得
    // shadow DOM 内の textarea または input から値を取得する必要がある場合がある
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
      console.log('client メソッド確認:', typeof client.post, typeof client.postWithImage);
      
      if (selectedImages.length > 0) {
        // 画像付き投稿
        console.log('画像付き投稿を実行');
        await client.postWithImage(text, selectedImages);
        selectedImages = [];
        updateImagePreview();
      } else {
        // テキストのみ投稿
        console.log('テキスト投稿を実行');
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
      window.location.assign(target);
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

  let timelineLoading = false;

  async function loadTimeline(force = false) {
    if (timelineLoading) return;
    timelineLoading = true;
    try {
      const feed = await client.timeline(20, { force });
      const container = document.getElementById('timeline');
      if (!container) return;

      // リストアイテムを生成
      container.textContent = '';
      const fragment = document.createDocumentFragment();

      feed.forEach(item => {
        const post = item.post;
        const record = post.record;
        
        // メインのリストアイテム作成
        const listItem = document.createElement('md-list-item');
        listItem.type = 'link';
        
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
        supporting.textContent = record.text;
        supporting.className = 'md-typescale-body-medium';
        
        listItem.appendChild(avatarIcon);
        listItem.appendChild(headline);
        listItem.appendChild(supporting);
        fragment.appendChild(listItem);
        
        // 画像がある場合は表示
        // NOTE: Bluesky の TL では画像情報が `post.embed.images` に入る。
        // 投稿レコード側 (`record.embed.images`) を見ると取得できないことがあるため両方を確認する。
        const images = post.embed?.images || record.embed?.images || [];
        if (images.length > 0) {
          const imageContainer = document.createElement('div');
          imageContainer.style.display = 'flex';
          imageContainer.style.gap = '8px';
          imageContainer.style.flexWrap = 'wrap';
          imageContainer.style.margin = '8px 16px';
          
          images.forEach(img => {
            const imgElement = document.createElement('img');
            imgElement.src = img.fullsize || img.thumbnail;
            imgElement.style.width = '120px';
            imgElement.style.height = '120px';
            imgElement.style.objectFit = 'cover';
            imgElement.style.borderRadius = '8px';
            imgElement.style.cursor = 'pointer';
            
            // クリックで拡大表示（シンプル実装）
            imgElement.addEventListener('click', () => {
              window.open(img.fullsize || img.thumbnail, '_blank');
            });
            
            imageContainer.appendChild(imgElement);
          });
          
          fragment.appendChild(imageContainer);
        }
        
        // 区切り線
        const divider = document.createElement('md-divider');
        fragment.appendChild(divider);
      });

      container.appendChild(fragment);
    } catch (e) {
      console.error('Timeline load error:', e);
      showError('タイムラインの取得に失敗しました');
    } finally {
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
