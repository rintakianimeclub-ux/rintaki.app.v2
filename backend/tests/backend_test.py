"""Rintaki Anime Club API - comprehensive backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL must be set in the environment to run tests")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL") or ""
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD") or ""
if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    raise RuntimeError("TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in the environment to run tests")


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    assert "access_token" in s.cookies, f"No access_token cookie. Got: {list(s.cookies.keys())}"
    return s


@pytest.fixture(scope="session")
def member_session():
    s = requests.Session()
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234", "name": "TEST Member"})
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == email.lower()
    assert data["points"] == 10, f"Welcome bonus not awarded, got points={data.get('points')}"
    assert "access_token" in s.cookies
    s.user_id = data["user_id"]  # type: ignore[attr-defined]
    s.email = email.lower()  # type: ignore[attr-defined]
    return s


@pytest.fixture(scope="session")
def member_session_2():
    s = requests.Session()
    email = f"TEST_user2_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234", "name": "TEST Member2"})
    assert r.status_code == 200
    s.user_id = r.json()["user_id"]  # type: ignore[attr-defined]
    return s


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "Rintaki" in data["app"]


# ---------- Auth ----------
class TestAuth:
    def test_register_and_cookies(self):
        s = requests.Session()
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@test.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234", "name": "Reg User"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == email.lower()
        assert data["points"] == 10
        assert data["role"] == "member"
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_register_duplicate(self, member_session):
        r = requests.post(f"{API}/auth/register", json={"email": member_session.email, "password": "Pass1234", "name": "x"})
        assert r.status_code == 400

    def test_admin_login(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_login_invalid(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG_PASSWORD"})
        assert r.status_code == 401

    def test_me_with_cookie(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout_clears_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        r2 = s.post(f"{API}/auth/logout")
        assert r2.status_code == 200
        # After logout cookies should be cleared (session discards expired cookies)
        r3 = s.get(f"{API}/auth/me")
        assert r3.status_code == 401

    def test_google_session_missing_header(self):
        r = requests.post(f"{API}/auth/google/session")
        assert r.status_code == 400

    def test_google_session_fake_id(self):
        r = requests.post(f"{API}/auth/google/session", headers={"X-Session-ID": "fake-invalid-session-id-xyz"})
        assert r.status_code in (401, 502), f"Expected 401/502, got {r.status_code}"


# ---------- Protected endpoint auth dependency ----------
class TestAuthDependency:
    @pytest.mark.parametrize("path,method", [
        ("/auth/me", "GET"),
        ("/profile", "PATCH"),
        ("/forums/threads", "POST"),
        ("/points/me", "GET"),
        ("/points/daily-claim", "POST"),
        ("/messages", "POST"),
        ("/messages/conversations", "GET"),
        ("/notifications", "GET"),
        ("/admin/stats", "GET"),
        ("/members", "GET"),
    ])
    def test_requires_auth(self, path, method):
        r = requests.request(method, f"{API}{path}", json={} if method != "GET" else None)
        assert r.status_code == 401, f"{method} {path} expected 401, got {r.status_code}"


# ---------- Rintaki feed ----------
class TestRintakiFeed:
    def test_feed(self):
        r = requests.get(f"{API}/rintaki/feed", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "posts" in data
        assert isinstance(data["posts"], list)


# ---------- Forums ----------
class TestForums:
    def test_thread_flow(self, member_session, member_session_2):
        # create
        r = member_session.post(f"{API}/forums/threads", json={
            "title": "TEST_thread_title", "body": "TEST body content", "category": "General"
        })
        assert r.status_code == 200
        t = r.json()
        assert t["title"] == "TEST_thread_title"
        assert t["reply_count"] == 0
        tid = t["thread_id"]

        # list
        r = requests.get(f"{API}/forums/threads")
        assert r.status_code == 200
        assert any(x["thread_id"] == tid for x in r.json()["threads"])

        # get single
        r = requests.get(f"{API}/forums/threads/{tid}")
        assert r.status_code == 200
        assert r.json()["thread"]["thread_id"] == tid
        assert r.json()["replies"] == []

        # reply from another user (+2 points + notif to author)
        r = member_session_2.post(f"{API}/forums/threads/{tid}/replies", json={"body": "TEST reply"})
        assert r.status_code == 200
        assert r.json()["body"] == "TEST reply"

        # reply_count incremented
        r = requests.get(f"{API}/forums/threads/{tid}")
        assert r.json()["thread"]["reply_count"] == 1
        assert len(r.json()["replies"]) == 1

        # like toggle
        r = member_session_2.post(f"{API}/forums/threads/{tid}/like")
        assert r.status_code == 200 and r.json()["liked"] is True
        r = member_session_2.post(f"{API}/forums/threads/{tid}/like")
        assert r.status_code == 200 and r.json()["liked"] is False

        # notif created for author (original poster)
        r = member_session.get(f"{API}/notifications")
        assert r.status_code == 200
        kinds = [n["kind"] for n in r.json()["notifications"]]
        assert "reply" in kinds

    def test_get_missing_thread(self):
        r = requests.get(f"{API}/forums/threads/th_nonexistent")
        assert r.status_code == 404


# ---------- Points ----------
class TestPoints:
    def test_points_me(self, member_session):
        r = member_session.get(f"{API}/points/me")
        assert r.status_code == 200
        data = r.json()
        assert "points" in data and "transactions" in data and "badges" in data
        assert isinstance(data["transactions"], list)

    def test_daily_claim(self, member_session_2):
        r = member_session_2.post(f"{API}/points/daily-claim")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # duplicate same-day
        r2 = member_session_2.post(f"{API}/points/daily-claim")
        assert r2.status_code == 400

    def test_leaderboard(self):
        r = requests.get(f"{API}/points/leaderboard")
        assert r.status_code == 200
        lb = r.json()["leaderboard"]
        assert isinstance(lb, list)
        if len(lb) > 1:
            for i in range(len(lb) - 1):
                assert lb[i]["points"] >= lb[i + 1]["points"]


# ---------- Events ----------
class TestEvents:
    def test_list_events_seeded(self):
        r = requests.get(f"{API}/events")
        assert r.status_code == 200
        assert len(r.json()["events"]) >= 2

    def test_create_event_member_forbidden(self, member_session):
        r = member_session.post(f"{API}/events", json={
            "title": "TEST_ev", "description": "x", "location": "y",
            "starts_at": "2026-12-01T00:00:00+00:00"
        })
        assert r.status_code == 403

    def test_create_event_admin_ok(self, admin_session):
        r = admin_session.post(f"{API}/events", json={
            "title": "TEST_admin_event", "description": "d", "location": "l",
            "starts_at": "2026-12-01T00:00:00+00:00"
        })
        assert r.status_code == 200
        ev = r.json()
        assert ev["title"] == "TEST_admin_event"
        assert "event_id" in ev


# ---------- Newsletters ----------
class TestNewsletters:
    def test_list_newsletters_seeded(self):
        r = requests.get(f"{API}/newsletters")
        assert r.status_code == 200
        assert len(r.json()["newsletters"]) >= 1

    def test_create_newsletter_member_forbidden(self, member_session):
        r = member_session.post(f"{API}/newsletters", json={
            "title": "t", "summary": "s", "content": "c"
        })
        assert r.status_code == 403

    def test_create_newsletter_admin(self, admin_session):
        r = admin_session.post(f"{API}/newsletters", json={
            "title": "TEST_nl", "summary": "s", "content": "c"
        })
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_nl"


# ---------- Videos ----------
class TestVideos:
    def test_list_videos(self):
        r = requests.get(f"{API}/videos")
        assert r.status_code == 200
        assert "videos" in r.json()

    def test_create_video_member_forbidden(self, member_session):
        r = member_session.post(f"{API}/videos", json={
            "title": "t", "description": "d", "url": "https://youtu.be/x"
        })
        assert r.status_code == 403

    def test_create_video_admin(self, admin_session):
        r = admin_session.post(f"{API}/videos", json={
            "title": "TEST_video", "description": "d", "url": "https://youtu.be/xyz"
        })
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_video"


# ---------- Messages ----------
class TestMessages:
    def test_send_and_list(self, member_session, member_session_2):
        to_id = member_session_2.user_id  # type: ignore[attr-defined]
        r = member_session.post(f"{API}/messages", json={"to_user_id": to_id, "body": "TEST dm hello"})
        assert r.status_code == 200
        assert r.json()["body"] == "TEST dm hello"

        r = member_session.get(f"{API}/messages/conversations")
        assert r.status_code == 200
        convos = r.json()["conversations"]
        assert any(c["user"]["user_id"] == to_id for c in convos)

        r = member_session_2.get(f"{API}/messages/with/{member_session.user_id}")  # type: ignore[attr-defined]
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert any(m["body"] == "TEST dm hello" for m in msgs)

        # recipient gets a notification
        r = member_session_2.get(f"{API}/notifications")
        kinds = [n["kind"] for n in r.json()["notifications"]]
        assert "message" in kinds

    def test_cannot_message_self(self, member_session):
        r = member_session.post(f"{API}/messages", json={"to_user_id": member_session.user_id, "body": "x"})  # type: ignore[attr-defined]
        assert r.status_code == 400

    def test_unknown_recipient(self, member_session):
        r = member_session.post(f"{API}/messages", json={"to_user_id": "user_doesnotexist", "body": "x"})
        assert r.status_code == 404


# ---------- Notifications ----------
class TestNotifications:
    def test_list_and_read_all(self, member_session):
        r = member_session.get(f"{API}/notifications")
        assert r.status_code == 200
        assert "notifications" in r.json() and "unread" in r.json()

        r = member_session.post(f"{API}/notifications/read-all")
        assert r.status_code == 200

        r = member_session.get(f"{API}/notifications")
        assert r.json()["unread"] == 0


# ---------- Profile ----------
class TestProfile:
    def test_update_profile(self, member_session):
        r = member_session.patch(f"{API}/profile", json={"name": "TEST New Name", "bio": "TEST bio"})
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST New Name"
        assert data["bio"] == "TEST bio"


# ---------- Members ----------
class TestMembers:
    def test_list_members(self, member_session):
        r = member_session.get(f"{API}/members")
        assert r.status_code == 200
        members = r.json()["members"]
        assert isinstance(members, list)
        # Caller excluded from list
        assert not any(m["user_id"] == member_session.user_id for m in members)  # type: ignore[attr-defined]


# ---------- Admin stats ----------
class TestAdmin:
    def test_stats_member_forbidden(self, member_session):
        r = member_session.get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_stats_admin(self, admin_session):
        r = admin_session.get(f"{API}/admin/stats")
        assert r.status_code == 200
        data = r.json()
        for key in ("users", "threads", "events", "newsletters", "videos"):
            assert key in data
            assert isinstance(data[key], int)
