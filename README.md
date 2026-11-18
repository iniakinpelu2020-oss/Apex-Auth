# Apex Auth

One sign-in for the whole suite, on Firebase Auth. Email and Google, no card, no SMS bill.

**Status: the verification half exists; the rest is not built.**

## What already exists

`Automation/src/vault/auth.ts` already validates a Firebase ID token inside a Cloudflare
Worker — it checks the signature against Google's keys, the audience, and the expiry, then
returns the user's `uid`. That is the hard part, and it is written and used by every
`/api/drive/*` and `/api/vault/*` route.

## What is missing

- A real sign-in screen (the Android app currently wants a token pasted by hand).
- Token refresh, so a session outlives an hour.
- One shared way for every app to store and send the token.

## The constraint that shapes it

Firebase Auth is **not** single sign-on across separate domains. Each `*.workers.dev` or
`*.web.app` origin keeps its own session. You get the same account everywhere, not one
login that follows you. The only way around that is putting every app under one parent
domain you own (for example `vault.apex.example` and `notes.apex.example`) so a cookie can
be shared — which needs a domain, which is the one thing on this list that costs money.

## What you need to do

1. Create a Firebase project (Spark plan, no card).
2. Enable **Email/Password** and **Google** as sign-in providers.
3. Add your Worker and Hosting origins as authorised domains.
4. Download `google-services.json` for the Android app.

## First three steps

1. Copy `auth.ts` into this repo as a small shared module so apps stop duplicating it.
2. Build one sign-in page that the other apps redirect to and come back from.
3. Add token refresh to the Android app so nothing has to be pasted again.
