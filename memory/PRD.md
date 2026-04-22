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

