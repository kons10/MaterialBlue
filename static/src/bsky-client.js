// static/src/bsky-client.js
import { BskyAgent } from 'https://esm.sh/@atproto/api@0.13.6';

export function createBskyClient() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  
  // Cookie からのセッション復元
  const access = getCookie('bsky_access');
  const refresh = getCookie('bsky_refresh');
  const did = getCookie('bsky_did');
  
  if (access && refresh && did) {
    agent.session = { accessJwt: access, refreshJwt: refresh, did };
    agent.resumeSession(agent.session).catch(() => clearSession());
  }

  // auth 状態変化を Cookie に同期
  const originalSetSession = agent.setSession.bind(agent);
  agent.setSession = (session) => {
    originalSetSession(session);
    if (session) {
      setCookie('bsky_access', session.accessJwt, 86400);
      setCookie('bsky_refresh', session.refreshJwt, 86400);
      setCookie('bsky_did', session.did, 86400);
    } else {
      clearSession();
    }
  };

  return {
    agent,
    get isLoggedIn() { return !!agent.session?.accessJwt; },
    
    async login(identifier, appPassword) {
      return await agent.login({ identifier, password: appPassword });
    },
    
    async logout() {
      await agent.logout();
    },
    
    async timeline(limit = 30) {
      const res = await agent.api.app.bsky.feed.getTimeline({ limit });
      return res.data.feed;
    }
  };
}

function setCookie(name, val, maxAge) {
  document.cookie = `${name}=${encodeURIComponent(val)}; path=/; Secure; SameSite=Lax; max-age=${maxAge}`;
}
function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1];
}
function clearSession() {
  ['bsky_access','bsky_refresh','bsky_did'].forEach(n => 
    document.cookie = `${n}=; path=/; Secure; SameSite=Lax; max-age=0`
  );
}