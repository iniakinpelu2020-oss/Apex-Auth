# Apex Auth

One sign-in for the whole suite: a real sign-in screen, token refresh, and one shared way
for every Apex app to store and send the token.

**Status: built as a shared web module plus a working sign-in page.** The Android token
paste is still on the list.

## What is here

| File | What it is |
| --- | --- |
| `js/apex-auth.js` | The shared module. Firebase Auth over REST: sign up, sign in, refresh, sign out, session persistence, change listener. No SDK, no build step. |
| `index.html` | The sign-in page, and a live view of your session: uid, project, token countdown, manual refresh. |
| `sw.js`, `manifest.webmanifest` | Installable offline shell. |

The Worker half already existed: `Automation/src/vault/auth.ts` verifies the ID token
against Google's keys, the audience and the expiry, and returns the `uid`.

## Use it in another app

```js
import { createApexAuth } from "./apex-auth.js";

const auth = createApexAuth({
  apiKey: "<firebase web api key>",
  projectId: "apexaiautomation",
});

auth.onChange((session) => { /* show or hide the app */ });

await auth.signIn("you@example.com", "password");
const token = await auth.getIdToken();          // renews itself before it expires

await fetch("https://automation.iniakinpelu2020.workers.dev/api/vault/items", {
  headers: { Authorization: `Bearer ${token}` },
});
```

`getIdToken()` returns a cached token until it is within 60 seconds of expiry, then
refreshes with the stored refresh token. If the refresh is rejected the session is cleared
and the promise rejects, so the app can send the person back to the sign-in screen.

The session lives in `localStorage` under `apex-auth-session`. Pass a different `storageKey`
if two apps share one origin.

## Run the page

```sh
python3 -m http.server 8080
```

## One-time setup in Firebase

1. Project `apexaiautomation` → Authentication → Sign-in method.
2. Enable **Email/Password** (and **Google** if you want the Google button next).
3. Authentication → Settings → Authorised domains: add your Worker and Pages hosts.
4. For Android, download `google-services.json`.

Until step 2 is done, the page reports "Email/password sign-in is switched off in the
Firebase console." — which is the honest error, not a bug.

## Limits worth knowing

- **Not single sign-on across domains.** Each origin keeps its own session. Same account
  everywhere, one login per origin. Only a parent domain you own fixes that.
- **Google sign-in is not on the page yet.** The module covers email/password; Google needs
  the `signInWithIdp` redirect flow and is the next piece.
- **No password reset or email verification UI on this page yet.** The drop-in gate
  (`apex-login.js`) does have password reset; this page stops at sign-in and sign-out.

## Next steps, in order

1. Google sign-in through `signInWithIdp`, with the same session shape.
2. Password reset and email verification.
3. A redirect-based handoff so one app can sign in and send the token back to another.
4. Token refresh in the Android app, so nothing is pasted by hand.

## The drop-in gate: `apex-login.js`

`js/apex-auth.js` is the module you import. `apex-login.js` is the same sign-in
as a plain script you can drop into any page with no import map, no module type
and no build step:

```html
<script src="./apex-login.js"></script>
```

It shows a full-screen sign-in until there is a session, then gets out of the
way. `window.ApexLogin` gives `.session()`, `.token()`, `.signOut()` and
`.onChange()`. Nothing needs wiring: any element with `data-apex-account`
shows the signed-in email, and `data-apex-signout` signs out.

Both use the same `localStorage` key (`apex-auth-session`), so a session started
on this page is already live in every other Apex app on the origin.

The gate is `apex-login.js` at the root of the ApexOS repo, served at
`/apex-login.js`; ApexOS loads it in `<head>`, and its bundler copies it into
all 28 app folders and adds the one `<script>` tag to each `index.html`. So the
whole suite sits behind this sign-in without editing each app's repo.

## What only you can do

In the Firebase console for `apexaiautomation`:

1. **Authentication -> Sign-in method -> Email/Password -> Enable.**
2. **Authentication -> Settings -> Authorized domains:** add the origin you
   serve the suite from (for example `apex.pages.dev`).
3. **Firestore -> Rules:** publish the block in `Apex-Drop/firestore.rules` if
   you want Drop's rooms to sync.

Until step 1 is done the gate reports that email/password sign-in is switched
off and offers local-only use for that tab instead of locking you out.
