# Deploying Rintaki Anime Club Society to your own hosting

This guide walks you through getting the app live on **your own infrastructure** at `https://app.rintaki.org`. Your WordPress site at `rintaki.org` is **not** touched — the FastAPI backend just talks to it over the existing `/wp-json` API and the `rintaki-app-sync` plugin you already installed.

You'll need ~30–45 minutes the first time. After that, future updates are a `git push` away.

---

## 0. The big picture

```
┌──────────────────────┐     ┌──────────────────────────┐
│ rintaki.org          │     │ app.rintaki.org          │
│ WordPress (PHP)      │◄────┤ FastAPI + React (Render) │◄──── you build here
│ MyCred / Asgaros /   │     │                          │
│ WooCommerce / NGG    │     │ + MongoDB Atlas (DB)     │
└──────────────────────┘     └──────────────────────────┘
       (untouched)              (one Render service)         (one MongoDB Atlas free cluster)
```

You'll set up four external services:

| #  | Service           | What it gives you                                | Cost          |
|----|-------------------|--------------------------------------------------|---------------|
| 1  | GitHub            | Code repository Render pulls from                | Free          |
| 2  | MongoDB Atlas     | Database (users, points, claims, posts, …)       | Free (512 MB) |
| 3  | Google Cloud      | OAuth Client ID + Secret for "Sign in with Google" | Free          |
| 4  | Stripe            | Test secret key (live later) for ticket checkout | Free for tests |
| 5  | Render            | Hosts the app, gives you HTTPS, auto-deploys     | $7/mo (or free while testing) |
| 6  | Your DNS provider | Points `app.rintaki.org` to Render               | Already paid  |

---

## 1. Push your code to GitHub

Click **"Save to GitHub"** in the Emergent chat input. Pick a repo name (e.g. `rintaki-app`). After it finishes, you'll have a private GitHub repo with everything in `/app/`.

---

## 2. Create a free MongoDB Atlas cluster (5 minutes)

1. Go to **https://www.mongodb.com/cloud/atlas/register** and sign up (you can sign in with Google).
2. Pick **"M0 Free"** tier. Region: pick the one closest to where Render runs (Render's default is **Oregon**, so MongoDB Atlas **AWS / us-west-2** is a good match — keeps latency low).
3. Once your cluster is built (3–5 minutes), Atlas asks two things:
   - **Create a database user** — e.g. username `rintaki`, click "Autogenerate password" and **copy the password** (you'll only see it once).
   - **Network access** — choose **"Allow access from anywhere"** (`0.0.0.0/0`). For production you can later restrict this to Render's IPs.
4. Click **Connect → Drivers → Python**. Copy the connection string. It looks like:
   ```
   mongodb+srv://rintaki:<password>@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```
   Paste your real password where it says `<password>`. **Save this string** — you'll paste it into Render later as `MONGO_URL`.

---

## 3. Create a Google OAuth Client (10 minutes)

1. Go to **https://console.cloud.google.com**. If this is your first time, accept the terms.
2. **Create a project**: top bar → "Select a project" → "New Project" → name it `Rintaki App` → Create.
3. Left sidebar: **APIs & Services → OAuth consent screen**.
   - User type: **External**.
   - App name: `Rintaki Anime Club Society`
   - User support email: `rintakianimeclub@gmail.com`
   - App logo: optional (192×192px)
   - Developer contact email: `rintakianimeclub@gmail.com`
   - Save and continue. Skip "Scopes" (defaults are fine). Add yourself as a test user under **"Test users"** so you can sign in while the app is in "Testing" mode. Save.
4. Left sidebar: **APIs & Services → Credentials → + Create credentials → OAuth Client ID**.
   - Application type: **Web application**
   - Name: `Rintaki Web Client`
   - **Authorized JavaScript origins** — add ALL of these:
     - `https://app.rintaki.org`
     - `http://localhost:3000`  (for local dev, optional but handy)
   - **Authorized redirect URIs** — Google requires at least one even though our flow doesn't redirect. Add:
     - `https://app.rintaki.org`
     - `http://localhost:3000`
   - Click **Create**. A popup shows your **Client ID** and **Client Secret**. Copy both.
5. **Save these somewhere safe** — you'll paste:
   - `GOOGLE_CLIENT_ID` into Render (backend env var) **and** `REACT_APP_GOOGLE_CLIENT_ID` (frontend build var) — they're the same value.
   - `GOOGLE_CLIENT_SECRET` is **NOT** needed for our flow (we use ID-token verification).

> ⚠️ If you later attach a different domain (say `rintakiapp.org`), you must add it to **both** Authorized JavaScript origins AND Authorized redirect URIs in this Credentials screen, or Google sign-in breaks on that domain.

---

## 4. Get your Stripe TEST secret key (2 minutes)

1. Sign in to **https://dashboard.stripe.com**.
2. Top-left, make sure the toggle says **"Test mode"** (orange).
3. Left sidebar: **Developers → API keys**.
4. Reveal and copy the **Secret key** — it starts with `sk_test_...`. **Save it.**
5. **Webhook setup (do this AFTER Render deploy in step 5):**
   - Left sidebar: **Developers → Webhooks → Add endpoint**.
   - Endpoint URL: `https://app.rintaki.org/api/webhook/stripe`
   - Events to listen to: `checkout.session.completed` (just that one).
   - Click **Add endpoint** → click into it → **Reveal signing secret** → copy. It starts with `whsec_...`. **Save it** as `STRIPE_WEBHOOK_SECRET`.
   - You can come back and add this after Render is up — the app works without it (polling fills in), it's just defense-in-depth.

When you're ready to take real money, redo step 4 with the toggle on **"Live mode"** to get `sk_live_...` and `whsec_...` (live), then update those two env vars on Render. No code change needed.

---

## 5. Deploy to Render (10 minutes)

1. Go to **https://render.com** and sign in with GitHub.
2. **New → Blueprint** → connect your `rintaki-app` repo. Render auto-detects `render.yaml` in the repo root.
3. It creates a service called **`rintaki-app`**. Render asks you to fill in the env vars marked `sync: false` in `render.yaml`. Paste:

   | Env var                       | Value                                                              |
   |-------------------------------|--------------------------------------------------------------------|
   | `MONGO_URL`                   | the connection string from step 2                                  |
   | `ADMIN_EMAIL`                 | `rintakianimeclub@gmail.com`                                       |
   | `ADMIN_PASSWORD`              | `Admin@Rintaki2026` (or change to anything new)                    |
   | `GOOGLE_CLIENT_ID`            | the Client ID from step 3                                          |
   | `STRIPE_API_KEY`              | the `sk_test_...` from step 4                                      |
   | `STRIPE_WEBHOOK_SECRET`       | leave blank for now (fill in after step 5.6)                       |
   | `FRONTEND_URL`                | `https://app.rintaki.org`                                          |
   | `REACT_APP_BACKEND_URL`       | `https://app.rintaki.org`                                          |
   | `REACT_APP_GOOGLE_CLIENT_ID`  | same as `GOOGLE_CLIENT_ID`                                         |
   | `RINTAKI_WP_KEY`              | the shared key your `rintaki-app-sync.php` plugin uses             |
   | `SOCIAL_*`, `LIBRARY_URL`     | copy from `/app/backend/.env.example`                              |

   `JWT_SECRET` is auto-generated by Render — leave it.
4. Click **Apply**. Render builds the Docker image (~5–8 minutes) and starts the service. You get a URL like `https://rintaki-app.onrender.com`.
5. Visit `https://rintaki-app.onrender.com/api/` — you should see `{"ok":true,"app":"Rintaki Anime Club Society API"}`.
6. **Add the custom domain `app.rintaki.org`:**
   - In Render, your service → **Settings → Custom Domains → Add Custom Domain** → `app.rintaki.org`. Render shows you a CNAME target like `rintaki-app.onrender.com`.
   - In your DNS provider (whoever rintaki.org is registered with — GoDaddy, Namecheap, Cloudflare, etc.), add a **CNAME record**:
     - Host / Name: `app`
     - Value / Target: `rintaki-app.onrender.com` (whatever Render told you)
     - TTL: default
   - DNS propagates in 5–60 minutes. Render auto-issues a free SSL cert. When it's done, `https://app.rintaki.org` loads the app.
7. **Now finish the Stripe webhook** (step 4.5 above): create the webhook with URL `https://app.rintaki.org/api/webhook/stripe`, copy the signing secret, and add it to Render as `STRIPE_WEBHOOK_SECRET`. Render auto-restarts the service.

---

## 6. Smoke test

Open **https://app.rintaki.org** on your phone. You should be able to:

- Browse Home, Events, Forum, Cards, Magazine, Gallery (anonymous OK)
- Click **Sign in → Continue with Google** → pick your Google account → land back on Home as logged in
- See the WordPress posts in "Latest Posts" (proxied from rintaki.org)
- Open `/admin` (after seeding admin) and confirm the Sync jobs run

---

## 7. What changed vs. the Emergent preview

| Thing                                  | Before (Emergent)                                  | Now (your hosting)                            |
|----------------------------------------|----------------------------------------------------|-----------------------------------------------|
| Hosting                                | Emergent K8s preview                               | Render Web Service (Docker)                   |
| Database                               | MongoDB inside the preview pod                     | MongoDB Atlas                                 |
| Google sign-in                         | Emergent OAuth (`auth.emergentagent.com`)          | Your own Google Cloud OAuth Client ID         |
| Stripe SDK                             | `emergentintegrations.payments.stripe.checkout`    | Official `stripe` Python SDK                  |
| "Made with Emergent" badge             | Always visible                                     | Removed                                       |
| `@emergentbase/visual-edits` package   | Bundled                                            | Removed                                       |
| Domain                                 | `community-connect-257.preview.emergentagent.com`  | `app.rintaki.org`                             |

The React app, the WordPress plugin (`/app/wp-plugin/rintaki-app-sync.php` v1.4.1), the database schema, and every feature behave identically.

---

## 8. Future updates

```bash
# in your local clone of the repo
git add . && git commit -m "your changes" && git push
```

Render watches the repo (`autoDeploy: true`) and rebuilds within ~5 minutes. Or use Emergent's **Save to GitHub** button after each chat session.

---

## 9. Troubleshooting

- **`{"detail":"Google sign-in not configured"}` on the Google button** → `GOOGLE_CLIENT_ID` env var on Render is empty.
- **Google sign-in popup says "redirect_uri_mismatch"** → step 3.4: add `https://app.rintaki.org` to *Authorized JavaScript origins* AND *Authorized redirect URIs*.
- **`MongoServerSelectionError`** → Atlas IP allowlist (step 2.3) doesn't include `0.0.0.0/0`, or `MONGO_URL` has the wrong password.
- **Stripe checkout fails with `Unrecognized request URL`** → wrong API key (using a publishable `pk_test_...` instead of secret `sk_test_...`).
- **CORS errors in the browser console** → `FRONTEND_URL` env var on Render must match the domain you're loading the app from.
- **First request after 15 minutes is slow on the free plan** → Render free plan sleeps idle services. Upgrade to Starter ($7/mo) for always-on.
