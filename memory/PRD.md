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
