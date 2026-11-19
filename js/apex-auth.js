// apex-auth.js — one sign-in for the Apex suite, on Firebase Auth over REST.
// No SDK, no build step. Works from any static page or Worker-served app.
//
//   import { createApexAuth } from "./apex-auth.js";
//   const auth = createApexAuth({ apiKey: "...", projectId: "apexaiautomation" });
//   await auth.signIn(email, password);
//   const token = await auth.getIdToken();   // refreshed automatically

const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts:";
const TOKEN = "https://securetoken.googleapis.com/v1/token";

const FRIENDLY = {
  EMAIL_EXISTS: "That email already has an account. Sign in instead.",
  EMAIL_NOT_FOUND: "No account uses that email.",
  INVALID_PASSWORD: "Wrong password.",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
  INVALID_EMAIL: "That does not look like an email address.",
  MISSING_PASSWORD: "Enter a password.",
  WEAK_PASSWORD: "Use at least 6 characters.",
  PASSWORD_LOGIN_DISABLED: "Email/password sign-in is switched off in the Firebase console.",
  OPERATION_NOT_ALLOWED: "Email/password sign-in is switched off in the Firebase console.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Wait a few minutes and try again.",
  USER_DISABLED: "That account has been disabled.",
};

function friendly(code, fallback) {
  return FRIENDLY[code] || code || fallback || "Sign-in failed.";
}

export function createApexAuth({ apiKey, projectId, storageKey = "apex-auth-session" } = {}) {
  if (!apiKey) throw new Error("createApexAuth needs a Firebase web API key.");
  if (!projectId) throw new Error("createApexAuth needs a Firebase project id.");

  const listeners = new Set();
  let session = read();

  function read() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return value && value.idToken ? value : null;
    } catch {
      return null;
    }
  }

  function write(next) {
    session = next;
    try {
      if (next) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {}
    for (const listener of listeners) {
      try { listener(session); } catch {}
    }
    return session;
  }

  function shape(data) {
    return {
      uid: data.localId || data.user_id || "",
      email: data.email || (session && session.email) || "",
      idToken: data.idToken || data.id_token || data.access_token || "",
      refreshToken: data.refreshToken || data.refresh_token || (session && session.refreshToken) || "",
      expiresAt: Date.now() + Number(data.expiresIn || data.expires_in || 3600) * 1000,
    };
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raw = (data.error && data.error.message) || "";
      throw new Error(friendly(raw.split(" ")[0], raw));
    }
    return data;
  }

  async function refreshNow(current) {
    if (!current || !current.refreshToken) return null;
    const res = await fetch(`${TOKEN}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raw = (data.error && data.error.message) || "";
      throw new Error(friendly(String(raw).split(" ")[0], "Session expired. Sign in again."));
    }
    return write(shape(data));
  }

  return {
    get projectId() { return projectId; },
    getSession() { return session ? { ...session } : null; },
    isSignedIn() { return Boolean(session && session.idToken); },

    async signUp(email, password) {
      const data = await postJson(`${IDENTITY}signUp?key=${apiKey}`, {
        email, password, returnSecureToken: true,
      });
      return write(shape(data));
    },

    async signIn(email, password) {
      const data = await postJson(`${IDENTITY}signInWithPassword?key=${apiKey}`, {
        email, password, returnSecureToken: true,
      });
      return write(shape(data));
    },

    async getIdToken({ force = false } = {}) {
      if (!session) return null;
      const fresh = session.expiresAt - Date.now() > 60_000;
      if (fresh && !force) return session.idToken;
      const next = await refreshNow(session).catch((err) => {
        write(null);
        throw err;
      });
      return next ? next.idToken : null;
    },

    async refresh() {
      return refreshNow(session);
    },

    signOut() {
      write(null);
    },

    onChange(listener) {
      listeners.add(listener);
      try { listener(session); } catch {}
      return () => listeners.delete(listener);
    },
  };
}
