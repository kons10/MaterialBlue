// static/src/bsky-client.js
import { BskyAgent } from 'https://esm.sh/@atproto/api@0.13.6';

export function createBskyClient() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });

  // 🔹 1. Cookie からセッション情報を読み取る
  const access = getCookie('bsky_access');
  const refresh = getCookie('bsky_refresh');
  const did = getCookie('bsky_did');

  // 🔹 2. セッション情報が揃っていたら復元を試みる
  if (access && refresh && did) {
    const sessionData = { 
      accessJwt: access, 
      refreshJwt: refresh, 
      did: decodeURIComponent(did),
      handle: '', // handle は resumeSession 後に更新されるか、必要なら保存
      email: '',
      emailConfirmed: false
    };

    // ✅ 正しい復元方法：resumeSession にデータを渡す
    agent.resumeSession(sessionData).catch((err) => {
      console.warn('Session resume failed (token expired or invalid):', err);
      clearSession(); // 失敗したらCookieをクリア
    });
  }

  return {
    agent,
    // ✅ ログイン判定：session プロパティが存在するかで判断
    get isLoggedIn() { 
      return !!agent.session?.accessJwt; 
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
        // session は getter なので undefined にする必要はないが、念のため
      }
    },

    // 🔹 5. タイムライン取得
    async timeline(limit = 30) {
      const res = await agent.api.app.bsky.feed.getTimeline({ limit });
      return res.data.feed;
    },

    // 🔹 6. 投稿機能
    async post(text) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.post({ text });
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
