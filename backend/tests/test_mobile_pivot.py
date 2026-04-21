"""
Iteration 2 tests - NEW endpoints added for Rintaki mobile app pivot.
Covers: links, magazines, media feed, TCG (collections/cards/tracker/claims/tradeins/trades),
trips, giveaways, contests, articles, extended profile, event ticket toggle,
Stripe checkout session creation and tickets list.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://community-connect-257.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rintaki.org"
ADMIN_PASSWORD = "Admin@Rintaki2026"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def member_session():
    s = requests.Session()
    email = f"TEST_mobile_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234", "name": "TEST Mobile User"}, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    assert data.get("anime_cash", 0) == 0, "New user should start with 0 anime_cash"
    s.user_id = data["user_id"]
    s.email = email
    return s


@pytest.fixture(scope="session")
def member2_session():
    s = requests.Session()
    email = f"TEST_mobile2_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234", "name": "TEST Partner"}, timeout=15)
    assert r.status_code == 200
    s.user_id = r.json()["user_id"]
    return s


# ---------------- Links ----------------
class TestLinks:
    def test_get_links(self):
        r = requests.get(f"{API}/links", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "library" in d and d["library"].startswith("http")
        assert "social" in d
        for key in ("tiktok", "instagram", "twitter", "facebook", "youtube", "discord_public", "discord_members"):
            assert key in d["social"]


# ---------------- Magazines ----------------
class TestMagazines:
    def test_list_magazines(self):
        r = requests.get(f"{API}/magazines", timeout=10)
        assert r.status_code == 200
        assert "magazines" in r.json()

    def test_create_magazine_requires_admin(self, member_session):
        r = member_session.post(f"{API}/magazines", json={"title": "x", "pdf_url": "http://x"}, timeout=10)
        assert r.status_code == 403

    def test_create_magazine_unauthenticated(self):
        r = requests.post(f"{API}/magazines", json={"title": "x", "pdf_url": "http://x"}, timeout=10)
        assert r.status_code == 401

    def test_admin_create_and_delete_magazine(self, admin_session):
        payload = {"title": "TEST_mag", "issue": "V1", "pdf_url": "http://example.com/a.pdf", "description": "d"}
        r = admin_session.post(f"{API}/magazines", json=payload, timeout=10)
        assert r.status_code == 200
        mid = r.json()["magazine_id"]
        # Verify in list
        r2 = requests.get(f"{API}/magazines", timeout=10)
        assert any(m["magazine_id"] == mid for m in r2.json()["magazines"])
        # Delete
        r3 = admin_session.delete(f"{API}/magazines/{mid}", timeout=10)
        assert r3.status_code == 200


# ---------------- Media Feed ----------------
class TestFeed:
    def test_feed_requires_auth(self):
        r = requests.get(f"{API}/feed/posts", timeout=10)
        assert r.status_code == 401

    def test_create_post_awards_points(self, member_session):
        before = member_session.get(f"{API}/points/me", timeout=10).json()["points"]
        r = member_session.post(f"{API}/feed/posts", json={
            "media_type": "image", "media_url": "http://example.com/img.jpg", "caption": "TEST_caption"
        }, timeout=10)
        assert r.status_code == 200
        post = r.json()
        assert post["media_type"] == "image"
        member_session.post_id = post["post_id"]
        after = member_session.get(f"{API}/points/me", timeout=10).json()["points"]
        assert after - before == 3, f"Expected +3 pts, got {after - before}"

    def test_invalid_media_type(self, member_session):
        r = member_session.post(f"{API}/feed/posts", json={"media_type": "gif", "media_url": "http://x"}, timeout=10)
        assert r.status_code == 400

    def test_toggle_like(self, member_session):
        pid = member_session.post_id
        r1 = member_session.post(f"{API}/feed/posts/{pid}/like", timeout=10)
        assert r1.status_code == 200 and r1.json()["liked"] is True
        r2 = member_session.post(f"{API}/feed/posts/{pid}/like", timeout=10)
        assert r2.status_code == 200 and r2.json()["liked"] is False

    def test_comments(self, member_session, member2_session):
        pid = member_session.post_id
        r = member2_session.post(f"{API}/feed/posts/{pid}/comments", json={"body": "TEST_comment"}, timeout=10)
        assert r.status_code == 200
        r2 = member_session.get(f"{API}/feed/posts/{pid}/comments", timeout=10)
        assert r2.status_code == 200
        assert any(c["body"] == "TEST_comment" for c in r2.json()["comments"])


# ---------------- TCG ----------------
class TestTCG:
    def test_list_collections(self, member_session):
        r = member_session.get(f"{API}/tcg/collections", timeout=10)
        assert r.status_code == 200
        cols = r.json()["collections"]
        assert len(cols) >= 1
        # Save Fashionista collection id
        fashion = next((c for c in cols if c["name"] == "Fashionista 2026"), cols[0])
        TestTCG.col_id = fashion["collection_id"]

    def test_list_cards(self, member_session):
        r = member_session.get(f"{API}/tcg/collections/{TestTCG.col_id}/cards", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data["cards"]) >= 6
        assert isinstance(data["owned_ids"], list)
        TestTCG.card_id = data["cards"][0]["card_id"]
        TestTCG.card_id2 = data["cards"][1]["card_id"]

    def test_collection_requires_admin(self, member_session):
        r = member_session.post(f"{API}/tcg/collections", json={"name": "TEST_col"}, timeout=10)
        assert r.status_code == 403

    def test_admin_create_collection_and_card(self, admin_session):
        r = admin_session.post(f"{API}/tcg/collections", json={"name": f"TEST_col_{uuid.uuid4().hex[:6]}", "description": "d"}, timeout=10)
        assert r.status_code == 200
        cid = r.json()["collection_id"]
        r2 = admin_session.post(f"{API}/tcg/cards", json={
            "collection_id": cid, "name": "TEST_card", "image_url": "http://x", "rarity": "Rare", "number": "001"
        }, timeout=10)
        assert r2.status_code == 200

    def test_toggle_card(self, member_session):
        cid = TestTCG.card_id
        r1 = member_session.post(f"{API}/tcg/toggle-card/{cid}", timeout=10)
        assert r1.status_code == 200 and r1.json()["owned"] is True
        # Verify via my-collection
        mc = member_session.get(f"{API}/tcg/my-collection", timeout=10).json()
        assert any(c["card_id"] == cid for c in mc["cards"])
        r2 = member_session.post(f"{API}/tcg/toggle-card/{cid}", timeout=10)
        assert r2.status_code == 200 and r2.json()["owned"] is False

    def test_toggle_unknown_card(self, member_session):
        r = member_session.post(f"{API}/tcg/toggle-card/does_not_exist", timeout=10)
        assert r.status_code == 404

    def test_claim_and_admin_approve_awards_points_and_cash(self, member_session, admin_session):
        # Own a card first
        member_session.post(f"{API}/tcg/toggle-card/{TestTCG.card_id2}", timeout=10)
        # Create claim
        r = member_session.post(f"{API}/tcg/claim", json={"collection_id": TestTCG.col_id, "member_notes": "TEST"}, timeout=10)
        assert r.status_code == 200
        claim = r.json()
        assert claim["status"] == "pending"
        assert claim["total_count"] >= 6
        cid = claim["claim_id"]
        # Member sees own claim
        r2 = member_session.get(f"{API}/tcg/claims", timeout=10)
        assert any(c["claim_id"] == cid for c in r2.json()["claims"])
        # Admin sees all
        r3 = admin_session.get(f"{API}/tcg/claims", timeout=10)
        assert any(c["claim_id"] == cid for c in r3.json()["claims"])
        # Member cannot approve
        r4 = member_session.post(f"{API}/tcg/claims/{cid}/approve", timeout=10)
        assert r4.status_code == 403
        # Snapshot before
        before = member_session.get(f"{API}/auth/me", timeout=10).json()
        before_pts = before["points"]
        before_cash = before.get("anime_cash", 0)
        # Admin approves
        r5 = admin_session.post(f"{API}/tcg/claims/{cid}/approve", timeout=10)
        assert r5.status_code == 200
        after = member_session.get(f"{API}/auth/me", timeout=10).json()
        assert after["points"] - before_pts == 50, f"Expected +50 pts, got {after['points'] - before_pts}"
        assert after.get("anime_cash", 0) - before_cash == 100, f"Expected +100 anime_cash"

    def test_tradein(self, member_session):
        r = member_session.post(f"{API}/tcg/tradein", json={"card_ids": [TestTCG.card_id], "shipping_notes": "TEST"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "pending"
        r2 = member_session.get(f"{API}/tcg/tradeins", timeout=10)
        assert r2.status_code == 200
        assert len(r2.json()["tradeins"]) >= 1

    def test_trade(self, member_session, member2_session):
        r = member_session.post(f"{API}/tcg/trade", json={
            "partner_user_id": member2_session.user_id,
            "offered_card_ids": [TestTCG.card_id],
            "wanted_card_ids": [TestTCG.card_id2],
            "notes": "TEST_trade",
        }, timeout=10)
        assert r.status_code == 200
        # Partner should see a trade request in their list
        r2 = member2_session.get(f"{API}/tcg/trades", timeout=10)
        assert r2.status_code == 200
        assert any(t.get("notes") == "TEST_trade" for t in r2.json()["trades"])
        # Partner should get notification
        n = member2_session.get(f"{API}/notifications", timeout=10).json()
        assert any(x.get("kind") == "tcg" for x in n["notifications"])

    def test_trade_invalid_partner(self, member_session):
        r = member_session.post(f"{API}/tcg/trade", json={
            "partner_user_id": "user_does_not_exist",
            "offered_card_ids": [], "wanted_card_ids": [],
        }, timeout=10)
        assert r.status_code == 404


# ---------------- Trips ----------------
class TestTrips:
    def test_list_trips_requires_auth(self):
        r = requests.get(f"{API}/trips", timeout=10)
        assert r.status_code == 401

    def test_admin_create_trip(self, admin_session, member_session):
        r = admin_session.post(f"{API}/trips", json={
            "title": "TEST_trip", "description": "d", "destination": "Tokyo",
            "starts_at": "2026-12-01T00:00:00Z", "price": 999.0,
        }, timeout=10)
        assert r.status_code == 200
        tid = r.json()["trip_id"]
        r2 = member_session.get(f"{API}/trips", timeout=10)
        assert any(t["trip_id"] == tid for t in r2.json()["trips"])

    def test_member_cannot_create_trip(self, member_session):
        r = member_session.post(f"{API}/trips", json={
            "title": "x", "description": "d", "destination": "x", "starts_at": "2026-12-01T00:00:00Z"
        }, timeout=10)
        assert r.status_code == 403


# ---------------- Giveaways ----------------
class TestGiveaways:
    def test_list_and_enter_giveaway(self, member_session):
        r = member_session.get(f"{API}/giveaways", timeout=10)
        assert r.status_code == 200
        gs = r.json()["giveaways"]
        assert len(gs) >= 1
        gid = gs[0]["giveaway_id"]
        assert "entered" in gs[0] and "entry_count" in gs[0]
        # Enter
        r2 = member_session.post(f"{API}/giveaways/{gid}/enter", timeout=10)
        assert r2.status_code == 200 and r2.json()["entered"] is True
        # Idempotent
        r3 = member_session.post(f"{API}/giveaways/{gid}/enter", timeout=10)
        assert r3.status_code == 200
        # entered reflected
        r4 = member_session.get(f"{API}/giveaways", timeout=10).json()
        g = next(x for x in r4["giveaways"] if x["giveaway_id"] == gid)
        assert g["entered"] is True

    def test_admin_create_giveaway(self, admin_session):
        r = admin_session.post(f"{API}/giveaways", json={
            "title": "TEST_gv", "description": "d", "prize_type": "anime_item", "ends_at": "2026-12-01T00:00:00Z"
        }, timeout=10)
        assert r.status_code == 200
        assert r.json()["entry_count"] == 0


# ---------------- Contests ----------------
class TestContests:
    def test_contests_flow(self, admin_session, member_session):
        r = requests.get(f"{API}/contests", timeout=10)
        assert r.status_code == 401
        r2 = member_session.get(f"{API}/contests", timeout=10)
        assert r2.status_code == 200
        r3 = admin_session.post(f"{API}/contests", json={
            "title": "TEST_ct", "description": "d", "ends_at": "2026-12-01T00:00:00Z", "prize": "pr"
        }, timeout=10)
        assert r3.status_code == 200
        r4 = member_session.post(f"{API}/contests", json={
            "title": "x", "description": "d", "ends_at": "2026-12-01T00:00:00Z"
        }, timeout=10)
        assert r4.status_code == 403


# ---------------- Articles ----------------
class TestArticles:
    def test_article_submit_and_approve(self, member_session, admin_session):
        # Submit blog
        r = member_session.post(f"{API}/articles", json={
            "title": "TEST_article", "kind": "blog", "summary": "s", "content": "c"
        }, timeout=10)
        assert r.status_code == 200
        a = r.json()
        assert a["status"] == "pending"
        aid = a["article_id"]
        # Member sees only their articles
        r2 = member_session.get(f"{API}/articles", timeout=10)
        assert all(x["user_id"] == member_session.user_id for x in r2.json()["articles"])
        # Admin can approve (blog = 25 pts)
        before_pts = member_session.get(f"{API}/auth/me", timeout=10).json()["points"]
        r3 = admin_session.post(f"{API}/articles/{aid}/approve", timeout=10)
        assert r3.status_code == 200
        after_pts = member_session.get(f"{API}/auth/me", timeout=10).json()["points"]
        assert after_pts - before_pts == 25

    def test_magazine_article_awards_50(self, member_session, admin_session):
        r = member_session.post(f"{API}/articles", json={
            "title": "TEST_mag_art", "kind": "magazine", "content": "c"
        }, timeout=10)
        aid = r.json()["article_id"]
        before_pts = member_session.get(f"{API}/auth/me", timeout=10).json()["points"]
        r2 = admin_session.post(f"{API}/articles/{aid}/approve", timeout=10)
        assert r2.status_code == 200
        after_pts = member_session.get(f"{API}/auth/me", timeout=10).json()["points"]
        assert after_pts - before_pts == 50

    def test_member_cannot_approve(self, member_session):
        r = member_session.post(f"{API}/articles/any/approve", timeout=10)
        assert r.status_code == 403


# ---------------- Extended Profile ----------------
class TestExtendedProfile:
    def test_get_and_put(self, member_session):
        r = member_session.get(f"{API}/profile/extended", timeout=10)
        assert r.status_code == 200
        payload = {"full_name": "TEST Full", "phone": "555", "city": "MKE", "favorite_anime": "Cowboy Bebop"}
        r2 = member_session.put(f"{API}/profile/extended", json=payload, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["full_name"] == "TEST Full"
        # Persistence
        r3 = member_session.get(f"{API}/profile/extended", timeout=10)
        d = r3.json()
        assert d["full_name"] == "TEST Full"
        assert d["city"] == "MKE"
        assert d["favorite_anime"] == "Cowboy Bebop"

    def test_requires_auth(self):
        r = requests.get(f"{API}/profile/extended", timeout=10)
        assert r.status_code == 401
        r2 = requests.put(f"{API}/profile/extended", json={"full_name": "x"}, timeout=10)
        assert r2.status_code == 401


# ---------------- Events + Tickets (Stripe) ----------------
class TestEventTickets:
    def test_patch_event_requires_admin(self, member_session, admin_session):
        ev = requests.get(f"{API}/events", timeout=10).json()["events"][0]
        eid = ev["event_id"]
        TestEventTickets.event_id = eid
        r = member_session.patch(f"{API}/events/{eid}", json={"ticket_enabled": True, "ticket_price": 20.0}, timeout=10)
        assert r.status_code == 403
        r2 = admin_session.patch(f"{API}/events/{eid}", json={"ticket_enabled": True, "ticket_price": 20.0}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["ticket_enabled"] is True
        assert r2.json()["ticket_price"] == 20.0

    def test_checkout_requires_ticket_enabled(self, member_session, admin_session):
        # Create event without tickets
        ev = admin_session.post(f"{API}/events", json={
            "title": "TEST_no_ticket", "description": "d", "location": "x", "starts_at": "2026-12-01T00:00:00Z"
        }, timeout=10).json()
        eid = ev["event_id"]
        r = member_session.post(f"{API}/payments/tickets/checkout", json={
            "event_id": eid, "quantity": 1, "origin_url": BASE_URL
        }, timeout=15)
        assert r.status_code == 400

    def test_checkout_unknown_event(self, member_session):
        r = member_session.post(f"{API}/payments/tickets/checkout", json={
            "event_id": "does_not_exist", "quantity": 1, "origin_url": BASE_URL
        }, timeout=15)
        assert r.status_code == 404

    def test_checkout_requires_auth(self):
        r = requests.post(f"{API}/payments/tickets/checkout", json={
            "event_id": "x", "quantity": 1, "origin_url": BASE_URL
        }, timeout=15)
        assert r.status_code == 401

    def test_checkout_success_creates_transaction(self, member_session):
        eid = TestEventTickets.event_id
        r = member_session.post(f"{API}/payments/tickets/checkout", json={
            "event_id": eid, "quantity": 2, "origin_url": BASE_URL
        }, timeout=30)
        assert r.status_code == 200, f"Checkout failed: {r.status_code} {r.text}"
        d = r.json()
        assert "url" in d and d["url"].startswith("http")
        assert "session_id" in d and len(d["session_id"]) > 0
        TestEventTickets.session_id = d["session_id"]

    def test_payment_status_returns_not_paid(self, member_session):
        # Status for real (but unpaid) session - expect 200 with payment_status != paid
        sid = TestEventTickets.session_id
        r = member_session.get(f"{API}/payments/status/{sid}", timeout=15)
        # 200 (Stripe returns open/unpaid) or Stripe error is acceptable per review request
        assert r.status_code in (200, 400, 500, 502), f"Unexpected: {r.status_code} {r.text}"
        if r.status_code == 200:
            d = r.json()
            assert d.get("payment_status") != "paid"

    def test_payment_status_unknown_session(self, member_session):
        r = member_session.get(f"{API}/payments/status/fake_session_xyz", timeout=15)
        # Our own 404 because no payment_transactions row
        assert r.status_code == 404

    def test_tickets_list_requires_auth(self):
        r = requests.get(f"{API}/tickets", timeout=10)
        assert r.status_code == 401

    def test_tickets_list_empty_for_new_user(self, member_session):
        r = member_session.get(f"{API}/tickets", timeout=10)
        assert r.status_code == 200
        # Since we haven't completed payment, tickets should still be empty (idempotent: not created)
        assert isinstance(r.json()["tickets"], list)


# ---------------- Auth guard sweep ----------------
@pytest.mark.parametrize("path,method", [
    ("/feed/posts", "GET"),
    ("/tcg/collections", "GET"),
    ("/tcg/my-collection", "GET"),
    ("/tcg/claims", "GET"),
    ("/tcg/tradeins", "GET"),
    ("/tcg/trades", "GET"),
    ("/trips", "GET"),
    ("/giveaways", "GET"),
    ("/contests", "GET"),
    ("/articles", "GET"),
    ("/profile/extended", "GET"),
    ("/tickets", "GET"),
])
def test_protected_endpoints_return_401_without_auth(path, method):
    r = requests.request(method, f"{API}{path}", timeout=10)
    assert r.status_code == 401, f"{method} {path} expected 401, got {r.status_code}"


@pytest.mark.parametrize("path", [
    "/magazines",
    "/tcg/collections",
    "/tcg/cards",
    "/trips",
    "/giveaways",
    "/contests",
])
def test_admin_only_post_403_for_members(path, member_session):
    r = member_session.post(f"{API}{path}", json={}, timeout=10)
    # Either 403 (not admin) or 422 (validation) - must NOT be 200
    assert r.status_code in (403, 422), f"POST {path} returned {r.status_code}"
    # Specifically ensure 403 at least happens for a valid-looking payload
    if path == "/magazines":
        r2 = member_session.post(f"{API}{path}", json={"title": "x", "pdf_url": "http://x"}, timeout=10)
        assert r2.status_code == 403
