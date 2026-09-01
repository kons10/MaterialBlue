// static/src/bsky-client.js - パフォーマンス最適化版
import { BskyAgent } from 'https://esm.sh/@atproto/api@0.20.5?bundle';

export function createBskyClient() {
  const savedService = getCookie('bsky_service');
  const initialService = normalizeService(savedService || 'bsky.social');
  let agent = createAgent(initialService);
  
  // キャッシュ状態
  const cache = {
    timeline: null,
    timelineLimit: null,
    timelineAt: 0,
    cursor: null,
    inFlight: null
  };
  
  // ブックマーク状態
  const bookmarks = {
    uris: new Set(),
    loaded: false
  };

  function createAgent(service) {
    return new BskyAgent({
      service,
      persistSession: (evt, session) => {
        if (session) {
          setCookie('bsky_access', session.accessJwt, 86400);
          setCookie('bsky_refresh', session.refreshJwt, 86400);
          setCookie('bsky_did', session.did, 86400);
          setCookie('bsky_handle', session.handle, 86400);
          setCookie('bsky_service', service, 86400);
        }
      }
    });
  }

  // セッション復元
  const access = getCookie('bsky_access');
  const refresh = getCookie('bsky_refresh');
  const did = getCookie('bsky_did');
  const handle = getCookie('bsky_handle');

  const restoreSessionPromise = (access && refresh && did) ? (() => {
    const sessionData = {
      accessJwt: access,
      refreshJwt: refresh,
      did: decodeURIComponent(did),
      handle: handle || '',
      email: '',
      emailConfirmed: false
    };

    const restorePromise = agent.resumeSession(sessionData)
      .then(() => {
        if (agent.session) {
          setCookie('bsky_access', agent.session.accessJwt, 86400);
          setCookie('bsky_refresh', agent.session.refreshJwt, 86400);
          setCookie('bsky_did', agent.session.did, 86400);
          setCookie('bsky_handle', agent.session.handle, 86400);
        }
      })
      .catch((err) => {
        console.warn('Session resume failed:', err);
        clearSession();
      });

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.warn('Session resume timed out after 3000ms');
        resolve();
      }, 3000);
    });

    return Promise.race([restorePromise, timeoutPromise]);
  })() : Promise.resolve();

  return {
    get agent() { return agent; },
    
    get isLoggedIn() {
      return !!agent.session?.accessJwt;
    },

    async ready() {
      try {
        const readyPromise = (async () => {
          await restoreSessionPromise;
          if (this.isLoggedIn) await this.syncBookmarks();
        })();

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn('Client ready timed out after 4000ms');
            resolve();
          }, 4000);
        });

        await Promise.race([readyPromise, timeoutPromise]);
      } catch (e) {
        console.warn('Client ready failed:', e);
      }
    },

    async login(identifier, appPassword, service) {
      try {
        const normalizedService = normalizeService(service);
        agent = createAgent(normalizedService);
        const session = await agent.login({ identifier, password: appPassword });

        if (agent.session) {
          setCookie('bsky_access', agent.session.accessJwt, 86400);
          setCookie('bsky_refresh', agent.session.refreshJwt, 86400);
          setCookie('bsky_did', agent.session.did, 86400);
          setCookie('bsky_handle', agent.session.handle, 86400);
          setCookie('bsky_service', normalizedService, 86400);
        }
        return session;
      } catch (e) {
        clearSession();
        throw e;
      }
    },

    async logout() {
      try { await agent.logout(); }
      finally {
        clearSession();
        cache.timeline = null;
        cache.timelineLimit = null;
        cache.timelineAt = 0;
        cache.cursor = null;
        cache.inFlight = null;
        bookmarks.uris.clear();
        bookmarks.loaded = false;
      }
    },

    async timeline(limit = 30, options = {}) {
      const { force = false, ttlMs = 30000 } = options;
      const now = Date.now();

      if (!force && cache.timeline && cache.timelineLimit === limit && now - cache.timelineAt < ttlMs) {
        return cache.timeline;
      }

      const page = await this.timelinePage(limit, { cursor: null, force });
      cache.timelineAt = Date.now();
      cache.timelineLimit = limit;
      return page.feed;
    },

    async timelinePage(limit = 30, options = {}) {
      const { cursor = null, force = false } = options;

      if (!force && !cursor && cache.inFlight) {
        return cache.inFlight;
      }

      const params = { limit };
      if (cursor) params.cursor = cursor;

      const request = agent.api.app.bsky.feed.getTimeline(params)
        .then((res) => {
          const filteredFeed = res.data.feed.filter(item => {
            if (!item.reply) return true;
            const parentAuthor = item.reply.parent?.author;
            if (parentAuthor) {
              const isFollowingParent = !!parentAuthor.viewer?.following || parentAuthor.did === agent.session?.did;
              if (!isFollowingParent) return false;
            }
            return true;
          });

          if (!cursor) {
            cache.timeline = filteredFeed;
            cache.cursor = res.data.cursor || null;
          }

          return { feed: filteredFeed, cursor: res.data.cursor || null };
        });

      if (!cursor) {
        cache.inFlight = request.finally(() => { cache.inFlight = null; });
        return cache.inFlight;
      }

      return request;
    },

    get timelineCursor() { return cache.cursor; },

    async post(text) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.post({ text });
    },

    async postWithImage(text, imageFiles) {
      if (!this.isLoggedIn) throw new Error('Not logged in');

      const imageEmbeds = [];
      for (const file of imageFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const upload = await agent.uploadBlob(uint8Array, { encoding: file.type });
        imageEmbeds.push({ image: upload.data.blob, alt: '' });
      }

      return await agent.post({
        text,
        embed: { $type: 'app.bsky.embed.images', images: imageEmbeds }
      });
    },

    async like(uri, cid) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.api.com.atproto.repo.createRecord({
        repo: agent.session.did,
        collection: 'app.bsky.feed.like',
        record: { $type: 'app.bsky.feed.like', subject: { uri, cid }, createdAt: new Date().toISOString() }
      });
    },

    async unlike(likeUri) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      if (!likeUri) throw new Error('Like record URI is required');
      return await agent.api.com.atproto.repo.deleteRecord({
        repo: agent.session.did,
        collection: 'app.bsky.feed.like',
        rkey: likeUri.split('/').pop()
      });
    },

    async repost(uri, cid) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.api.com.atproto.repo.createRecord({
        repo: agent.session.did,
        collection: 'app.bsky.feed.repost',
        record: { $type: 'app.bsky.feed.repost', subject: { uri, cid }, createdAt: new Date().toISOString() }
      });
    },

    async unrepost(repostUri) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      if (!repostUri) throw new Error('Repost record URI is required');
      return await agent.api.com.atproto.repo.deleteRecord({
        repo: agent.session.did,
        collection: 'app.bsky.feed.repost',
        rkey: repostUri.split('/').pop()
      });
    },

    async quote(uri, cid, text) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.post({
        text,
        embed: { $type: 'app.bsky.embed.record', record: { uri, cid } }
      });
    },

    async reply(uri, cid, text, replyContext = null) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.post({
        text,
        reply: { root: replyContext?.root || { uri, cid }, parent: { uri, cid } }
      });
    },

    async posts(uris) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      if (!Array.isArray(uris) || uris.length === 0) return [];

      const posts = [];
      for (let i = 0; i < uris.length; i += 25) {
        const res = await agent.api.app.bsky.feed.getPosts({ uris: uris.slice(i, i + 25) });
        posts.push(...(res.data.posts || []));
      }
      return posts;
    },

    async notifications(limit = 50) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      const res = await agent.api.app.bsky.notification.listNotifications({ limit });
      // Keep AT Protocol notification records intact. The view layer resolves
      // reasonSubject separately, so notification.uri never changes meaning.
      return res.data.notifications || [];
    },

    async markNotificationsSeen(seenAt = new Date().toISOString()) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      return await agent.api.app.bsky.notification.updateSeen({ seenAt });
    },

    async save(uri, cid) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      const bookmarkApi = agent.api?.app?.bsky?.bookmark;
      if (!bookmarkApi?.createBookmark) throw new Error('Bookmark API unavailable');
      await bookmarkApi.createBookmark({ uri, cid });
      bookmarks.uris.add(uri);
      return { uri, saved: true };
    },

    async unsave(uri, cid) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      const bookmarkApi = agent.api?.app?.bsky?.bookmark;
      if (!bookmarkApi?.deleteBookmark) throw new Error('Bookmark API unavailable');
      await bookmarkApi.deleteBookmark({ uri, cid });
      bookmarks.uris.delete(uri);
      return { uri, saved: false };
    },

    async syncBookmarks(limit = 100) {
      if (!this.isLoggedIn) throw new Error('Not logged in');
      bookmarks.uris.clear();
      let cursor;
      do {
        const bookmarkApi = agent.api?.app?.bsky?.bookmark;
        if (!bookmarkApi?.getBookmarks) {
          bookmarks.loaded = true;
          return [];
        }
        const res = await bookmarkApi.getBookmarks({ limit, cursor });
        const page = res.data.bookmarks || [];
        page.forEach((b) => { if (b?.subject?.uri) bookmarks.uris.add(b.subject.uri); });
        cursor = res.data.cursor;
      } while (cursor);
      bookmarks.loaded = true;
      return Array.from(bookmarks.uris);
    },

    isSaved(uri) {
      if (!this.isLoggedIn) return false;
      if (!bookmarks.loaded) return false;
      return bookmarks.uris.has(uri);
    }
  };
}

// ユーティリティ関数
function setCookie(name, val, maxAge) {
  document.cookie = `${name}=${encodeURIComponent(val)}; path=/; Secure; SameSite=Lax; max-age=${maxAge}`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function clearSession() {
  ['bsky_access', 'bsky_refresh', 'bsky_did', 'bsky_handle', 'bsky_service'].forEach(n => {
    document.cookie = `${n}=; path=/; Secure; SameSite=Lax; max-age=0`;
  });
}

function normalizeService(service) {
  const value = service.trim();
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('PDS は HTTP または HTTPS の URL を入力してください');
  }
  return url.toString().replace(/\/$/, '');
}
