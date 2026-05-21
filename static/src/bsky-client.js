// static/src/bsky-client.js
import { BskyAgent } from 'https://esm.sh/@atproto/api@0.13.6';

export function createBskyClient() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });

  // 🔹 1. Cookie からセッション復元（初期化時）
  const access = getCookie('bsky_access');
  const refresh = getCookie('bsky_refresh');
  const did = getCookie('bsky_did');

  if (access && refresh && did) {
    // session オブジェクトを直接復元
    agent.session = { 
      accessJwt: access, 
      refreshJwt: refresh, 
      did: decodeURIComponent(did),
      handle: '', // handle は後から取得するか、必要なら保存してもOK
      email: '',
      emailConfirmed: false
    };
    
    // セッションの有効性を確認（失敗したら自動でクリアされるようにする）
    agent.resumeSession(agent.session).catch((err) => {
      console.warn('Session resume failed:', err);
      clearSession();
    });
  }

  return {
    agent,
    get isLoggedIn() { 
      // session が存在し、かつ accessJwt が有効そうかチェック
      return !!agent.session?.accessJwt; 
    },

    // 🔹 2. ログイン処理
    async login(identifier, appPassword) {
      try {
        const session = await agent.login({ identifier, password: appPassword });
        
        // ログイン成功時に Cookie に保存
        if (agent.session) {
          setCookie('bsky_access', agent.session.accessJwt, 86400);
          setCookie('bsky_refresh', agent.session.refreshJwt, 86400);
          setCookie('bsky_did', agent.session.did, 86400);
        }
        return session;
      } catch (e) {
        // ログイン失敗時は念のためクリア
        clearSession();
        throw e;
      }
    },

    // 🔹 3. ログアウト処理
    async logout() {
      try {
        await agent.logout();
      } finally {
        // 必ず Cookie を削除
        clearSession();
        agent.session = undefined;
      }
    },

    // 🔹 4. タイムライン取得
    async timeline(limit = 30) {
      // 自動リフレッシュは SDK 側でやってくれるよ
      const res = await agent.api.app.bsky.feed.getTimeline({ limit });
      return res.data.feed;
    },

    // 🔹 5. 投稿機能（おまけ）
    async post(text) {
      if (!agent.session) throw new Error('Not logged in');
      return await agent.post({ text });
    }
  };
}

// --- ユーティリティ関数 ---

function setCookie(name, val, maxAge) {
  // Secure と SameSite は必須！
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
