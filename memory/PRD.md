# Rintaki Anime Club — Mobile App (PRD)

## Original problem statement
> "I want an app that connects my website pages, forums, points system, and more. www.rintaki.org"

## User-chosen scope (updated 2026-04-21, pivot 2)
- **Mobile-first app** (desktop website stays as rintaki.org; the app is primarily for phones)
- **Hybrid**: pulls articles live from rintaki.org + native features
- **Features**:
  - Forum, Forum threads + replies + likes
  - Rinaka Points + Anime Cash (dual currency)
  - Direct Messaging between members
  - **Media feed** (Instagram-style image/video posts, likes, comments)
  - **Magazines** (PDF issues — admin uploads URL, in-app PDF viewer)
  - **Library** external link → libib.com/u/rintakianimeclub
  - **Events with Stripe ticket purchasing** + "My Tickets"
  - **Trading Card Game hub**: collection tracker with image check-off, claim theme set award form, trade-in to club form, member-to-member trade form
  - **Members-only dashboard**: extended profile, points guide, library guide, trips & conventions, members shop (link to WooCommerce), members Discord, monthly giveaways, contests, article submission (blog/magazine)
  - **Social media links**: TikTok, Instagram, Twitter, Facebook, YouTube, Public Discord
  - **Auth**: JWT email/password + Emergent Google OAuth

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) + MongoDB (`rintaki_db`)
- Frontend: React 19 + Tailwind + @phosphor-icons/react, mobile-first layout (max-w-md)
- Design: Neo-Brutalist Sticker Aesthetic — coral reds + mustard yellow + mint, 2px black borders, hard shadows
- Navigation: Bottom 5-tab bar (Home · Forum · Cards · Feed · More) + sticky top header with points/cash pills

## Implemented (Iteration 1 + 2 — 101 backend tests passing)
### Iter 1 — core
- Auth (JWT + Google session)
- Profile, Forums + replies + likes, Points + leaderboard + daily claim
- Events, Newsletters, Videos, Messages, Notifications, Members, Admin stats
- Rintaki.org WP REST feed proxy

### Iter 2 — mobile pivot
- **Media Feed** (`/feed`) — Instagram-style posts + comments + likes (+3 pts per post)
- **Magazines** (`/magazines`) — PDF viewer modal, admin upload, delete
- **Library** (`/library`) — Libib external link card
- **TCG hub** (`/tcg`) — Collection tracker with ownership toggle, claim form (auto-counts owned vs total), trade-in form (bulk card select), member-to-member trade form (offer/want grids)
- **Claim approval** awards +50 pts + 100 Anime Cash (idempotent; guarded)
- **Events Stripe checkout** — Admin toggles `ticket_enabled` + `ticket_price`; user pays via Stripe; success page polls status and creates ticket records idempotently (webhook + polling both covered)
- **Members Dashboard** (`/dashboard`) — tile grid hub
  - Extended profile (phone, birthday, city, anime prefs, cosplay, notes)
  - Points guide + Library guide (static docs)
  - Trips & conventions, Members shop link, Members Discord
  - Giveaways (enter, auto-track entries), Contests
  - Article submissions (blog +25 pts / magazine +50 pts on approval — idempotent)
- **Social links** (`/api/links`) — env-configurable
- **More hub** (`/more`) — all secondary pages + social tiles + logout

## Seeded data
- Admin: `admin@rintaki.org` / `Admin@Rintaki2026`
- 2 demo events, 1 welcome thread, 1 newsletter
- 1 TCG collection "Fashionista 2026" with 6 sample cards
- 1 magazine "Otaku World Vol. 5, Issue 1" (real rintaki.org PDF)
- 1 monthly giveaway

## P0 Backlog
- Real file/image uploads (currently URL-based) — move to S3 or similar
- PWA manifest + service worker (installable home-screen icon)
- Payment webhook signature verification (already in stripe lib; ensure STRIPE_API_KEY is real on production)

## P1 Backlog
- Admin approval UI for claims/articles/tradeins (currently API-only, admin can approve via curl or we can add a simple admin reviews page)
- Push notifications (OneSignal / FCM)
- Rich text + image uploads in forum posts
- Email notifications for winners (SendGrid)
- Stronger role system (moderator vs admin)

## P2 Backlog
- Card collection statistics (rarity breakdown, trade-history log)
- WooCommerce SSO (spend anime_cash at checkout)
- Event RSVP + calendar export
- Badges/achievements engine
- Trade request acceptance/rejection flow (currently records only)

## Stripe
- Test key `sk_test_emergent` in env. Test card `4242 4242 4242 4242` with any future date + CVC.
- Webhook endpoint: `/api/webhook/stripe`
- Polling endpoint: `/api/payments/status/{session_id}` (idempotent)

## Test credentials
See `/app/memory/test_credentials.md`.

## Changelog

### 2026-04-25 — De-Emergented; ready to deploy on user's own hosting (Phase A)
**Goal:** prepare the codebase to run on the user's own infrastructure (Render Web Service at `app.rintaki.org`, MongoDB Atlas, own Google Cloud OAuth app, own Stripe keys). User chose: Render.com hosting · own Google OAuth (Client ID/Secret to be provided) · official Stripe SDK with TEST key · GitHub-based deploy via Emergent's "Save to GitHub" · LIVE Stripe key swap deferred until after testing.

**Code changes (no credentials required, all self-tested):**
- **Removed all Emergent traces from the bundle:** stripped `emergent-main.js` script + `#emergent-badge` block + PostHog analytics block from `frontend/public/index.html`. Removed `@emergentbase/visual-edits` from package.json and the `withVisualEdits()` block from `craco.config.js`. Verified via Playwright: `#emergent-badge` not in DOM, `<script src*="emergent-main">` absent, `window.posthog` undefined.
- **Replaced Emergent Google OAuth with own Google OAuth (ID-token verification):**
  - `POST /api/auth/google` (new) — accepts `{credential}` (Google ID token JWT), verifies it via `google.oauth2.id_token.verify_oauth2_token` against `GOOGLE_CLIENT_ID`, find-or-creates user, sets our existing JWT cookies. Removed the old `POST /api/auth/google/session` (which called `demobackend.emergentagent.com`).
  - Frontend: new `<GoogleSignInButton>` component using `@react-oauth/google`'s `<GoogleLogin>`. `<App>` now wraps with `<GoogleOAuthProvider clientId={REACT_APP_GOOGLE_CLIENT_ID}>`. `Login.jsx` and `Register.jsx` use the new component.
  - Removed the `/auth/callback` route, `AuthCallback.jsx`, and the `session_id=` hash interception in `App.js` and `AuthContext.jsx`.
- **Replaced `emergentintegrations.payments.stripe.checkout` with the official `stripe` Python SDK:**
  - `POST /api/payments/tickets/checkout`, `GET /api/payments/status/{session_id}`, and `POST /api/webhook/stripe` rewritten to use `stripe.checkout.Session.create()`, `stripe.checkout.Session.retrieve()`, and `stripe.Webhook.construct_event()`. External HTTP contract unchanged so the React frontend doesn't need updates.
  - `STRIPE_WEBHOOK_SECRET` is now a separate env var (the webhook endpoint refuses unsigned payloads when set; polling path on `/payments/status/{id}` still grants tickets so it's safe to leave blank during initial testing).
  - `requirements.txt`: removed `emergentintegrations==0.1.0`, added `stripe==15.0.1` and `google-auth==2.49.1`.
- **CORS hardening:** removed the `https://*.preview.emergentagent.com` regex from CORS. Now reads `FRONTEND_URL` + optional comma-separated `CORS_ORIGINS` env vars.
- **Static file serving:** when `SERVE_STATIC=1` the FastAPI app also serves the React build from `/app/backend/static/` (mounted at `/static`, with a catch-all `/{path}` falling back to `index.html` for BrowserRouter). This lets one Render service host both API and frontend on a single domain.

**Deployment kit (new files):**
- `/app/Dockerfile` — multi-stage: stage 1 builds React with `REACT_APP_*` build args, stage 2 runs FastAPI on `$PORT` and serves the built React from `/app/backend/static`.
- `/app/render.yaml` — Render Blueprint with all env-var slots (secrets `sync: false`, `JWT_SECRET` auto-generated).
- `/app/backend/.env.example` and `/app/frontend/.env.example` — committable templates.
- `/app/.gitignore.deploy` — example .gitignore (committed `.env` files excluded).
- `/app/DEPLOY.md` — end-to-end step-by-step guide: GitHub push, MongoDB Atlas free cluster, Google Cloud OAuth Client ID, Stripe TEST keys, Render Blueprint setup, custom domain `app.rintaki.org`, Stripe webhook hookup, smoke test, troubleshooting.

**Phase B (user's todo, doc'd in DEPLOY.md):**
1. Push repo via "Save to GitHub" button.
2. Create MongoDB Atlas free cluster → get `MONGO_URL`.
3. Create Google Cloud OAuth Client ID at https://console.cloud.google.com → get `GOOGLE_CLIENT_ID`.
4. Get Stripe TEST secret key from https://dashboard.stripe.com/apikeys → get `STRIPE_API_KEY`.
5. Render → New Blueprint → connect repo → paste env vars → deploy.
6. Add CNAME `app` → `<service>.onrender.com` at DNS provider.
7. Stripe Dashboard → Webhooks → add `https://app.rintaki.org/api/webhook/stripe` listening to `checkout.session.completed` → copy signing secret → paste back to Render as `STRIPE_WEBHOOK_SECRET`.

**Confirmed by Emergent support:** when self-hosting outside Emergent's deployment, no attribution is required and the badge / `emergent-main.js` / `@emergentbase/visual-edits` can all be removed. (Verbatim policy stored in this conversation.)

### 2026-04-24 — Security & correctness cleanup (code-review fixes)
- **XSS hardening:** added `/app/frontend/src/lib/sanitize.js` (DOMPurify wrapper with strict allow-list). Every `dangerouslySetInnerHTML` and every `div.innerHTML = …` that renders third-party (WordPress/WooCommerce) HTML now passes through `sanitizeHtml()`. Files updated: `Home.jsx`, `Shop.jsx`, `ForumThread.jsx`, `Events.jsx`, `EventDetail.jsx`, `DashboardSubs.jsx`.
- **Hardcoded test credentials removed:** `/app/backend/tests/backend_test.py` and `/app/backend/tests/test_mobile_pivot.py` now require `REACT_APP_BACKEND_URL`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` from env and raise on missing values instead of falling back to hardcoded strings.
- **server.py undefined-variable paths** (`_http_get_with_retry`, `refresh_gallery`, `_guide_cached`) — initialised variables before their `try` blocks so static analysers can verify each exit path.
- **React Hook dependency correctness:** wrapped `load`/`loadProfile` in `useCallback` with the proper deps and added it to the `useEffect` deps array in `TCGHome.jsx`, `TCGCollection.jsx`, `Videos.jsx`, `Profile.jsx`, `Events.jsx`. Removes stale-closure risk when ids/users change.
- **Component defined inside render:** extracted `EventList` out of `Events()` so it's no longer re-created every render (restores React reconciliation).
- **Array-index-as-key:** replaced `key={i}` with stable keys in `Join.jsx` (benefits list), `Guides.jsx` (3 spots — fallback + section maps), `EventsGallery.jsx` (thumbnail strip).
- **Deferred:** the "Important" refactor items from the review (splitting `server.py` monolith functions, `Admin.jsx`, `DashboardSubs.jsx.SubmitArticle`, `Layout.jsx`, `EventsGallery.jsx`, `Feed.jsx` into smaller pieces) were **not** applied — these are quality/maintainability improvements that are high-risk on a working, payment-handling codebase and are scheduled as separate focused PRs.

### 2026-04-24 — PWA installability verified in preview
- Removed `NODE_ENV === 'production'` gate on service-worker registration in `/app/frontend/src/App.js` so the SW also registers in preview/dev (PWA audit tools + install prompts now detect it).
- Verified in preview via Playwright:
  - `<link rel="manifest">` resolves and `/manifest.json` returns 200 with `name=Rintaki Anime Club Society`, `display=standalone`, 4 icons, `start_url=/`.
  - `navigator.serviceWorker.getRegistration()` returns an **activated** worker at scope `/` with `scriptURL=/service-worker.js`.
  - `<meta name="theme-color">` = `#000000` and `<link rel="apple-touch-icon">` present.
- P0 "PWA manifest + service worker (installable home-screen icon)" is now complete.


### 2026-04-22 — WooCommerce shop integration
- **New `/shop` page** + 5th quick-tile on Home ("Shop") — public access.
- Backend proxies WooCommerce Store API at `https://rintaki.org/wp-json/wc/store/v1`:
  - `GET /api/shop/products?page=&per_page=&search=&category=` (20 per page, 10-min cache)
  - `GET /api/shop/categories`
  - `GET /api/shop/products/{id}` detail
- Store API is public/no-auth; returns live product name, price, image(s), short + full description, categories, stock, on_sale flag.
- Frontend: 2-column product grid with live search (350ms debounce), category filter chips, pagination, "On sale" / "Out of stock" badges. Tap product → bottom-sheet modal with full detail + big "Add to cart — $X" CTA.
- Checkout flow: "Add to cart" opens `https://rintaki.org/?add-to-cart={id}&quantity=1` in a new tab — item auto-adds to WC cart, user completes payment on web.


- **Join page now auto-syncs** from `https://rintaki.org/membership-account/membership-levels/` every 1 hour (cached server-side).
- Scraper: finds every `a[href*="pmpro_level=N"]`, walks up to the card ancestor (h3 + ul), extracts name, subtitle (Monthly/Yearly Subscription), price via `$\s*[\d.]+\s*/\s*(mo|yr)` regex, and all benefit bullets.
- New endpoint `GET /api/memberships/levels?refresh=1` admins can force-refresh; UI has a "Force refresh" button at the bottom of the Join page for admins.
- Graceful fallback: stale cache → hardcoded minimum if scrape ever fails.
- Price/benefit changes made in PMPro on rintaki.org show up in the app automatically (no deploy required).


- **Anonymous browsing enabled**. Home, Forums, Forum threads, Events, Event detail, Events Gallery, TCG hub, TCG collections, Magazines, Library, Newsletters, Videos, and /more are now all publicly accessible without login.
- **Auth-gated (any logged-in user)**: Profile, Notifications, Tickets, Spotlight feed.
- **Member-gated (PMPro level ≥ 1 OR admin)**: Points, Messages, Members directory, Dashboard + all dashboard sub-pages, TCG claim/trade-in/trade, daily claim, posting/replying/liking in the forum.
- **Backend**:
  - `public_user()` now exposes `is_member`, `membership_level`, `membership_name` (admins auto `is_member=True`).
  - New `require_member` dependency → returns HTTP 403 `"This feature is for members only. Join the club to unlock it."` for non-members.
  - New `get_current_user_optional` helper for endpoints that want user context without requiring auth.
  - `mycred_balance()` now also returns PMPro `membership_level` + `membership_name`.
  - `public_user_enriched()` persists PMPro level to Mongo on every `/auth/me` hit (auto-promotes user to member once they buy via rintaki.org).
  - New endpoint `GET /api/memberships/levels` returns all 5 PMPro tiers (Free $0/mo, Regular $19.99/mo & $239.88/yr, Premium $39.99/mo & $479.88/yr) with benefits and `pmpro_level=N` checkout URLs.
- **Frontend**:
  - `Layout.jsx`: Top-bar points/cash pills hidden for non-members; "SIGN IN" CTA replaces pills for anonymous. Bottom tab #4 is **JOIN** (anonymous) or **SPOTLIGHT** (logged-in).
  - `Home.jsx`: Anonymous/non-member hero replaces username greeting and claim-daily button with "See membership benefits" CTA + "Already a member? Sign in".
  - `Forums.jsx`: "New thread" button replaced with "Join to post" link for non-members.
  - `More.jsx`: Members Dashboard card hidden for non-members — replaced with "Become a member" CTA. Logout button → "Sign in / Register" for anonymous.
  - New page `Join.jsx` at `/join` — shows all 5 PMPro tiers with benefits + deep-links to `https://rintaki.org/membership-account/membership-checkout/?pmpro_level=N`.
  - `App.js` route matrix refactored into `Public` / `Protected` / `MemberOnly` wrappers.
- **WP plugin `rintaki-app-sync.php` v1.1.0**: Now returns `membership_level` + `membership_name` in the balance response via PMPro's `pmpro_getMembershipLevelForUser()`. Once you install this updated plugin on rintaki.org, members who complete PMPro checkout will auto-sync to member status on their next app request.


- **New hierarchical model** `Event > Year > Gallery` — replaces the flat link-list approach.
- **New `galleries` MongoDB collection**: `{event, year, name, imagely_id, source_url, cover_image, images[], image_count, auto_synced, last_synced_at}`.
- **Backend scrape engine** (`_scrape_ngg_gallery`): follows NextGEN `/page/N` pagination, 503-retry with backoff, shared httpx client, 0.8s throttle between galleries.
- **Background sync job**: `POST /api/galleries/sync` returns `{job_id}` immediately; progress polled at `GET /api/galleries/sync/status/{job_id}`. Successfully imports all 15 rintaki.org galleries with full pagination (120/95/114/69-photo galleries now complete).
- **Endpoints**: `GET /api/galleries`, `GET /api/galleries/{id}`, `POST /api/galleries` (admin; takes event/year/name + imagely_id OR source_url), `POST /api/galleries/{id}/refresh`, `DELETE /api/galleries/{id}`.
- **Imagely ID convenience**: when admin enters just the numeric gallery ID, app derives URL `https://rintaki.org/gallery/nggallery/gallery/{id}` and pulls images.
- **Frontend rewrite** (`EventsGallery.jsx`):
  - Event headings → sticky year badges → 2-column gallery card grid.
  - Tap card → in-app fullscreen **Viewer** (prev/next buttons, keyboard arrows, swipe gestures, thumbnail strip, image counter). No external link.
  - Admin: "Sync from rintaki.org" (with live progress bar + "Now: {gallery}" status), "Add by ID" (event/year/name + imagely_id OR URL), per-card refresh + delete.
- Old `gallery_links` endpoints and collection removed.


### 2026-04-23 — Asgaros Forum native reply (verified)
- **Members can now reply to Asgaros topics directly from the app** (earns +2 pts).
- Backend: `POST /api/forums/asgaros/reply` (gated by `require_member`) proxies to the WP plugin `/wp-json/rintaki/v1/forum-reply` endpoint.
- WP plugin `rintaki-app-sync.php` **v1.3.0**: new `/forum-reply` endpoint resolves a topic slug → topic id via `sanitize_title(name)` match, inserts into `{prefix}forum_posts` with `parent_id=topic_id`, fires `asgarosforum_after_add_post` so notifications/indexes update.
- Frontend: `ForumThread.jsx` now shows a native reply form for members (Join CTA for non-members, Sign-in CTA for anonymous). Successful reply auto-refreshes the thread from source and shows a toast.
- Fix: ForumThread load logic now prefers the topic endpoint when a forum slug returns 0 topics (Asgaros reuses slugs between empty forums and topics).
- Fix: Improved "plugin needs upgrade" detection — now catches WP's `"No route was found"` 404 message and returns a clear 502 with upgrade instructions instead of a cryptic 404.
- **ACTION REQUIRED (USER)**: Upload `/app/wp-plugin/rintaki-app-sync.php` v1.3.0 to `rintaki.org` → *Plugins → Rintaki App Sync → Edit* (or re-zip and reinstall). Reply will 502 with an upgrade notice until this is done.

### 2026-04-23 — Four-feature round (verified end-to-end)

**1. TCG card titles from WP gallery figcaptions**
- Scraper `_scrape_page_images` now collects `<figcaption>` + Elementor lightbox title for every image.
- New parser `_parse_card_caption` extracts Set #, Card #, and Rarity from captions like "Set 1 – #1 – Common" (also handles "Super Rare", em/en-dashes, hyphens, pipes).
- Cards now store: name=full caption, number=sortable `S1-001`, rarity=`Common|Rare|Super Rare|…`.
- `POST /api/tcg/collections/{id}/resync` now **relabels** existing cards in-place when URLs already exist. Verified: all 60 cards in "Fashionista 2026 Collection" relabeled on first call (0 added, 60 relabeled).

**2. Spotlight native phone uploads**
- `POST /api/feed/upload` (multipart) accepts UploadFile for images (≤12MB: jpg/png/webp/heic/gif) and videos (≤60MB: mp4/mov/m4v/webm/3gp); streams to `/app/backend/uploads/spotlight/` and returns a relative URL.
- Files served via `app.mount("/api/uploads/spotlight", StaticFiles(...))` so they pass through the k8s `/api/*` ingress on port 8001.
- Frontend Feed new-post modal replaced URL input with **Take photo/video** (camera, `capture="environment"`) + **Choose from phone** buttons. Live upload progress bar, auto-validates video duration ≤15s before submit.
- Admin queue + public feed render uploaded URLs via `resolveMediaUrl()` (prefixes `REACT_APP_BACKEND_URL`).

**3. Live Points & Anime Cash guides (synced from rintaki.org)**
- `GET /api/guides/points` → scrapes `https://rintaki.org/points/`
- `GET /api/guides/anime-cash` → scrapes `https://rintaki.org/member-dashboard/anime-cash/`
- Returns sanitized HTML (strips scripts/styles/forms/nav/header/footer/cart/MyCred per-user widgets), absolutizes links/images, caches 1h with stale-fallback, `?refresh=1` force-refresh.
- `Guides.jsx` rewritten with a shared `<LiveGuide>` wrapper: loading spinner, admin refresh button, "Cached/Just synced/Stale" footer, offline fallback Cards. New `.rintaki-guide` typography class in `index.css`.

**4. Events Gallery 4-level drill-down**
- Rewrote `EventsGallery.jsx` with `nav` state machine:
  1. Events grid (tiles with first-gallery cover image + total photo count)
  2. Year list (text-only buttons, no images) — shows gallery/photo counts per year
  3. Sub-galleries grid (Cosplayers, Misc, etc. with cover images)
  4. In-app fullscreen Viewer (unchanged)
- Back chevrons at each level, tested with Anime Expo → 2009 → Cosplayers/Misc.

**ACTION REQUIRED (USER)**: *None.* All four features work without additional plugin updates. Existing `rintaki-app-sync.php` v1.3.0 still needs uploading for forum replies (unchanged from previous session).

### 2026-04-23 — Guides redesign + logout fix
- **Guides redesigned**: New `/api/guides/points/parsed` + `/api/guides/anime-cash/parsed` endpoints parse the scraped HTML into structured `{heading, intro, items:[{amount,unit,desc}]}` sections. Regex splits on `<br>`/newlines inside `<p>` tags, matches lines starting with `(AMOUNT UNIT[ per X])` as items. Admin refresh still supported.
- `Guides.jsx` rewritten: black hero card + user's live stat (Points/Anime Cash balance), sectioned cards with themed icons (Star/Users/Trophy/Gift) and brutal color rotation (red/gold/accent/black/purple/white), each item gets a pill showing the amount with shortened unit ("25 PTS / HR", "$5 / MO"). Six sections render from rintaki.org/points: Member Status, Sign-In Sheet, Submissions, Awards, Community, Bonuses.
- The Anime Cash page on rintaki.org is PMPro-gated — app detects the "Membership Required" placeholder and falls back to an in-app summary with a "Locked on rintaki.org" notice.
- **Logout fix**: logout from Dashboard/More used to leave users on `/login` because `<Protected>` redirected before the home navigate ran. Fix: call `navigate("/", { replace: true })` BEFORE `logout()` so setUser(null) re-renders on the already-public home route. Also added a "Log out" button to the Members Dashboard itself (previously only on /more).

### 2026-04-23 — Points Guide: claim-and-verify → MyCred on rintaki.org
- **Diagnosis first**: plugin installed correctly on rintaki.org, secret matches. Only missing piece was v1.3.0+ plugin upload. JWT Auth plugin on the site hijacks `Authorization: Bearer`, so we stayed on `X-Rintaki-Key`.
- **WP plugin v1.4.0**:
  - `/adjust` endpoint now accepts an optional `ref` idempotency key — uses `mycred_has_entry()` to skip if already credited. Every app-triggered award stores its ref in MyCred's entry data so duplicates can't happen across retries.
- **Backend**:
  - `add_points()` / `add_anime_cash()` now accept `ref`. Forum replies, daily login, Spotlight approvals, theme-set awards, article approvals all updated to pass stable refs.
  - New endpoints: `POST /guides/points/claim` (member submits), `GET /guides/points/my-claims` (member history), `GET /admin/point-claims?status=` (admin queue), `POST /admin/point-claims/{id}/approve|reject`.
  - Approval awards via `add_points()` → `mycred_adjust()` → WP plugin `/adjust` with `ref=claim:{id}`, so every approved claim becomes a real MyCred log entry on rintaki.org (visible in the Points History widget).
  - Claim photos: accept base64 data URL, saved to `/app/backend/uploads/claims/`, served via `/api/uploads/claims/` (StaticFiles mount).
  - `/auth/me` now awards `+1 daily visit` per UTC day (idempotent via ref=`visit:{user}:{date}`) and checks the monthly Active-Member bonus.
  - Active-Member bonus: +50 pts on the first `/auth/me` call of a new month IF the user earned ≥ **400 pts** in the prior calendar month (excluding prior active-member credits to prevent self-amplification). 400 = 1/3 of the ceiling of all manual+admin points.
  - Points-Guide item classification (3 modes):
    - **AUTO** (5 items): daily visit, fan art, merch art, anime reviews, forum reply
    - **ADMIN** (6 items): officer positions, MOTM, giveaways, 1000-pts streak, exemplary participation
    - **CLAIM** (18 items): rest of the page — members tap Claim, admin approves.
  - Indexes: `points_transactions.ref`, `point_claims.{status,created_at}` & `{user_id,created_at}`.
- **Frontend**:
  - `Guides.jsx`: each item now shows a **mode badge** (AUTO ✓ / ADMIN shield / CLAIM paper-plane). Members see a **Claim** button on claim-mode items, with a banner showing their pending/approved counts.
  - Claim modal: pre-fills amount (low end of range for ranged items), optional note (500 char) + optional photo (≤6 MB). Photo → base64 → backend storage → admin sees proof.
  - `Admin.jsx`: new "Point claims" approval queue with member info, photo preview, override-amount field, admin-note field, and "Approve & credit MyCred" / "Reject" buttons.
- **Verified end-to-end**: submitted claim → admin approved → rintaki.org admin's MyCred balance went from 1403 → 1428 (+1 daily visit +25 claim). Second `/auth/me` call did NOT re-award daily visit (idempotency confirmed).

**ACTION REQUIRED (USER)**: Upload the latest `/app/wp-plugin/rintaki-app-sync.php` (v1.4.0) to rintaki.org. Until done, claim approvals will still work (MyCred gets credited via the existing `/adjust` endpoint), but:
  - Forum replies won't post (`/forum-reply` endpoint new in v1.3.0)
  - Claim-approval awards can be duplicated if the backend retries (idempotency `ref` is new in v1.4.0)
