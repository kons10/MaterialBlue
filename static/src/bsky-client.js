// static/src/bsky-client.js
import { BskyAgent } from 'https://esm.sh/@atproto/api@0.13.6';

export function createBskyClient() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  let timelineCache = null;
  let timelineCacheLimit = null;
  let timelineCacheAt = 0;
  let timelineInFlight = null;

  // 🔹 1. Cookie からセッション情報を読み取る
  const access = getCookie('bsky_access');
  const refresh = getCookie('bsky_refresh');
  const did = getCookie('bsky_did');

  // 🔹 2. セッション情報が揃っていたら復元を試みる
  const restoreSessionPromise = (access && refresh && did) ? (() => {
    const sessionData = { 
      accessJwt: access, 
      refreshJwt: refresh, 
      did: decodeURIComponent(did),
      handle: '', // handle は resumeSession 後に更新されるか、必要なら保存
      email: '',
      emailConfirmed: false
    };

    // ✅ 正しい復元方法：resumeSession にデータを渡す
    return agent.resumeSession(sessionData)
      .then(() => {
        if (agent.session) {
          setCookie('bsky_access', agent.session.accessJwt, 86400);
          setCookie('bsky_refresh', agent.session.refreshJwt, 86400);
          setCookie('bsky_did', agent.session.did, 86400);
        }
      })
      .catch((err) => {
        console.warn('Session resume failed (token expired or invalid):', err);
        clearSession(); // 失敗したらCookieをクリア
      });
  })() : Promise.resolve();

  return {
    agent,
    // ✅ ログイン判定：session プロパティが存在するかで判断
    get isLoggedIn() { 
      return !!agent.session?.accessJwt; 
    },

    async ready() {
      await restoreSessionPromise;
    },

    // 🔹 3. ログイン処理
    async login(identifier, appPassword) {
      try {
        // login メソッドが成功すると、内部で agent.session が自動更新される
        const session = await agent.login({ identifier, password: appPassword });
        
        // ログイン成功時に Cookie に保存
        if (agent.session) {
          setCookie('bsky_access', agent.session.accessJwt, 86400);
          setCookie('bsky_refresh', agent.session.refreshJwt, 86400);
          setCookie('bsky_did', agent.session.did, 86400);
        }
        return session;
      } catch (e) {
        clearSession();
        throw e;
      }
    },

    // 🔹 4. ログアウト処理
    async logout() {
      try {
        await agent.logout();
      } finally {
        clearSession();
        timelineCache = null;
        timelineCacheLimit = null;
        timelineCacheAt = 0;
        // session は getter なので undefined にする必要はないが、念のため
      }
    },

    // 🔹 5. タイムライン取得
    async timeline(limit = 30, options = {}) {
      const { force = false, ttlMs = 30000 } = options;
      const now = Date.now();

      if (!force && timelineCache && timelineCacheLimit === limit && now - timelineCacheAt < ttlMs) {
        return timelineCache;
      }

      if (!force && timelineInFlight) {
        return timelineInFlight;
      }

      timelineInFlight = agent.api.app.bsky.feed.getTimeline({ limit })
        .then((res) => {
          timelineCache = res.data.feed;
          timelineCacheLimit = limit;
          timelineCacheAt = Date.now();
          return timelineCache;
        })
        .finally(() => {
          timelineInFlight = null;
        });

      return timelineInFlight;
    },

  // 🔹 6. 投稿機能（テキストのみ）
  async post(text) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    return await agent.post({ text });
  },

  // 🔹 7. 画像付き投稿機能
  async postWithImage(text, imageFiles) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    
    const imageEmbeds = [];
    
    for (const file of imageFiles) {
      // ファイルをバイト配列に変換
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 画像をアップロード
      const upload = await agent.uploadBlob(uint8Array, {
        encoding: file.type
      });
      
      // 画像の埋め込み情報を作成
      imageEmbeds.push({
        image: upload.data.blob,
        alt: '' // 代替テキスト（必要に応じて設定可能）
      });
    }
    
    return await agent.post({
      text,
      embed: {
        $type: 'app.bsky.embed.images',
        images: imageEmbeds
      }
    });
  },

  async like(uri, cid) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    return await agent.api.com.atproto.repo.createRecord({
      repo: agent.session.did,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri, cid },
        createdAt: new Date().toISOString()
      }
    });
  },

  async repost(uri, cid) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    return await agent.api.com.atproto.repo.createRecord({
      repo: agent.session.did,
      collection: 'app.bsky.feed.repost',
      record: {
        $type: 'app.bsky.feed.repost',
        subject: { uri, cid },
        createdAt: new Date().toISOString()
      }
    });
  },

  async quote(uri, cid, text) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    return await agent.post({
      text,
      embed: {
        $type: 'app.bsky.embed.record',
        record: { uri, cid }
      }
    });
  },

  async reply(uri, cid, text) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    return await agent.post({
      text,
      reply: {
        root: { uri, cid },
        parent: { uri, cid }
      }
    });
  },

  async save(uri) {
    if (!this.isLoggedIn) throw new Error('Not logged in');
    const key = `saved_posts_${agent.session.did}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    if (!current.includes(uri)) {
      current.push(uri);
      localStorage.setItem(key, JSON.stringify(current));
    }
    return { uri, saved: true };
  },

  isSaved(uri) {
    if (!this.isLoggedIn) return false;
    const key = `saved_posts_${agent.session.did}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    return current.includes(uri);
  }
  };
}

// --- ユーティリティ関数 ---

function setCookie(name, val, maxAge) {
  document.cookie = `${name}=${encodeURIComponent(val)}; path=/; Secure; SameSite=Lax; max-age=${maxAge}`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function clearSession() {
  ['bsky_access', 'bsky_refresh', 'bsky_did'].forEach(n => {
    document.cookie = `${n}=; path=/; Secure; SameSite=Lax; max-age=0`;
  });
}
