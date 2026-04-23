from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import time as _time
import uuid
import secrets
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ----------------- Setup -----------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("rintaki")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

app = FastAPI(title="Rintaki Anime Club Society API")
api = APIRouter(prefix="/api")

# ----------------- Helpers -----------------
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def set_jwt_cookies(response: Response, user_id: str):
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def clear_auth_cookies(response: Response):
    # Browsers only honour delete_cookie when the attributes match the original set_cookie.
    # Our cookies are set with secure=True, samesite="none" (required for this cross-site preview),
    # so the delete must echo those exact attributes — otherwise the cookie is kept and the user
    # stays logged in after clicking "Log out".
    for c in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(c, path="/", secure=True, samesite="none")

def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "picture": u.get("picture"),
        "banner_image": u.get("banner_image"),
        "role": u.get("role", "member"),
        "points": u.get("points", 0),
        "anime_cash": u.get("anime_cash", 0),
        "badges": u.get("badges", []),
        "bio": u.get("bio", ""),
        "is_member": bool(u.get("is_member", False) or u.get("role") == "admin"),
        "membership_level": int(u.get("membership_level", 0) or 0),
        "membership_name": u.get("membership_name") or "",
        "created_at": u.get("created_at"),
    }

async def get_current_user(request: Request) -> dict:
    # 1. session_token cookie (Emergent Google)
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            exp = sess.get("expires_at")
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp and exp > now_utc():
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

    # 2. JWT access_token cookie or Bearer
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user

async def get_current_user_optional(request: Request) -> Optional[dict]:
    """Same as get_current_user but returns None instead of raising for unauthenticated requests."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def require_member(user: dict = Depends(get_current_user)):
    """Gate for features that require a paid PMPro membership (admins always allowed)."""
    if user.get("role") == "admin":
        return user
    if not user.get("is_member") and int(user.get("membership_level", 0) or 0) <= 0:
        raise HTTPException(403, "This feature is for members only. Join the club to unlock it.")
    return user

async def add_points(user_id: str, amount: int, reason: str, ref: Optional[str] = None):
    await db.users.update_one({"user_id": user_id}, {"$inc": {"points": amount}})
    await db.points_transactions.insert_one({
        "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "ref": ref,
        "kind": "points",
        "created_at": iso(now_utc()),
    })
    u = await db.users.find_one({"user_id": user_id}, {"email": 1, "_id": 0})
    if u and u.get("email"):
        await mycred_adjust(u["email"], os.environ.get("RINTAKI_MYCRED_POINTS_TYPE", "mycred_default"), amount, reason, ref=ref)

async def add_anime_cash(user_id: str, amount: int, reason: str, ref: Optional[str] = None):
    await db.users.update_one({"user_id": user_id}, {"$inc": {"anime_cash": amount}})
    await db.points_transactions.insert_one({
        "tx_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "ref": ref,
        "kind": "anime_cash",
        "created_at": iso(now_utc()),
    })
    u = await db.users.find_one({"user_id": user_id}, {"email": 1, "_id": 0})
    if u and u.get("email"):
        await mycred_adjust(u["email"], os.environ.get("RINTAKI_MYCRED_CASH_TYPE", "anime_cash"), amount, reason, ref=ref)

# ----------------- MyCred (rintaki.org) sync -----------------
_mycred_cache: dict = {}  # email -> (ts, points, anime_cash)
MYCRED_TTL = 30  # seconds

async def mycred_balance(email: str) -> dict:
    """Fetch live MyCred balance + PMPro membership level from rintaki.org with a tiny cache."""
    if not email:
        return {"found": False}
    base = os.environ.get("RINTAKI_WP_BASE_URL")
    key = os.environ.get("RINTAKI_WP_KEY")
    if not base or not key:
        return {"found": False}
    now_ts = _time.time()
    cached = _mycred_cache.get(email)
    if cached and now_ts - cached[0] < MYCRED_TTL:
        return {
            "found": True, "points": cached[1], "anime_cash": cached[2],
            "membership_level": cached[3], "membership_name": cached[4], "cached": True,
        }
    try:
        async with httpx.AsyncClient(timeout=5) as hc:
            r = await hc.get(
                f"{base.rstrip('/')}/wp-json/rintaki/v1/balance",
                params={"email": email},
                headers={"X-Rintaki-Key": key},
            )
            if r.status_code != 200:
                return {"found": False}
            data = r.json() if r.text else {}
            if data.get("found"):
                _mycred_cache[email] = (
                    now_ts,
                    int(data.get("points", 0)),
                    int(data.get("anime_cash", 0)),
                    int(data.get("membership_level", 0) or 0),
                    data.get("membership_name") or "",
                )
            return data
    except Exception as e:
        logger.warning(f"mycred_balance failed: {e}")
        return {"found": False}

async def mycred_adjust(email: str, type_slug: str, amount: int, reason: str, ref: Optional[str] = None) -> dict:
    """Push a point adjustment to MyCred on rintaki.org. Returns {ok, skipped?, new_balance?, reason?}.

    `ref` is an optional idempotency key. When present, the WP plugin (v1.4.0+)
    skips the award if it has already been credited — so retries & re-sync are safe.
    """
    result = {"ok": False}
    if not email or amount == 0:
        return result
    base = os.environ.get("RINTAKI_WP_BASE_URL")
    key = os.environ.get("RINTAKI_WP_KEY")
    if not base or not key:
        return result
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            params = {"email": email, "type": type_slug, "amount": amount, "reason": reason}
            if ref:
                params["ref"] = ref
            r = await hc.post(
                f"{base.rstrip('/')}/wp-json/rintaki/v1/adjust",
                params=params,
                headers={"X-Rintaki-Key": key},
            )
        _mycred_cache.pop(email, None)
        try:
            result = r.json()
        except Exception:
            result = {"ok": r.status_code == 200}
    except Exception as e:
        logger.warning(f"mycred_adjust failed: {e}")
    return result

async def public_user_enriched(u: dict) -> dict:
    """Return public_user(u) but overwrite points/anime_cash/membership with MyCred when available."""
    base = public_user(u)
    bal = await mycred_balance(u.get("email", ""))
    if bal.get("found"):
        base["points"] = bal["points"]
        base["anime_cash"] = bal["anime_cash"]
        base["synced_with_mycred"] = True
        lvl = int(bal.get("membership_level", 0) or 0)
        if lvl > 0:
            base["membership_level"] = lvl
            base["membership_name"] = bal.get("membership_name") or base.get("membership_name") or ""
            base["is_member"] = True
            # Persist to DB so subsequent requests without WP also see member status
            await db.users.update_one(
                {"user_id": u["user_id"]},
                {"$set": {
                    "is_member": True,
                    "membership_level": lvl,
                    "membership_name": base["membership_name"],
                    "membership_synced_at": iso(now_utc()),
                }},
            )
    return base

async def push_notification(user_id: str, title: str, body: str, kind: str = "info", link: Optional[str] = None):
    await db.notifications.insert_one({
        "notif_id": f"n_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": title,
        "body": body,
        "kind": kind,
        "link": link,
        "read": False,
        "created_at": iso(now_utc()),
    })

# ----------------- Models -----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ThreadCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    category: str = Field(default="General")

class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

class EventCreate(BaseModel):
    title: str
    description: str
    location: str = ""
    starts_at: str  # ISO string
    cover_image: Optional[str] = None

class NewsletterCreate(BaseModel):
    title: str
    summary: str
    content: str
    cover_image: Optional[str] = None

class VideoCreate(BaseModel):
    title: str
    description: str = ""
    url: str  # youtube, vimeo or direct
    thumbnail: Optional[str] = None

class MessageCreate(BaseModel):
    to_user_id: str
    body: str = Field(min_length=1, max_length=2000)

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    picture: Optional[str] = None
    banner_image: Optional[str] = None

# ----------------- Startup -----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.forum_threads.create_index("created_at")
    await db.forum_replies.create_index("thread_id")
    await db.messages.create_index([("from_user_id", 1), ("to_user_id", 1)])
    await db.notifications.create_index("user_id")
    await db.events.create_index("starts_at")
    await db.daily_logins.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.tcg_user_cards.create_index([("user_id", 1), ("card_id", 1)], unique=True)
    # Points & claims
    await db.points_transactions.create_index("ref", sparse=True)  # idempotency key for auto awards
    await db.points_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.point_claims.create_index([("status", 1), ("created_at", 1)])
    await db.point_claims.create_index([("user_id", 1), ("created_at", -1)])

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@rintaki.org").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@Rintaki2026")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Rintaki Admin",
            "role": "admin",
            "points": 0,
            "badges": ["Founder"],
            "bio": "Rintaki Anime Club Society admin",
            "picture": None,
            "created_at": iso(now_utc()),
        })
        logger.info("Seeded admin user")
    else:
        if not existing.get("password_hash") or not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
            logger.info("Updated admin password")

    # Demo seed data disabled — production app pulls real events from WP, real threads from wpForo,
    # and real magazines from rintaki.org. Seed blocks were removed on 2026-04-22.

# ----------------- Auth Endpoints -----------------
@api.get("/")
async def root():
    return {"ok": True, "app": "Rintaki Anime Club Society API"}

@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "member",
        "points": 10,  # welcome bonus
        "badges": ["New Member"],
        "bio": "",
        "picture": None,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    await db.points_transactions.insert_one({
        "tx_id": f"tx_{uuid.uuid4().hex[:12]}", "user_id": user_id, "amount": 10,
        "reason": "Welcome bonus", "created_at": iso(now_utc()),
    })
    set_jwt_cookies(response, user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return public_user(user)

@api.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"key": key})
    if attempt and attempt.get("count", 0) >= 5:
        last = attempt.get("last")
        if isinstance(last, str):
            last = datetime.fromisoformat(last)
        if last and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if last and now_utc() - last < timedelta(minutes=15):
            raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"key": key},
            {"$inc": {"count": 1}, "$set": {"last": iso(now_utc())}},
            upsert=True,
        )
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"key": key})
    set_jwt_cookies(response, user["user_id"])
    return public_user(user)

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    # Fire-and-forget: award the daily-visit point (+1, idempotent per UTC day)
    # and evaluate the monthly Active-Member bonus. Members only.
    if user.get("role") == "admin" or user.get("is_member"):
        try:
            today = now_utc().date().isoformat()
            ref = f"visit:{user['user_id']}:{today}"
            if not await db.points_transactions.find_one({"ref": ref}):
                await add_points(user["user_id"], 1, "Daily app visit", ref=ref)
        except Exception as e:
            logger.warning(f"daily visit award failed: {e}")
        try:
            await _maybe_award_active_member(user)
        except Exception as e:
            logger.warning(f"active member award failed: {e}")
        # Refresh the user doc so the enriched response reflects the new point totals
        user = await db.users.find_one({"user_id": user["user_id"]}) or user
    return await public_user_enriched(user)

@api.post("/auth/google/session")
async def google_session(request: Request, response: Response, x_session_id: Optional[str] = Header(None, alias="X-Session-ID")):
    if not x_session_id:
        raise HTTPException(400, "Missing X-Session-ID header")
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id},
            )
            if r.status_code != 200:
                raise HTTPException(401, "Invalid session")
            data = r.json()
    except httpx.HTTPError:
        raise HTTPException(502, "Auth provider error")

    email = data["email"].lower()
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "member",
            "points": 10,
            "badges": ["New Member"],
            "bio": "",
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user)
        await db.points_transactions.insert_one({
            "tx_id": f"tx_{uuid.uuid4().hex[:12]}", "user_id": user_id, "amount": 10,
            "reason": "Welcome bonus", "created_at": iso(now_utc()),
        })
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": name, "picture": picture}})

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=7)),
    })

    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none",
                        max_age=7*24*60*60, path="/")
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return public_user(user)

# ----------------- Profile -----------------
@api.patch("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return public_user(u)

@api.get("/users/{user_id}")
async def get_user(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")
    return await public_user_enriched(u)

class ImageUpload(BaseModel):
    field: str  # "picture" or "banner_image"
    file_name: str = ""
    mime: str = "image/jpeg"
    data_b64: str  # base64-encoded image bytes (without the "data:" prefix)

@api.post("/profile/upload-image")
async def upload_profile_image(data: ImageUpload, user: dict = Depends(get_current_user)):
    if data.field not in ("picture", "banner_image"):
        raise HTTPException(400, "field must be 'picture' or 'banner_image'")
    if not data.data_b64:
        raise HTTPException(400, "empty payload")
    # Guard: base64 payload should be < ~6 MB (decoded ~4.5 MB). Banners might be bigger — allow 10 MB.
    max_b64_len = 14_000_000
    if len(data.data_b64) > max_b64_len:
        raise HTTPException(413, "Image too large. Max 10 MB.")
    mime = data.mime if data.mime.startswith("image/") else "image/jpeg"
    data_url = f"data:{mime};base64,{data.data_b64}"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {data.field: data_url}})
    return {"ok": True, "url": data_url}


# ----------------- Rintaki Feed -----------------
ASGAROS_BASE = "https://rintaki.org/notice-board"
_asg_cache: dict = {}
ASG_TTL = 300  # 5 min

def _asg_absolutize(href: str) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return f"https://rintaki.org{href}"
    return f"{ASGAROS_BASE}/{href.lstrip('/')}"

def _asg_slug(url: str, kind: str) -> str:
    import re
    m = re.search(rf"/{kind}/([^/?#]+)", url or "")
    return m.group(1) if m else ""

async def _asg_fetch(url: str) -> str:
    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 RintakiApp/1.0"}) as hc:
        r = await hc.get(url)
        r.raise_for_status()
        return r.text

@api.get("/forums/asgaros/overview")
async def asgaros_overview(refresh: bool = False):
    """Scrape the Asgaros forum overview on rintaki.org/notice-board/ into categories → forums."""
    from bs4 import BeautifulSoup
    now_ts = _time.time()
    if not refresh and "overview" in _asg_cache:
        ts, data = _asg_cache["overview"]
        if now_ts - ts < ASG_TTL:
            return {**data, "source": "cache"}
    try:
        html = await _asg_fetch(f"{ASGAROS_BASE}/")
    except Exception as e:
        raise HTTPException(502, f"Could not fetch forum: {e}")
    soup = BeautifulSoup(html, "lxml")
    wrapper = soup.select_one("#af-wrapper") or soup
    categories = []
    current = None
    for el in wrapper.find_all(["div"], recursive=True):
        cls = set(el.get("class") or [])
        if "title-element" in cls:
            # Skip the "Last post" helper text
            last = el.select_one(".last-post-headline")
            if last:
                last.extract()
            name = el.get_text(" ", strip=True)
            if name:
                current = {"name": name, "forums": []}
                categories.append(current)
        elif "forum" in cls and "content-element" in cls and current is not None:
            a = el.select_one("a.forum-title")
            desc_el = el.select_one("small.forum-description")
            stats_el = el.select_one("small.forum-stats")
            last_el = el.select_one("small.forum-lastpost-small")
            last = None
            if last_el:
                topic_a = last_el.select_one("a[href*='/topic/']")
                author_a = last_el.select_one("a.profile-link")
                time_a = last_el.select_one("a:not(.profile-link)")
                last = {
                    "topic_title": topic_a.get_text(strip=True) if topic_a else "",
                    "topic_url": _asg_absolutize(topic_a.get("href")) if topic_a else "",
                    "author": author_a.get_text(strip=True) if author_a else "",
                    "when": time_a.get_text(strip=True) if time_a else "",
                }
            url = _asg_absolutize(a.get("href")) if a else ""
            current["forums"].append({
                "title": a.get_text(strip=True) if a else "(untitled)",
                "slug": _asg_slug(url, "forum"),
                "url": url,
                "description": desc_el.get_text(" ", strip=True) if desc_el else "",
                "stats": stats_el.get_text(" ", strip=True) if stats_el else "",
                "last_post": last,
            })
    data = {"categories": [c for c in categories if c.get("forums")], "source_url": f"{ASGAROS_BASE}/"}
    _asg_cache["overview"] = (now_ts, data)
    return {**data, "source": "live"}

@api.get("/forums/asgaros/forum/{slug}")
async def asgaros_forum_detail(slug: str, refresh: bool = False):
    """Topics inside a specific Asgaros forum."""
    from bs4 import BeautifulSoup
    cache_key = f"forum:{slug}"
    now_ts = _time.time()
    if not refresh and cache_key in _asg_cache:
        ts, data = _asg_cache[cache_key]
        if now_ts - ts < ASG_TTL:
            return {**data, "source": "cache"}
    try:
        html = await _asg_fetch(f"{ASGAROS_BASE}/forum/{slug}/")
    except Exception as e:
        raise HTTPException(404, f"Forum not found: {e}")
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("h1.main-title")
    title = title_el.get_text(strip=True) if title_el else slug.replace("-", " ").title()
    topics = []
    for t in soup.select(".content-element.topic"):
        a = t.select_one(".topic-name > a[href*='/topic/']")
        author_a = t.select_one(".topic-name small a.profile-link")
        stats = t.select_one(".topic-stats")
        last_post = t.select_one(".topic-lastpost-small")
        url = _asg_absolutize(a.get("href")) if a else ""
        topics.append({
            "title": a.get_text(strip=True) if a else "(untitled)",
            "url": url,
            "slug": _asg_slug(url, "topic"),
            "author": author_a.get_text(strip=True) if author_a else "",
            "stats": stats.get_text(" ", strip=True) if stats else "",
            "last_post": last_post.get_text(" ", strip=True) if last_post else "",
            "is_sticky": "topic-sticky" in (t.get("class") or []),
        })
    data = {"forum": {"title": title, "slug": slug, "url": f"{ASGAROS_BASE}/forum/{slug}/"}, "topics": topics}
    _asg_cache[cache_key] = (now_ts, data)
    return {**data, "source": "live"}

@api.get("/forums/asgaros/topic/{slug}")
async def asgaros_topic_detail(slug: str, refresh: bool = False):
    """Posts inside a specific Asgaros topic."""
    from bs4 import BeautifulSoup
    cache_key = f"topic:{slug}"
    now_ts = _time.time()
    if not refresh and cache_key in _asg_cache:
        ts, data = _asg_cache[cache_key]
        if now_ts - ts < ASG_TTL:
            return {**data, "source": "cache"}
    try:
        html = await _asg_fetch(f"{ASGAROS_BASE}/topic/{slug}/")
    except Exception as e:
        raise HTTPException(404, f"Topic not found: {e}")
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("h1.main-title")
    title = title_el.get_text(strip=True) if title_el else slug.replace("-", " ").title()
    # breadcrumb can tell us parent forum
    crumb = soup.select("#af-wrapper a[href*='/forum/']")
    parent_forum = None
    if crumb:
        pf_url = _asg_absolutize(crumb[-1].get("href"))
        parent_forum = {"title": crumb[-1].get_text(strip=True), "slug": _asg_slug(pf_url, "forum"), "url": pf_url}
    posts = []
    for i, p in enumerate(soup.select(".post-element")):
        author_el = p.select_one(".post-author-block-name a, .post-author-block-name")
        avatar_el = p.select_one(".post-author img.avatar")
        body_el = p.select_one(".post-message")
        date_el = p.select_one(".forum-post-date")
        reactions_el = p.select_one(".post-reactions-summary")
        # Extract clean HTML from body (keep <p>, <br>, <a>)
        body_html = ""
        if body_el:
            # Strip Asgaros quote containers to plain markup
            for tag in body_el.find_all(["script", "style"]):
                tag.decompose()
            body_html = "".join(str(c) for c in body_el.contents)
        posts.append({
            "number": i + 1,
            "author": author_el.get_text(strip=True) if author_el else "",
            "avatar": avatar_el.get("src") if avatar_el else None,
            "date": date_el.get_text(" ", strip=True) if date_el else "",
            "body_html": body_html,
            "body_text": body_el.get_text(" ", strip=True) if body_el else "",
            "reactions": reactions_el.get_text(" ", strip=True) if reactions_el else "",
        })
    data = {
        "topic": {"title": title, "slug": slug, "url": f"{ASGAROS_BASE}/topic/{slug}/"},
        "parent_forum": parent_forum,
        "posts": posts,
    }
    _asg_cache[cache_key] = (now_ts, data)
    return {**data, "source": "live"}

class AsgarosReplyIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)

@api.post("/forums/asgaros/topic/{slug}/reply")
async def asgaros_post_reply(slug: str, data: AsgarosReplyIn, user: dict = Depends(require_member)):
    """Post a reply to an Asgaros topic via the WP plugin. Requires plugin v1.3.0+ on rintaki.org."""
    base = os.environ.get("RINTAKI_WP_BASE_URL")
    key = os.environ.get("RINTAKI_WP_KEY")
    if not base or not key:
        raise HTTPException(503, "WordPress sync is not configured on the server.")
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(
                f"{base.rstrip('/')}/wp-json/rintaki/v1/forum-reply",
                headers={"X-Rintaki-Key": key, "Content-Type": "application/json"},
                json={"email": user.get("email", ""), "topic_slug": slug, "text": data.text},
            )
    except Exception as e:
        raise HTTPException(502, f"Could not reach rintaki.org: {e}")

    if r.status_code == 404:
        detail = ""
        try:
            detail = r.json().get("message", "") or r.text
        except Exception:
            detail = r.text
        low = detail.lower()
        if ("rest_no_route" in low
            or "endpoint not found" in low
            or "no route was found" in low):
            raise HTTPException(502, "The rintaki.org sync plugin needs to be updated to v1.3.0 to accept replies. Please upload the latest /app/wp-plugin/rintaki-app-sync.php to WordPress.")
        raise HTTPException(404, detail or "Topic or user not found on rintaki.org.")
    if r.status_code != 200:
        try:
            msg = r.json().get("message", "") or r.text
        except Exception:
            msg = r.text
        raise HTTPException(r.status_code, f"rintaki.org refused the reply: {msg}")

    resp = r.json()
    # Reward member +2 pts for a forum reply (idempotent via post_id)
    reply_ref = f"asgaros_reply:{resp.get('post_id') or slug + ':' + iso(now_utc())}"
    try:
        await add_points(user["user_id"], 2, "Replied to a forum topic", ref=reply_ref)
    except Exception as e:
        logger.warning(f"Reply points failed: {e}")
    # Invalidate the cached topic so a refresh shows the new post
    _asg_cache.pop(f"topic:{slug}", None)
    return resp

# Keep the legacy /rintaki/forum endpoint (thin shim calling the new overview)
@api.get("/rintaki/forum")
async def rintaki_forum():
    try:
        data = await asgaros_overview()
        # Flatten to old shape for back-compat
        groups = []
        for cat in data.get("categories", []):
            for f in cat.get("forums", []):
                groups.append({"title": f["title"], "url": f["url"], "description": f["description"], "last_post": f.get("last_post")})
        return {"source_url": data.get("source_url"), "groups": groups[:50], "topics": [], "stats": {}}
    except Exception:
        return {"groups": [], "topics": [], "stats": {}}

@api.get("/rintaki/feed")
async def rintaki_feed():
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get("https://rintaki.org/wp-json/wp/v2/posts", params={"per_page": 12, "_embed": "true"})
            if r.status_code != 200:
                return {"posts": []}
            posts = r.json()
        simplified = []
        for p in posts:
            media = None
            try:
                media = p.get("_embedded", {}).get("wp:featuredmedia", [{}])[0].get("source_url")
            except Exception:
                media = None
            simplified.append({
                "id": p.get("id"),
                "title": p.get("title", {}).get("rendered", ""),
                "excerpt": p.get("excerpt", {}).get("rendered", ""),
                "link": p.get("link"),
                "date": p.get("date"),
                "image": media,
            })
        return {"posts": simplified}
    except Exception as e:
        logger.warning(f"rintaki feed error: {e}")
        return {"posts": []}

# ----------------- Forums -----------------
@api.get("/forums/threads")
async def list_threads(category: Optional[str] = None):
    q = {}
    if category:
        q["category"] = category
    threads = await db.forum_threads.find(q, {"_id": 0}).sort([("pinned", -1), ("created_at", -1)]).to_list(100)
    return {"threads": threads}

@api.post("/forums/threads")
async def create_thread(data: ThreadCreate, user: dict = Depends(require_member)):
    t = {
        "thread_id": f"th_{uuid.uuid4().hex[:10]}",
        "title": data.title,
        "body": data.body,
        "category": data.category,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture"),
        "likes": [],
        "reply_count": 0,
        "pinned": False,
        "created_at": iso(now_utc()),
    }
    await db.forum_threads.insert_one(t)
    await add_points(user["user_id"], 5, "Created a forum thread")
    t.pop("_id", None)
    return t

@api.get("/forums/threads/{thread_id}")
async def get_thread(thread_id: str):
    t = await db.forum_threads.find_one({"thread_id": thread_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Thread not found")
    replies = await db.forum_replies.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"thread": t, "replies": replies}

@api.post("/forums/threads/{thread_id}/replies")
async def reply_thread(thread_id: str, data: ReplyCreate, user: dict = Depends(require_member)):
    t = await db.forum_threads.find_one({"thread_id": thread_id})
    if not t:
        raise HTTPException(404, "Thread not found")
    reply = {
        "reply_id": f"rp_{uuid.uuid4().hex[:10]}",
        "thread_id": thread_id,
        "body": data.body,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture"),
        "likes": [],
        "created_at": iso(now_utc()),
    }
    await db.forum_replies.insert_one(reply)
    await db.forum_threads.update_one({"thread_id": thread_id}, {"$inc": {"reply_count": 1}})
    await add_points(user["user_id"], 2, "Replied to a thread")
    if t["author_id"] != user["user_id"]:
        await push_notification(t["author_id"], "New reply", f"{user['name']} replied to your thread '{t['title']}'", "reply", f"/forums/{thread_id}")
    reply.pop("_id", None)
    return reply

@api.post("/forums/threads/{thread_id}/like")
async def like_thread(thread_id: str, user: dict = Depends(require_member)):
    t = await db.forum_threads.find_one({"thread_id": thread_id})
    if not t:
        raise HTTPException(404, "Thread not found")
    likes = t.get("likes", [])
    if user["user_id"] in likes:
        await db.forum_threads.update_one({"thread_id": thread_id}, {"$pull": {"likes": user["user_id"]}})
        return {"liked": False}
    await db.forum_threads.update_one({"thread_id": thread_id}, {"$addToSet": {"likes": user["user_id"]}})
    if t["author_id"] != user["user_id"]:
        await add_points(t["author_id"], 1, "Thread got a like")
    return {"liked": True}

# ----------------- Points / Leaderboard -----------------
@api.get("/points/me")
async def my_points(user: dict = Depends(get_current_user)):
    txs = await db.points_transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    bal = await mycred_balance(user.get("email", ""))
    if bal.get("found"):
        return {
            "points": bal["points"],
            "anime_cash": bal["anime_cash"],
            "transactions": txs,
            "badges": user.get("badges", []),
            "synced_with_mycred": True,
        }
    return {
        "points": user.get("points", 0),
        "anime_cash": user.get("anime_cash", 0),
        "transactions": txs,
        "badges": user.get("badges", []),
        "synced_with_mycred": False,
    }

@api.post("/points/daily-claim")
async def daily_claim(user: dict = Depends(require_member)):
    today = now_utc().date().isoformat()
    try:
        await db.daily_logins.insert_one({"user_id": user["user_id"], "date": today, "created_at": iso(now_utc())})
    except Exception:
        raise HTTPException(400, "Already claimed today")
    await add_points(user["user_id"], 5, "Daily login bonus", ref=f"daily_login:{user['user_id']}:{today}")
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "points": u.get("points", 0)}

@api.get("/points/leaderboard")
async def leaderboard():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("points", -1).limit(20).to_list(20)
    return {"leaderboard": [public_user(u) for u in users]}

# ----------------- Events (The Events Calendar proxy + banner + media) -----------------
TEC_BASE = "https://rintaki.org/wp-json/tribe/events/v1"

def _tec_to_simple(ev: dict) -> dict:
    img = ev.get("image")
    image_url = img.get("url") if isinstance(img, dict) else (img if isinstance(img, str) else None)
    venue = ev.get("venue") or []
    if isinstance(venue, list) and venue:
        venue = venue[0]
    venue_name = venue.get("venue") if isinstance(venue, dict) else ""
    venue_city = venue.get("city") if isinstance(venue, dict) else ""
    return {
        "event_id": str(ev.get("id", "")),
        "title": ev.get("title", ""),
        "description": (ev.get("description") or "").strip(),
        "excerpt": (ev.get("excerpt") or "").strip(),
        "url": ev.get("url", ""),
        "start_date": ev.get("start_date", ""),
        "end_date": ev.get("end_date", ""),
        "all_day": ev.get("all_day", False),
        "cover_image": image_url,
        "venue": venue_name,
        "city": venue_city,
    }

async def _tec_fetch(params: dict) -> list:
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get(f"{TEC_BASE}/events", params=params)
            if r.status_code != 200:
                return []
            data = r.json()
            return [_tec_to_simple(e) for e in data.get("events", [])]
    except Exception as e:
        logger.warning(f"TEC fetch failed: {e}")
        return []

@api.get("/events/upcoming")
async def events_upcoming():
    today = now_utc().strftime("%Y-%m-%d")
    events = await _tec_fetch({"per_page": 50, "start_date": today, "status": "publish"})
    # attach app-side banner overrides
    for ev in events:
        b = await db.event_banners.find_one({"event_id": ev["event_id"]}, {"_id": 0, "banner_url": 1})
        if b:
            ev["banner_url"] = b["banner_url"]
    return {"events": events}

@api.get("/events/past")
async def events_past():
    today = now_utc().strftime("%Y-%m-%d")
    events = await _tec_fetch({"per_page": 50, "end_date": today, "status": "publish"})
    events.sort(key=lambda e: e.get("start_date", ""), reverse=True)
    for ev in events:
        b = await db.event_banners.find_one({"event_id": ev["event_id"]}, {"_id": 0, "banner_url": 1})
        if b:
            ev["banner_url"] = b["banner_url"]
    return {"events": events}

@api.get("/events/detail/{event_id}")
async def event_detail(event_id: str):
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get(f"{TEC_BASE}/events/{event_id}")
            if r.status_code != 200:
                raise HTTPException(404, "Event not found")
            ev = _tec_to_simple(r.json())
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Event provider error")
    b = await db.event_banners.find_one({"event_id": event_id}, {"_id": 0, "banner_url": 1})
    if b:
        ev["banner_url"] = b["banner_url"]
    return ev

class EventBannerIn(BaseModel):
    banner_url: str

@api.put("/events/banner/{event_id}")
async def set_event_banner(event_id: str, data: EventBannerIn, user: dict = Depends(require_admin)):
    await db.event_banners.update_one(
        {"event_id": event_id},
        {"$set": {"event_id": event_id, "banner_url": data.banner_url, "updated_at": iso(now_utc())}},
        upsert=True,
    )
    return {"ok": True, "event_id": event_id, "banner_url": data.banner_url}

@api.delete("/events/banner/{event_id}")
async def delete_event_banner(event_id: str, user: dict = Depends(require_admin)):
    await db.event_banners.delete_one({"event_id": event_id})
    return {"ok": True}

# Event media gallery (photos/videos of past events)
class EventMediaCreate(BaseModel):
    kind: str  # "photo" or "video"
    url: str
    caption: str = ""
    event_id: Optional[str] = None
    event_title: Optional[str] = None

@api.get("/events/media")
async def list_event_media(kind: Optional[str] = None, event_id: Optional[str] = None):
    q = {}
    if kind in ("photo", "video"):
        q["kind"] = kind
    if event_id:
        q["event_id"] = event_id
    items = await db.event_media.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"media": items}

@api.post("/events/media")
async def add_event_media(data: EventMediaCreate, user: dict = Depends(require_admin)):
    if data.kind not in ("photo", "video"):
        raise HTTPException(400, "kind must be photo or video")
    m = {
        "media_id": f"em_{uuid.uuid4().hex[:10]}",
        **data.model_dump(),
        "created_at": iso(now_utc()),
    }
    await db.event_media.insert_one(m)
    m.pop("_id", None)
    return m

@api.delete("/events/media/{media_id}")
async def delete_event_media(media_id: str, user: dict = Depends(require_admin)):
    await db.event_media.delete_one({"media_id": media_id})
    return {"ok": True}

# ----------------- Legacy app-side events (kept for backwards compat) -----------------
@api.get("/events")
async def list_events():
    events = await db.events.find({}, {"_id": 0}).sort("starts_at", 1).to_list(100)
    return {"events": events}

@api.post("/events")
async def create_event(data: EventCreate, user: dict = Depends(require_admin)):
    ev = {
        "event_id": f"ev_{uuid.uuid4().hex[:10]}",
        **data.model_dump(),
        "created_at": iso(now_utc()),
    }
    await db.events.insert_one(ev)
    # Notify all users
    all_users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
    for u in all_users:
        await push_notification(u["user_id"], "New event!", data.title, "event", "/events")
    ev.pop("_id", None)
    return ev

# ----------------- Newsletters -----------------
@api.get("/newsletters")
async def list_newsletters():
    items = await db.newsletters.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"newsletters": items}

@api.post("/newsletters")
async def create_newsletter(data: NewsletterCreate, user: dict = Depends(require_admin)):
    n = {
        "newsletter_id": f"nl_{uuid.uuid4().hex[:10]}",
        **data.model_dump(),
        "author": user["name"],
        "created_at": iso(now_utc()),
    }
    await db.newsletters.insert_one(n)
    all_users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
    for u in all_users:
        await push_notification(u["user_id"], "New newsletter", data.title, "newsletter", "/newsletters")
    n.pop("_id", None)
    return n

# ----------------- Videos -----------------
@api.get("/videos")
async def list_videos():
    items = await db.videos.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"videos": items}

@api.post("/videos")
async def create_video(data: VideoCreate, user: dict = Depends(require_admin)):
    v = {
        "video_id": f"v_{uuid.uuid4().hex[:10]}",
        **data.model_dump(),
        "author": user["name"],
        "created_at": iso(now_utc()),
    }
    await db.videos.insert_one(v)
    v.pop("_id", None)
    return v

# ----------------- Messages -----------------
@api.get("/messages/conversations")
async def conversations(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    pipeline = [
        {"$match": {"$or": [{"from_user_id": uid}, {"to_user_id": uid}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$cond": [{"$eq": ["$from_user_id", uid]}, "$to_user_id", "$from_user_id"]},
            "last_body": {"$first": "$body"},
            "last_at": {"$first": "$created_at"},
            "last_from": {"$first": "$from_user_id"},
        }},
        {"$sort": {"last_at": -1}},
    ]
    rows = await db.messages.aggregate(pipeline).to_list(100)
    convos = []
    for r in rows:
        other_id = r["_id"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password_hash": 0})
        if other:
            convos.append({
                "user": public_user(other),
                "last_body": r["last_body"],
                "last_at": r["last_at"],
                "last_from_me": r["last_from"] == uid,
            })
    return {"conversations": convos}

@api.get("/messages/with/{other_id}")
async def conversation_with(other_id: str, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    msgs = await db.messages.find(
        {"$or": [
            {"from_user_id": uid, "to_user_id": other_id},
            {"from_user_id": other_id, "to_user_id": uid},
        ]},
        {"_id": 0},
    ).sort("created_at", 1).to_list(500)
    # mark as read
    await db.messages.update_many({"from_user_id": other_id, "to_user_id": uid, "read": False}, {"$set": {"read": True}})
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password_hash": 0})
    return {"messages": msgs, "other": public_user(other) if other else None}

@api.post("/messages")
async def send_message(data: MessageCreate, user: dict = Depends(get_current_user)):
    if data.to_user_id == user["user_id"]:
        raise HTTPException(400, "Cannot message yourself")
    other = await db.users.find_one({"user_id": data.to_user_id})
    if not other:
        raise HTTPException(404, "Recipient not found")
    msg = {
        "message_id": f"m_{uuid.uuid4().hex[:10]}",
        "from_user_id": user["user_id"],
        "to_user_id": data.to_user_id,
        "from_name": user["name"],
        "body": data.body,
        "read": False,
        "created_at": iso(now_utc()),
    }
    await db.messages.insert_one(msg)
    await push_notification(data.to_user_id, "New message", f"{user['name']}: {data.body[:50]}", "message", f"/messages/{user['user_id']}")
    msg.pop("_id", None)
    return msg

# ----------------- Notifications -----------------
@api.get("/notifications")
async def list_notifs(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    return {"notifications": items, "unread": unread}

@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ----------------- Admin -----------------
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    return {
        "users": await db.users.count_documents({}),
        "threads": await db.forum_threads.count_documents({}),
        "events": await db.events.count_documents({}),
        "newsletters": await db.newsletters.count_documents({}),
        "videos": await db.videos.count_documents({}),
    }

@api.get("/members")
async def list_members(user: dict = Depends(get_current_user)):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"members": [public_user(u) for u in items if u["user_id"] != user["user_id"]]}

# ----------------- Magazines (PDF issues) -----------------
class MagazineCreate(BaseModel):
    title: str
    issue: str = ""  # e.g., "Vol 5, Issue 1"
    pdf_url: str
    cover_image: Optional[str] = None
    description: str = ""

@api.get("/magazines")
async def list_magazines():
    items = await db.magazines.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"magazines": items}

@api.post("/magazines")
async def create_magazine(data: MagazineCreate, user: dict = Depends(require_admin)):
    m = {"magazine_id": f"mg_{uuid.uuid4().hex[:10]}", **data.model_dump(), "created_at": iso(now_utc())}
    await db.magazines.insert_one(m)
    m.pop("_id", None)
    return m

@api.delete("/magazines/{magazine_id}")
async def delete_magazine(magazine_id: str, user: dict = Depends(require_admin)):
    await db.magazines.delete_one({"magazine_id": magazine_id})
    return {"ok": True}

# ----------------- Events Gallery (Event > Year > Gallery, scraped from NextGEN) -----------------
NGG_BASE = "https://rintaki.org"

def _split_camel(s: str) -> str:
    """AnimeExpo -> Anime Expo, CherryBlossomFestival -> Cherry Blossom Festival"""
    if not s:
        return ""
    import re
    out = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    out = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', out)
    return out.strip()

def _parse_year_and_clean(title: str):
    """'Cosplayers (2009)' -> ('2009', 'Cosplayers'); 'July 2, 2004' -> ('2004', 'July 2')."""
    import re
    t = (title or "").strip()
    m = re.search(r'((?:19|20)\d{2})', t)
    year = m.group(1) if m else ""
    name = t
    # strip "(YYYY)" or "YYYY"
    name = re.sub(r'\(\s*(?:19|20)\d{2}\s*\)', '', name).strip()
    name = re.sub(r',?\s*(?:19|20)\d{2}\s*$', '', name).strip()
    name = re.sub(r'\s{2,}', ' ', name).strip(' ,-')
    if not name:
        name = t
    return year, name

import asyncio as _asyncio

async def _http_get_with_retry(client: httpx.AsyncClient, url: str, retries: int = 2, backoff: float = 2.0):
    last_exc = None
    for attempt in range(retries + 1):
        try:
            r = await client.get(url)
            if r.status_code == 503 and attempt < retries:
                await _asyncio.sleep(backoff * (attempt + 1))
                continue
            return r
        except Exception as e:
            last_exc = e
            if attempt < retries:
                await _asyncio.sleep(backoff * (attempt + 1))
                continue
            raise
    if last_exc:
        raise last_exc
    return r

async def _scrape_ngg_gallery(url: str, client: Optional[httpx.AsyncClient] = None) -> dict:
    """Fetch a NextGEN gallery page (following /page/N pagination) and return full image list + cover."""
    from bs4 import BeautifulSoup
    import re

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30, headers={"User-Agent": "Mozilla/5.0 RintakiApp"}, follow_redirects=True)
        close_client = True

    try:
        r = await _http_get_with_retry(client, url)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        max_page = 1
        for a in soup.select('.ngg-navigation a[href*="/page/"]'):
            m = re.search(r'/page/(\d+)', a.get("href", ""))
            if m:
                max_page = max(max_page, int(m.group(1)))

        def extract(soup_: BeautifulSoup):
            out = []
            for a in soup_.select(".ngg-gallery-thumbnail a"):
                href = (a.get("href") or a.get("data-src") or "").strip()
                if not href:
                    continue
                img = a.find("img")
                thumb = (img.get("src") if img else None) or href
                alt = (img.get("alt") if img else "") or ""
                out.append({"url": href, "thumb": thumb, "caption": alt})
            return out

        images = extract(soup)
        base = url.rstrip("/")
        for p in range(2, max_page + 1):
            await _asyncio.sleep(0.5)
            try:
                r2 = await _http_get_with_retry(client, f"{base}/page/{p}")
                if r2.status_code != 200:
                    continue
                images.extend(extract(BeautifulSoup(r2.text, "lxml")))
            except Exception:
                continue
    finally:
        if close_client:
            await client.aclose()

    seen, dedup = set(), []
    for im in images:
        if im["url"] in seen:
            continue
        seen.add(im["url"])
        dedup.append(im)
    cover = dedup[0]["thumb"] if dedup else None
    return {"images": dedup, "image_count": len(dedup), "cover_image": cover}

class GalleryCreate(BaseModel):
    event: str = Field(min_length=1, max_length=80)
    year: str = ""
    name: str = Field(min_length=1, max_length=120)
    imagely_id: Optional[int] = None
    source_url: Optional[str] = None  # Optional if imagely_id is provided
    order: int = 0

@api.get("/galleries")
async def list_galleries():
    items = await db.galleries.find({}, {"_id": 0, "images": 0}).to_list(500)
    # sort: event asc, year desc, name asc
    items.sort(key=lambda g: (g.get("event", ""), -(int(g["year"]) if (g.get("year") or "").isdigit() else 0), g.get("name", "")))
    return {"galleries": items}

@api.get("/galleries/{gallery_id}")
async def get_gallery(gallery_id: str):
    g = await db.galleries.find_one({"gallery_id": gallery_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Gallery not found")
    return g

@api.post("/galleries")
async def create_gallery(data: GalleryCreate, user: dict = Depends(require_admin)):
    src = data.source_url
    if not src and data.imagely_id:
        src = f"{NGG_BASE}/gallery/nggallery/gallery/{data.imagely_id}"
    if not src:
        raise HTTPException(400, "Either source_url or imagely_id must be provided")
    try:
        scrape = await _scrape_ngg_gallery(src)
    except Exception as e:
        raise HTTPException(400, f"Could not scrape gallery: {e}")
    if scrape["image_count"] == 0:
        raise HTTPException(400, "No images found at that URL. Check the gallery ID or URL.")
    doc = {
        "gallery_id": f"g_{uuid.uuid4().hex[:10]}",
        "event": data.event.strip(),
        "year": data.year.strip(),
        "name": data.name.strip(),
        "imagely_id": data.imagely_id,
        "source_url": src,
        "cover_image": scrape["cover_image"],
        "images": scrape["images"],
        "image_count": scrape["image_count"],
        "order": data.order,
        "created_at": iso(now_utc()),
        "last_synced_at": iso(now_utc()),
    }
    await db.galleries.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/galleries/{gallery_id}/refresh")
async def refresh_gallery(gallery_id: str, user: dict = Depends(require_admin)):
    g = await db.galleries.find_one({"gallery_id": gallery_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Gallery not found")
    try:
        scrape = await _scrape_ngg_gallery(g["source_url"])
    except Exception as e:
        raise HTTPException(400, f"Could not re-scrape: {e}")
    await db.galleries.update_one({"gallery_id": gallery_id}, {"$set": {
        "cover_image": scrape["cover_image"] or g.get("cover_image"),
        "images": scrape["images"],
        "image_count": scrape["image_count"],
        "last_synced_at": iso(now_utc()),
    }})
    return {"ok": True, "image_count": scrape["image_count"]}

@api.delete("/galleries/{gallery_id}")
async def delete_gallery(gallery_id: str, user: dict = Depends(require_admin)):
    await db.galleries.delete_one({"gallery_id": gallery_id})
    return {"ok": True}

class GallerySyncAll(BaseModel):
    source_url: str = f"{NGG_BASE}/gallery/"
    replace: bool = False
    max_galleries: int = 50

async def _run_sync_job(job_id: str, data: GallerySyncAll):
    from bs4 import BeautifulSoup
    await db.sync_jobs.update_one({"job_id": job_id}, {"$set": {"status": "running", "started_at": iso(now_utc())}})
    try:
        async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "Mozilla/5.0 RintakiApp"}, follow_redirects=True) as shared:
            r = await shared.get(data.source_url)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "lxml")
            anchors = soup.select('a[href*="/nggallery/album/"]')
            discovered = {}
            for a in anchors:
                href = (a.get("href") or "").strip()
                if not href or href in discovered:
                    continue
                title = (a.get("title") or a.get_text(strip=True) or "Gallery").strip()
                section = None
                for prev in a.find_all_previous(["h2", "h3"]):
                    section = prev.get_text(strip=True)
                    break
                discovered[href] = {"title": title, "section": section}

            if data.replace:
                await db.galleries.delete_many({"auto_synced": True})

            total = min(len(discovered), data.max_galleries)
            await db.sync_jobs.update_one({"job_id": job_id}, {"$set": {"total": total, "discovered": len(discovered)}})

            created, skipped, failed, processed = 0, 0, [], 0
            for href, meta in list(discovered.items())[: data.max_galleries]:
                processed += 1
                existing = await db.galleries.find_one({"source_url": href})
                if existing:
                    skipped += 1
                else:
                    try:
                        scrape = await _scrape_ngg_gallery(href, client=shared)
                        if scrape["image_count"] == 0:
                            failed.append(href)
                        else:
                            event = _split_camel(meta["section"] or "Other")
                            year, name = _parse_year_and_clean(meta["title"])
                            await db.galleries.insert_one({
                                "gallery_id": f"g_{uuid.uuid4().hex[:10]}",
                                "event": event, "year": year, "name": name,
                                "imagely_id": None, "source_url": href,
                                "cover_image": scrape["cover_image"],
                                "images": scrape["images"],
                                "image_count": scrape["image_count"],
                                "order": 0, "auto_synced": True,
                                "created_at": iso(now_utc()),
                                "last_synced_at": iso(now_utc()),
                            })
                            created += 1
                    except Exception:
                        failed.append(href)
                await db.sync_jobs.update_one({"job_id": job_id}, {"$set": {
                    "processed": processed, "created": created, "skipped": skipped,
                    "failed_count": len(failed), "current": meta["title"],
                }})
                await _asyncio.sleep(0.8)

        await db.sync_jobs.update_one({"job_id": job_id}, {"$set": {
            "status": "done", "finished_at": iso(now_utc()),
            "created": created, "skipped": skipped, "failed": failed,
        }})
    except Exception as e:
        await db.sync_jobs.update_one({"job_id": job_id}, {"$set": {
            "status": "error", "error": str(e), "finished_at": iso(now_utc()),
        }})

@api.post("/galleries/sync")
async def sync_all_galleries(data: GallerySyncAll, user: dict = Depends(require_admin)):
    """Start a background sync job. Returns a job_id to poll."""
    job_id = f"sj_{uuid.uuid4().hex[:10]}"
    await db.sync_jobs.insert_one({
        "job_id": job_id, "status": "queued", "source_url": data.source_url,
        "processed": 0, "created": 0, "skipped": 0, "failed_count": 0, "total": 0,
        "created_at": iso(now_utc()),
    })
    _asyncio.create_task(_run_sync_job(job_id, data))
    return {"job_id": job_id, "status": "queued"}

@api.get("/galleries/sync/status/{job_id}")
async def sync_job_status(job_id: str, user: dict = Depends(require_admin)):
    j = await db.sync_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(404, "Job not found")
    return j

PMPRO_LEVELS_URL = "https://rintaki.org/membership-account/membership-levels/"
_pmpro_cache: dict = {"ts": 0, "levels": None}
PMPRO_TTL = 3600  # 1 hour

# Fallback list used only if live scrape fails AND no cache exists.
MEMBERSHIP_LEVELS_FALLBACK = [
    {"level": 1, "name": "Free", "subtitle": "", "price": "$0", "interval": "mo", "tier": "free",
     "checkout_url": "https://rintaki.org/membership-account/membership-checkout/?pmpro_level=1",
     "benefits": ["Member ID Card", "Library Access"]},
    {"level": 2, "name": "Regular", "subtitle": "Monthly Subscription", "price": "$19.99", "interval": "mo", "tier": "regular",
     "checkout_url": "https://rintaki.org/membership-account/membership-checkout/?pmpro_level=2", "benefits": []},
    {"level": 3, "name": "Regular", "subtitle": "Yearly Subscription", "price": "$239.88", "interval": "yr", "tier": "regular",
     "checkout_url": "https://rintaki.org/membership-account/membership-checkout/?pmpro_level=3", "benefits": []},
    {"level": 4, "name": "Premium", "subtitle": "Monthly Subscription", "price": "$39.99", "interval": "mo", "tier": "premium",
     "checkout_url": "https://rintaki.org/membership-account/membership-checkout/?pmpro_level=4", "benefits": []},
    {"level": 5, "name": "Premium", "subtitle": "Yearly Subscription", "price": "$479.88", "interval": "yr", "tier": "premium",
     "checkout_url": "https://rintaki.org/membership-account/membership-checkout/?pmpro_level=5", "benefits": []},
]

async def _scrape_pmpro_levels() -> List[dict]:
    from bs4 import BeautifulSoup
    import re as _re
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "Mozilla/5.0 RintakiApp"}, follow_redirects=True) as c:
        r = await c.get(PMPRO_LEVELS_URL)
        r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    levels = []
    for a in soup.select('a[href*="pmpro_level="]'):
        href = a.get("href", "")
        m = _re.search(r"pmpro_level=(\d+)", href)
        if not m:
            continue
        level_id = int(m.group(1))
        # Find the card ancestor that has both an h3 and a ul (benefits)
        card = a
        for _ in range(10):
            card = card.parent
            if card is None:
                break
            if card.find("h3") and card.find("ul"):
                break
        if not card:
            continue
        h3 = card.find("h3")
        ul = card.find("ul")
        name = h3.get_text(strip=True) if h3 else f"Level {level_id}"
        # subtitle = <p> containing "Subscription" / "Monthly" / "Yearly"
        subtitle = ""
        for p in card.select("p"):
            t = p.get_text(strip=True)
            if any(w in t for w in ("Subscription", "Monthly", "Yearly")):
                subtitle = t
                break
        # price: scan nodes between h3 and ul for "$ NN.NN /xx" pattern
        price = ""
        interval = ""
        node = h3
        price_re = _re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*/\s*(mo|yr|month|year)", _re.IGNORECASE)
        for _ in range(60):
            node = node.next_element if node is not None else None
            if node is None or node is ul:
                break
            if hasattr(node, "get_text"):
                t = node.get_text(" ", strip=True)
                pm = price_re.search(t)
                if pm:
                    price = f"${pm.group(1)}"
                    interval = pm.group(2).lower().replace("month", "mo").replace("year", "yr")
                    break
        if not price:
            price = "$0" if level_id == 1 else ""
            interval = interval or "mo"
        benefits = [li.get_text(" ", strip=True) for li in ul.select("li")] if ul else []
        # Tier classification
        tier = "free" if "free" in name.lower() or level_id == 1 else ("premium" if "premium" in name.lower() else "regular")
        levels.append({
            "level": level_id,
            "name": name,
            "subtitle": subtitle,
            "price": price,
            "interval": interval,
            "tier": tier,
            "checkout_url": f"https://rintaki.org/membership-account/membership-checkout/?pmpro_level={level_id}",
            "benefits": benefits,
        })
    # Dedup by level id (PMPro page may have duplicate anchors)
    by_id = {}
    for lvl in levels:
        by_id.setdefault(lvl["level"], lvl)
    return sorted(by_id.values(), key=lambda x: x["level"])

async def get_membership_levels_cached(force: bool = False) -> dict:
    now_ts = _time.time()
    if not force and _pmpro_cache["levels"] and now_ts - _pmpro_cache["ts"] < PMPRO_TTL:
        return {"levels": _pmpro_cache["levels"], "source": "cache", "cached_at": int(_pmpro_cache["ts"])}
    try:
        live = await _scrape_pmpro_levels()
        if live:
            _pmpro_cache["levels"] = live
            _pmpro_cache["ts"] = now_ts
            return {"levels": live, "source": "live", "cached_at": int(now_ts)}
    except Exception as e:
        logger.warning(f"PMPro scrape failed: {e}")
    # Fallback to last-known cache or hardcoded
    if _pmpro_cache["levels"]:
        return {"levels": _pmpro_cache["levels"], "source": "cache-stale", "cached_at": int(_pmpro_cache["ts"])}
    return {"levels": MEMBERSHIP_LEVELS_FALLBACK, "source": "fallback", "cached_at": 0}

@api.get("/memberships/levels")
async def list_membership_levels(refresh: bool = False):
    return await get_membership_levels_cached(force=refresh)



# ----------------- Social / Links -----------------
@api.get("/links")
async def get_links():
    return {
        "library": os.environ.get("LIBRARY_URL", ""),
        "social": {
            "tiktok": os.environ.get("SOCIAL_TIKTOK", ""),
            "instagram": os.environ.get("SOCIAL_INSTAGRAM", ""),
            "twitter": os.environ.get("SOCIAL_TWITTER", ""),
            "facebook": os.environ.get("SOCIAL_FACEBOOK", ""),
            "youtube": os.environ.get("SOCIAL_YOUTUBE", ""),
            "discord_public": os.environ.get("SOCIAL_DISCORD_PUBLIC", ""),
            "discord_members": os.environ.get("SOCIAL_DISCORD_MEMBERS", ""),
        },
    }

# ----------------- Live Guides (scraped from rintaki.org) -----------------
_guides_cache: dict = {}  # key -> (ts, html)
GUIDES_TTL = 3600  # 1 hour

async def _scrape_guide_html(url: str) -> dict:
    """Fetch a rintaki.org page and return sanitized article HTML + plain title.

    Strips scripts, styles, iframes, forms, nav/header/footer/sidebar.
    Keeps paragraphs, headings, lists, tables, blockquotes, figures, links, images.
    """
    from bs4 import BeautifulSoup
    async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                 headers={"User-Agent": "Mozilla/5.0 RintakiApp/1.0"}) as hc:
        r = await hc.get(url)
        if r.status_code != 200:
            raise HTTPException(502, f"Could not fetch page (HTTP {r.status_code})")
        soup = BeautifulSoup(r.text, "lxml")
    # Title: prefer H1 on the page, else <title>
    title_el = soup.find("h1") or soup.find("title")
    title = title_el.get_text(" ", strip=True) if title_el else ""
    # Find the main content container — Elementor pages store content inside .elementor
    root = (
        soup.select_one(".elementor-section-wrap")
        or soup.select_one('[data-elementor-type="wp-page"]')
        or soup.select_one(".entry-content")
        or soup.find("main")
        or soup.find("article")
        or soup.body
    )
    if not root:
        return {"title": title, "html": "", "url": url}
    # Strip unwanted elements
    for sel in [
        "script", "style", "noscript", "iframe", "form",
        "nav", "header", "footer", ".rstb-page-title",
        ".elementor-widget-wp-widget-nav_menu",
        ".moderncart-plugin", "#site-preloader", "#moderncart-floating-cart",
        "#moderncart-slide-out-modal", "#live-region",
        ".widget_shopping_cart_live_region", ".screen-reader-text",
        ".a11y-speak-region", "#fpg-reading-progress",
        # Per-user points widgets (require WP login context — useless in app)
        ".mycred-my-balance", ".mycred-badges-list", ".mycred-log",
        ".mycred-ranking-list",
    ]:
        for el in root.select(sel):
            el.decompose()
    # Strip dangerous attributes
    for el in root.find_all(True):
        for attr in list(el.attrs.keys()):
            if attr.startswith("on") or attr in ("style", "class", "id",
                                                 "data-elementor-type", "data-elementor-id",
                                                 "data-element_type", "data-e-type",
                                                 "data-id", "data-widget_type",
                                                 "data-settings", "data-e-action-hash"):
                del el.attrs[attr]
    # Absolutize relative URLs
    import re as _re
    for tag, attr in (("a", "href"), ("img", "src")):
        for el in root.find_all(tag):
            v = el.get(attr) or ""
            if v.startswith("/"):
                el[attr] = "https://rintaki.org" + v
    html = str(root)
    # Collapse big whitespace blocks
    html = _re.sub(r"\n\s*\n+", "\n", html)
    return {"title": title, "html": html, "url": url}

async def _guide_cached(key: str, url: str, refresh: bool = False):
    now_ts = _time.time()
    if not refresh and key in _guides_cache:
        ts, data = _guides_cache[key]
        if now_ts - ts < GUIDES_TTL:
            return {**data, "cached": True}
    try:
        data = await _scrape_guide_html(url)
    except HTTPException:
        # Fall back to stale cache if available
        if key in _guides_cache:
            return {**_guides_cache[key][1], "cached": True, "stale": True}
        raise
    _guides_cache[key] = (now_ts, data)
    return {**data, "cached": False}

@api.get("/guides/points")
async def guide_points(refresh: bool = False):
    return await _guide_cached("points", "https://rintaki.org/points/", refresh=refresh)

@api.get("/guides/anime-cash")
async def guide_anime_cash(refresh: bool = False):
    return await _guide_cached("anime-cash", "https://rintaki.org/member-dashboard/anime-cash/", refresh=refresh)


def _parse_guide_sections(html: str, drop_headings: Optional[list] = None) -> list:
    """Turn scraped guide HTML into [{heading, intro, items:[{amount, unit, desc}]}, ...].

    Strategy:
      1. Flatten the DOM to a linear stream of heading / paragraph-block nodes.
      2. For each paragraph, split on <br> or newlines so each "line" can be classified.
      3. A line that STARTS with a parenthesized amount — `(1pt)`, `(25pts per hr)`,
         `(10pts per $25)`, `($5 / month)`, `(Varies)`, `(15-30pts)` — becomes a structured item.
      4. Everything else becomes intro text.
      5. `drop_headings` (case-insensitive) skips whole sections (e.g. per-user widgets).
    """
    from bs4 import BeautifulSoup, NavigableString
    import re

    soup = BeautifulSoup(f"<div>{html}</div>", "lxml")
    root = soup.div
    drop_set = {h.strip().lower() for h in (drop_headings or [])}

    # Normalize <br> → newlines so .get_text() keeps line structure.
    for br in root.find_all("br"):
        br.replace_with(NavigableString("\n"))

    # Walk the tree and emit an ordered stream of (kind, text) tokens.
    # kind ∈ {"heading", "para"}. Headings carry a level.
    tokens = []

    def emit_paragraphs(text: str):
        for line in text.splitlines():
            line = line.strip()
            if line:
                tokens.append(("line", line))

    def walk(node):
        for child in node.children:
            name = getattr(child, "name", None)
            if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                tokens.append(("heading", int(name[1]), child.get_text(" ", strip=True)))
            elif name in ("p", "li", "blockquote"):
                # Harvest the whole block, preserving the newlines we inserted for <br>.
                emit_paragraphs(child.get_text())
            elif name in ("ul", "ol", "dl"):
                # Visit each list item recursively — list items may contain their own headings
                for li in child.find_all(["li", "dd", "dt"], recursive=False):
                    walk(li)
            elif name in ("table",):
                # Skip tables (usually per-user points history)
                continue
            elif name is None:
                # Text node directly under a container
                text = str(child).strip()
                if text:
                    emit_paragraphs(text)
            else:
                walk(child)

    walk(root)

    # Build sections
    ITEM_RE = re.compile(r"^\(\s*([^)]+?)\s*\)\s*(.*)", re.S)
    AMOUNT_RE = re.compile(r"^([\d\-\.\$]+)\s*(.*)$")

    sections = []
    current = None
    for tok in tokens:
        if tok[0] == "heading":
            _, level, heading = tok
            if not heading:
                continue
            if heading.lower() in drop_set:
                current = {"_drop": True}
                continue
            current = {"heading": heading, "level": level, "intro": "", "items": []}
            sections.append(current)
        elif tok[0] == "line":
            line = tok[1]
            if not current or current.get("_drop"):
                continue
            m = ITEM_RE.match(line)
            if m:
                amount_raw = m.group(1).strip()
                desc = m.group(2).strip(" .")
                am = AMOUNT_RE.match(amount_raw)
                if am and am.group(1):
                    value = am.group(1).strip()
                    unit = am.group(2).strip() or "pts"
                else:
                    value = amount_raw
                    unit = ""
                if desc:
                    current["items"].append({"amount": value, "unit": unit, "desc": desc})
                else:
                    current["intro"] = (current["intro"] + " " + line).strip()
            else:
                current["intro"] = (current["intro"] + " " + line).strip()

    # Drop empty sections & purely meta headings (H1/H2 that only wrap children),
    # and the "rev (…)" timestamp lines.
    cleaned = []
    for s in sections:
        if s.get("_drop"):
            continue
        # Normalise intro: strip double spaces, strip "rev (05.21.2023)" leading marker
        s["intro"] = re.sub(r"\s{2,}", " ", s.get("intro") or "").strip()
        s["intro"] = re.sub(r"^rev\s*\([^)]+\)\s*", "", s["intro"], flags=re.I)
        if not s["intro"] and not s["items"]:
            continue
        s.pop("_drop", None)
        cleaned.append(s)
    return cleaned


@api.get("/guides/points/parsed")
async def guide_points_parsed(refresh: bool = False, user: Optional[dict] = Depends(get_current_user_optional)):
    """Structured version of the Points guide — sections + point items for nicer rendering."""
    data = await _guide_cached("points", "https://rintaki.org/points/", refresh=refresh)
    sections = _parse_guide_sections(
        data.get("html", ""),
        drop_headings=[
            "Points Guide",  # the page H1 is redundant with our UI heading
            "Current Point Total",
            "Current Rank",
            "Points History",
        ],
    )
    return {
        "title": data.get("title", "Points Guide"),
        "sections": _inject_claim_state(sections, user),
        "cached": data.get("cached"),
        "stale": data.get("stale", False),
        "source_url": "https://rintaki.org/points/",
    }

# ----------------- Point Claims (member self-report, admin-approved → MyCred) -----------------
#
# Each Points-Guide line becomes a deterministic item_key = slug("heading || desc"). We classify
# every item into one of three modes:
#   - AUTO:  the app awards these automatically. The Guide shows a static checkmark.
#   - ADMIN: only an admin can award these (officer role, MOTM, giveaway winners, etc.). No Claim button.
#   - CLAIM: member taps "Claim", optionally attaches a photo. Admin reviews the queue and approves/rejects.
#             Approval calls mycred_adjust() → hits the WP plugin /adjust endpoint with a unique `ref`
#             so MyCred on rintaki.org gets the entry and duplicates are prevented.
#
# Keep these maps in sync with the rintaki.org/points page. When new items appear they default to CLAIM.

import hashlib as _hashlib

def _item_key(heading: str, desc: str) -> str:
    """Deterministic slug used to identify a Points-Guide line across cache refreshes."""
    raw = f"{(heading or '').strip().lower()}||{(desc or '').strip().lower()}"
    return _hashlib.sha1(raw.encode("utf-8")).hexdigest()[:14]

# Category lookups — expressed as "substring in heading::desc" so small wording tweaks on the
# rintaki.org page don't break classification.
AUTO_ITEMS = {
    "member status::each time you visit":      {"amount": 1,  "ref_prefix": "visit"},
    "submissions::fan art or poem":            {"amount": 50, "ref_prefix": "article_fanart"},
    "submissions::art for merchandise":        {"amount": 50, "ref_prefix": "article_merch"},
    "submissions::anime reviews":              {"amount": 25, "ref_prefix": "article_review"},  # midpoint of 25-50; admin can bump
    # Note: forum reply (+2) isn't on the Points Guide; it's app-only and already awarded.
}
ADMIN_ONLY_ITEMS = {
    "member status::officer positions",
    "awards::member of the month",
    "awards::gift card giveaway",
    "awards::anime give away",
    "bonuses::additional points are at times awarded",   # "Varies" — admin discretion
    "bonuses::reaching 1000 points",
}

def _classify_item(heading: str, desc: str) -> str:
    """Return 'auto' | 'admin' | 'claim' for a given guide line."""
    needle = f"{(heading or '').lower()}::{(desc or '').lower()}"
    for auto_key in AUTO_ITEMS:
        if auto_key in needle:
            return "auto"
    for admin_key in ADMIN_ONLY_ITEMS:
        if admin_key in needle:
            return "admin"
    return "claim"

def _inject_claim_state(sections: list, user: Optional[dict]) -> list:
    """Return sections with `item_key`, `mode`, and per-user `claim_status` fields added to each item."""
    out = []
    for s in sections:
        items = []
        for it in s.get("items", []):
            key = _item_key(s["heading"], it["desc"])
            mode = _classify_item(s["heading"], it["desc"])
            items.append({
                **it,
                "item_key": key,
                "mode": mode,  # "auto" | "admin" | "claim"
            })
        out.append({**s, "items": items})
    return out

class PointClaimIn(BaseModel):
    item_key: str
    item_heading: str
    item_desc: str
    amount: Optional[int] = None  # member-suggested amount for ranged items (e.g. 25-50 pts); capped by admin
    note: Optional[str] = ""
    photo_data_url: Optional[str] = None  # base64-encoded data URL or regular URL

async def _store_claim_photo(data_url: str, user_id: str) -> Optional[str]:
    """Save a base64 data URL photo attached to a claim and return its public URL."""
    import base64
    import re
    if not data_url:
        return None
    m = re.match(r"^data:image/([a-zA-Z]+);base64,(.*)$", data_url)
    if not m:
        # Assume it's already a URL (http or /api/uploads/...)
        return data_url
    ext = m.group(1).lower()
    if ext not in ("png", "jpeg", "jpg", "webp", "gif"):
        raise HTTPException(400, "Unsupported photo format")
    try:
        raw = base64.b64decode(m.group(2))
    except Exception:
        raise HTTPException(400, "Invalid base64 photo")
    if len(raw) > 6 * 1024 * 1024:
        raise HTTPException(413, "Photo too large (max 6 MB)")
    CLAIMS_DIR = Path("/app/backend/uploads/claims")
    CLAIMS_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"{user_id}_{uuid.uuid4().hex[:10]}.{ext if ext != 'jpeg' else 'jpg'}"
    (CLAIMS_DIR / fname).write_bytes(raw)
    return f"/api/uploads/claims/{fname}"

@api.post("/guides/points/claim")
async def submit_point_claim(data: PointClaimIn, user: dict = Depends(require_member)):
    """Member submits a claim for a Points-Guide item that needs admin verification."""
    mode = _classify_item(data.item_heading, data.item_desc)
    if mode == "auto":
        raise HTTPException(400, "This item is awarded automatically — no claim needed.")
    if mode == "admin":
        raise HTTPException(400, "This item is admin-assigned only.")
    amount = int(data.amount) if data.amount else 0
    if amount <= 0 or amount > 500:
        raise HTTPException(400, "Claim amount must be between 1 and 500 points")
    photo_url = await _store_claim_photo(data.photo_data_url, user["user_id"]) if data.photo_data_url else None
    claim_id = f"pclm_{uuid.uuid4().hex[:12]}"
    doc = {
        "claim_id": claim_id,
        "user_id": user["user_id"],
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "item_key": data.item_key,
        "item_heading": data.item_heading,
        "item_desc": data.item_desc,
        "amount": amount,
        "note": (data.note or "").strip()[:500],
        "photo_url": photo_url,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.point_claims.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "claim": doc}

@api.get("/guides/points/my-claims")
async def my_point_claims(user: dict = Depends(get_current_user)):
    """Member views their own claim history (most recent first)."""
    items = await db.point_claims.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"claims": items}

@api.get("/admin/point-claims")
async def admin_list_claims(status: str = "pending", user: dict = Depends(require_admin)):
    """Admin queue — filter by status=pending|approved|rejected|all."""
    q = {} if status == "all" else {"status": status}
    items = await db.point_claims.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"claims": items}

class PointClaimDecide(BaseModel):
    amount: Optional[int] = None  # admin can override the approved amount
    admin_note: Optional[str] = ""

@api.post("/admin/point-claims/{claim_id}/approve")
async def admin_approve_claim(claim_id: str, data: PointClaimDecide, user: dict = Depends(require_admin)):
    """Approve a manual point claim → award points via MyCred on rintaki.org (idempotent)."""
    claim = await db.point_claims.find_one({"claim_id": claim_id})
    if not claim:
        raise HTTPException(404, "Claim not found")
    if claim.get("status") == "approved":
        return {"ok": True, "already": True}
    amount = int(data.amount) if data.amount else int(claim.get("amount") or 0)
    if amount <= 0 or amount > 1000:
        raise HTTPException(400, "Approved amount must be between 1 and 1000")
    # Award
    ref = f"claim:{claim_id}"
    reason = f"{claim['item_heading']}: {claim['item_desc'][:60]}"
    await add_points(claim["user_id"], amount, reason, ref=ref)
    await db.point_claims.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "approved",
            "approved_amount": amount,
            "approved_at": iso(now_utc()),
            "approved_by": user["user_id"],
            "admin_note": (data.admin_note or "").strip()[:500],
        }},
    )
    # Notify the member
    try:
        await push_notification(
            claim["user_id"],
            "Claim approved!",
            f"You earned +{amount} pts for: {claim['item_desc'][:60]}",
            "points",
            "/dashboard/points-guide",
        )
    except Exception:
        pass
    return {"ok": True, "amount": amount}

@api.post("/admin/point-claims/{claim_id}/reject")
async def admin_reject_claim(claim_id: str, data: PointClaimDecide, user: dict = Depends(require_admin)):
    claim = await db.point_claims.find_one({"claim_id": claim_id})
    if not claim:
        raise HTTPException(404, "Claim not found")
    if claim.get("status") == "approved":
        raise HTTPException(400, "Already approved — can't reject.")
    await db.point_claims.update_one(
        {"claim_id": claim_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": iso(now_utc()),
            "rejected_by": user["user_id"],
            "admin_note": (data.admin_note or "").strip()[:500],
        }},
    )
    try:
        await push_notification(
            claim["user_id"],
            "Claim not approved",
            f"Your claim for {claim['item_desc'][:60]} was declined. " +
            ((data.admin_note or "")[:100] or ""),
            "points",
            "/dashboard/points-guide",
        )
    except Exception:
        pass
    return {"ok": True}

# ----------------- Auto awards that need explicit endpoints -----------------

@api.post("/guides/points/track-visit")
async def track_daily_visit(user: dict = Depends(require_member)):
    """Called by the app on open — awards 1 pt / day / member, idempotent across retries.

    Separate from /auth/daily-bonus (which is +5 and requires the user to tap a button).
    This is the 'Each time you visit our site' +1 pt entry from the rintaki.org Points Guide.
    """
    today = now_utc().date().isoformat()
    ref = f"visit:{user['user_id']}:{today}"
    # Mongo-side dedup: only award if we haven't seen this ref
    existing = await db.points_transactions.find_one({"ref": ref})
    if existing:
        return {"ok": True, "already": True}
    await add_points(user["user_id"], 1, "Daily app visit", ref=ref)
    return {"ok": True, "awarded": 1}

# ----------------- Monthly Active-Member award (50 pts/mo if ≥ 400 pts earned last month) -----------------
ACTIVE_MEMBER_THRESHOLD = 400  # ~1/3 of the max monthly manual+admin points ceiling
ACTIVE_MEMBER_AWARD = 50

async def _maybe_award_active_member(user: dict) -> Optional[int]:
    """If the user earned ≥ ACTIVE_MEMBER_THRESHOLD pts in the previous calendar month
    and hasn't been credited yet for that month, award +50 pts. Idempotent via ref."""
    now = now_utc()
    # Use UTC; compute prior month
    if now.month == 1:
        prev_year, prev_month = now.year - 1, 12
    else:
        prev_year, prev_month = now.year, now.month - 1
    period = f"{prev_year:04d}-{prev_month:02d}"
    ref = f"active_member:{user['user_id']}:{period}"
    # already credited?
    if await db.points_transactions.find_one({"ref": ref}):
        return None
    # Sum prior-month earnings. Use created_at ISO string prefix (faster than date parsing).
    period_prefix = period + "-"
    cursor = db.points_transactions.find(
        {
            "user_id": user["user_id"],
            "kind": "points",
            "amount": {"$gt": 0},
            "created_at": {"$regex": f"^{period_prefix}"},
        },
        {"_id": 0, "amount": 1, "ref": 1},
    )
    total = 0
    async for tx in cursor:
        # Exclude prior active-member credits so this never self-amplifies
        if str(tx.get("ref", "")).startswith("active_member:"):
            continue
        total += int(tx.get("amount") or 0)
    if total < ACTIVE_MEMBER_THRESHOLD:
        return None
    await add_points(
        user["user_id"],
        ACTIVE_MEMBER_AWARD,
        f"Active Member bonus ({period}) — earned {total} pts last month",
        ref=ref,
    )
    try:
        await push_notification(
            user["user_id"],
            "Active Member bonus!",
            f"+{ACTIVE_MEMBER_AWARD} pts for earning {total} pts in {period}.",
            "points",
            "/dashboard/points-guide",
        )
    except Exception:
        pass
    return ACTIVE_MEMBER_AWARD

@api.get("/guides/anime-cash/parsed")
async def guide_anime_cash_parsed(refresh: bool = False):
    """Structured version of the Anime Cash guide."""
    data = await _guide_cached("anime-cash", "https://rintaki.org/member-dashboard/anime-cash/", refresh=refresh)
    sections = _parse_guide_sections(
        data.get("html", ""),
        drop_headings=["Anime Cash"],
    )
    return {
        "title": data.get("title", "Anime Cash"),
        "sections": sections,
        "cached": data.get("cached"),
        "stale": data.get("stale", False),
        "source_url": "https://rintaki.org/member-dashboard/anime-cash/",
    }


# ----------------- WooCommerce Shop (proxy to WC Store API) -----------------
WC_BASE = os.environ.get("RINTAKI_WC_BASE", "https://rintaki.org")
_wc_cache: dict = {}  # key -> (ts, data)
WC_TTL = 600  # 10 minutes

def _wc_simplify_product(p: dict) -> dict:
    prices = p.get("prices") or {}
    cur = prices.get("currency_symbol") or "$"
    # prices.price is a string in minor units ("1200") — divide by 10^minor_unit (usually 2)
    try:
        minor = int(prices.get("currency_minor_unit", 2))
        price_str = prices.get("price") or "0"
        price_val = float(price_str) / (10 ** minor)
        price_formatted = f"{cur}{price_val:,.2f}"
    except Exception:
        price_formatted = p.get("price_html") or ""
        price_val = None
    imgs = p.get("images") or []
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "slug": p.get("slug"),
        "permalink": p.get("permalink"),
        "price": price_formatted,
        "price_value": price_val,
        "on_sale": bool(p.get("on_sale")),
        "short_description": p.get("short_description") or "",
        "description": p.get("description") or "",
        "image": imgs[0]["src"] if imgs else None,
        "images": [i.get("src") for i in imgs if i.get("src")],
        "categories": [{"id": c.get("id"), "name": c.get("name"), "slug": c.get("slug")} for c in (p.get("categories") or [])],
        "rating": p.get("average_rating"),
        "review_count": p.get("review_count"),
        "in_stock": (p.get("is_in_stock") if p.get("is_in_stock") is not None else True),
        "add_to_cart_url": f"{WC_BASE.rstrip('/')}/?add-to-cart={p.get('id')}&quantity=1",
    }

async def _wc_fetch(path: str, params: Optional[dict] = None):
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "Mozilla/5.0 RintakiApp"}, follow_redirects=True) as c:
        r = await c.get(f"{WC_BASE.rstrip('/')}/wp-json/wc/store/v1{path}", params=params or {})
        r.raise_for_status()
        return r.json()

@api.get("/shop/products")
async def shop_products(page: int = 1, per_page: int = 20, search: str = "", category: Optional[int] = None, refresh: bool = False):
    per_page = max(1, min(per_page, 50))
    cache_key = f"products:{page}:{per_page}:{search}:{category}"
    now_ts = _time.time()
    if not refresh and cache_key in _wc_cache:
        ts, data = _wc_cache[cache_key]
        if now_ts - ts < WC_TTL:
            return {**data, "source": "cache"}
    params = {"page": page, "per_page": per_page}
    if search:
        params["search"] = search
    if category:
        params["category"] = category
    try:
        raw = await _wc_fetch("/products", params=params)
        products = [_wc_simplify_product(p) for p in raw]
        data = {"products": products, "page": page, "per_page": per_page}
        _wc_cache[cache_key] = (now_ts, data)
        return {**data, "source": "live"}
    except Exception as e:
        logger.warning(f"shop_products failed: {e}")
        if cache_key in _wc_cache:
            return {**_wc_cache[cache_key][1], "source": "cache-stale"}
        raise HTTPException(502, f"Could not fetch products: {e}")

@api.get("/shop/categories")
async def shop_categories(refresh: bool = False):
    now_ts = _time.time()
    if not refresh and "categories" in _wc_cache:
        ts, data = _wc_cache["categories"]
        if now_ts - ts < WC_TTL:
            return {**data, "source": "cache"}
    try:
        raw = await _wc_fetch("/products/categories", params={"per_page": 50})
        cats = [{"id": c.get("id"), "name": c.get("name"), "slug": c.get("slug"), "count": c.get("count")} for c in raw if c.get("count", 0) > 0]
        data = {"categories": cats}
        _wc_cache["categories"] = (now_ts, data)
        return {**data, "source": "live"}
    except Exception as e:
        logger.warning(f"shop_categories failed: {e}")
        return {"categories": []}

@api.get("/shop/products/{product_id}")
async def shop_product_detail(product_id: int, refresh: bool = False):
    cache_key = f"product:{product_id}"
    now_ts = _time.time()
    if not refresh and cache_key in _wc_cache:
        ts, data = _wc_cache[cache_key]
        if now_ts - ts < WC_TTL:
            return {**data, "source": "cache"}
    try:
        raw = await _wc_fetch(f"/products/{product_id}")
        data = {"product": _wc_simplify_product(raw)}
        _wc_cache[cache_key] = (now_ts, data)
        return {**data, "source": "live"}
    except Exception as e:
        raise HTTPException(404, f"Product not found: {e}")

async def _resolve_tag_id(slug: str) -> Optional[int]:
    """Resolve a WooCommerce product tag slug (e.g. 'members') to its numeric ID."""
    cache_key = f"tag_id:{slug}"
    now_ts = _time.time()
    if cache_key in _wc_cache:
        ts, data = _wc_cache[cache_key]
        if now_ts - ts < WC_TTL:
            return data
    try:
        raw = await _wc_fetch("/products/tags", params={"per_page": 100})
        tag_id = None
        for t in raw:
            if (t.get("slug") or "").lower() == slug.lower():
                tag_id = t.get("id")
                break
        _wc_cache[cache_key] = (now_ts, tag_id)
        return tag_id
    except Exception as e:
        logger.warning(f"_resolve_tag_id failed: {e}")
        return None

@api.get("/shop/members-catalog")
async def shop_members_catalog(page: int = 1, per_page: int = 20, search: str = "", user: dict = Depends(require_member)):
    """Products tagged 'members' on WooCommerce — visible only to paid members + admins."""
    per_page = max(1, min(per_page, 50))
    tag_id = await _resolve_tag_id("members")
    if not tag_id:
        return {
            "products": [], "page": page, "per_page": per_page,
            "source": "no-tag",
            "admin_hint": "No WooCommerce tag with slug 'members' was found. Create one at rintaki.org → WooCommerce → Products → Tags, then add it to members-only products.",
        }
    cache_key = f"members-catalog:{page}:{per_page}:{search}"
    now_ts = _time.time()
    if cache_key in _wc_cache:
        ts, data = _wc_cache[cache_key]
        if now_ts - ts < WC_TTL:
            return {**data, "source": "cache"}
    params = {"page": page, "per_page": per_page, "tag": tag_id}
    if search:
        params["search"] = search
    try:
        raw = await _wc_fetch("/products", params=params)
        products = [_wc_simplify_product(p) for p in raw]
        data = {"products": products, "page": page, "per_page": per_page, "tag_id": tag_id}
        _wc_cache[cache_key] = (now_ts, data)
        return {**data, "source": "live"}
    except Exception as e:
        raise HTTPException(502, f"Could not fetch catalog: {e}")

@api.get("/profile/wordpress")
async def get_wp_profile(user: dict = Depends(get_current_user)):
    """Fetch the WordPress user profile (PMPro billing fields) for the logged-in user."""
    base = os.environ.get("RINTAKI_WP_BASE_URL")
    key = os.environ.get("RINTAKI_WP_KEY")
    if not base or not key:
        return {"found": False, "wp_configured": False}
    try:
        async with httpx.AsyncClient(timeout=8) as hc:
            r = await hc.get(
                f"{base.rstrip('/')}/wp-json/rintaki/v1/profile",
                params={"email": user.get("email", "")},
                headers={"X-Rintaki-Key": key},
            )
            if r.status_code == 404:
                # Old plugin version (v1.0 / v1.1) — doesn't have /profile yet
                return {"found": False, "wp_configured": True, "plugin_outdated": True}
            if r.status_code != 200:
                return {"found": False, "wp_configured": True, "error": f"WP returned {r.status_code}"}
            return r.json()
    except Exception as e:
        logger.warning(f"get_wp_profile failed: {e}")
        return {"found": False, "wp_configured": True, "error": str(e)}


# ----------------- Media Feed (Instagram-style) -----------------
class MediaPostCreate(BaseModel):
    media_type: str  # "image" or "video"
    media_url: str
    caption: str = ""
    video_duration: Optional[float] = None  # seconds, client-reported

class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)

VIDEO_MAX_SECONDS = 15
POINTS_PER_PHOTO = 1
POINTS_PER_VIDEO = 2

@api.get("/feed/posts")
async def list_posts(user: dict = Depends(get_current_user_optional)):
    """Public feed — only approved posts. Admins additionally see pending via /feed/pending."""
    posts = await db.media_posts.find({"status": "approved"}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"posts": posts}

@api.get("/feed/my-pending")
async def my_pending_posts(user: dict = Depends(require_member)):
    """A member's own pending posts so they can see submission status."""
    posts = await db.media_posts.find({"author_id": user["user_id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"posts": posts}

@api.get("/feed/pending")
async def admin_pending_posts(user: dict = Depends(require_admin)):
    posts = await db.media_posts.find({"status": "pending"}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"posts": posts}

# ---- Spotlight native uploads (phone camera / gallery) ----
UPLOADS_DIR = Path("/app/backend/uploads/spotlight")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Per-file size ceiling (accepts short phone videos + high-res photos)
MAX_IMAGE_BYTES = 12 * 1024 * 1024     # 12 MB
MAX_VIDEO_BYTES = 60 * 1024 * 1024     # 60 MB (15s iPhone 4K HEVC ≈ 25 MB)
ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "heic", "heif", "gif"}
ALLOWED_VIDEO_EXT = {"mp4", "mov", "m4v", "webm", "3gp"}

def _public_upload_url(request: Request, filename: str) -> str:
    """Build the public URL for an uploaded file.

    The backend is reached through the ingress which rewrites /api/* to port 8001.
    Front-end reads REACT_APP_BACKEND_URL which already points to that public host,
    so we just return a relative /api/uploads/... path and let the frontend join it.
    """
    return f"/api/uploads/spotlight/{filename}"

@api.post("/feed/upload")
async def upload_spotlight_media(
    request: Request,
    file: UploadFile = File(...),
    media_type: str = Form(...),
    user: dict = Depends(require_member),
):
    """Accept a native photo/video upload from the user's phone and return a URL.

    The frontend then POSTs /feed/posts with media_url = returned URL.
    """
    if media_type not in ("image", "video"):
        raise HTTPException(400, "media_type must be image or video")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    allowed = ALLOWED_IMAGE_EXT if media_type == "image" else ALLOWED_VIDEO_EXT
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported {media_type} format .{ext}. Allowed: {', '.join(sorted(allowed))}.")
    limit = MAX_IMAGE_BYTES if media_type == "image" else MAX_VIDEO_BYTES
    # Stream to disk, enforce limit
    file_id = f"{user['user_id']}_{uuid.uuid4().hex[:10]}.{ext}"
    dest = UPLOADS_DIR / file_id
    total = 0
    try:
        with open(dest, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    out.close()
                    dest.unlink(missing_ok=True)
                    human = f"{limit // (1024 * 1024)} MB"
                    raise HTTPException(413, f"File too large. Max {human} for {media_type}s.")
                out.write(chunk)
    finally:
        await file.close()
    # Basic content-type sanity
    ctype = (file.content_type or "").lower()
    if media_type == "image" and ctype and not ctype.startswith("image/"):
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "File content-type is not an image.")
    if media_type == "video" and ctype and not ctype.startswith("video/"):
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "File content-type is not a video.")
    return {
        "url": _public_upload_url(request, file_id),
        "filename": file_id,
        "size": total,
        "media_type": media_type,
    }

@api.post("/feed/posts")
async def create_post(data: MediaPostCreate, user: dict = Depends(require_member)):
    if data.media_type not in ("image", "video"):
        raise HTTPException(400, "media_type must be image or video")
    if data.media_type == "video":
        if data.video_duration is not None and data.video_duration > VIDEO_MAX_SECONDS + 0.5:
            raise HTTPException(400, f"Videos must be {VIDEO_MAX_SECONDS} seconds or shorter.")
    p = {
        "post_id": f"pst_{uuid.uuid4().hex[:10]}",
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture"),
        "media_type": data.media_type,
        "media_url": data.media_url,
        "caption": data.caption,
        "video_duration": data.video_duration,
        "likes": [],
        "comment_count": 0,
        "status": "pending",  # admin must approve before points are awarded + post shows on Spotlight
        "created_at": iso(now_utc()),
    }
    await db.media_posts.insert_one(p)
    # Notify admins
    admins = await db.users.find({"role": "admin"}, {"user_id": 1, "_id": 0}).to_list(20)
    for a in admins:
        await push_notification(
            a["user_id"],
            "New Spotlight post pending",
            f"{user['name']} submitted a {data.media_type} for review.",
            "spotlight",
            "/admin",
        )
    p.pop("_id", None)
    return {**p, "message": "Submitted for admin review. You'll earn points once it's approved."}

@api.post("/feed/posts/{post_id}/approve")
async def approve_post(post_id: str, user: dict = Depends(require_admin)):
    p = await db.media_posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(404, "Post not found")
    if p.get("status") == "approved":
        return {"ok": True, "already": True}
    reward = POINTS_PER_VIDEO if p["media_type"] == "video" else POINTS_PER_PHOTO
    await db.media_posts.update_one({"post_id": post_id}, {"$set": {
        "status": "approved",
        "approved_at": iso(now_utc()),
        "approved_by": user["user_id"],
    }})
    await add_points(p["author_id"], reward, f"Spotlight {p['media_type']} approved", ref=f"spotlight:{post_id}")
    await push_notification(
        p["author_id"],
        "Spotlight post approved!",
        f"Your {p['media_type']} earned +{reward} point{'s' if reward != 1 else ''} (synced to rintaki.org).",
        "spotlight",
        "/feed",
    )
    return {"ok": True, "reward": reward}

@api.post("/feed/posts/{post_id}/reject")
async def reject_post(post_id: str, user: dict = Depends(require_admin)):
    p = await db.media_posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(404, "Post not found")
    await db.media_posts.update_one({"post_id": post_id}, {"$set": {"status": "rejected", "reviewed_at": iso(now_utc())}})
    await push_notification(
        p["author_id"],
        "Spotlight post not approved",
        "Your submission wasn't approved this time. Feel free to post another!",
        "spotlight",
        "/feed",
    )
    return {"ok": True}

@api.delete("/feed/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    p = await db.media_posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(404, "Post not found")
    if user.get("role") != "admin" and p.get("author_id") != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    await db.media_posts.delete_one({"post_id": post_id})
    await db.post_comments.delete_many({"post_id": post_id})
    return {"ok": True}

@api.post("/feed/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(get_current_user)):
    p = await db.media_posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(404, "Post not found")
    liked = user["user_id"] in (p.get("likes") or [])
    op = "$pull" if liked else "$addToSet"
    await db.media_posts.update_one({"post_id": post_id}, {op: {"likes": user["user_id"]}})
    return {"liked": not liked}

@api.get("/feed/posts/{post_id}/comments")
async def post_comments(post_id: str, user: dict = Depends(get_current_user)):
    items = await db.post_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"comments": items}

@api.post("/feed/posts/{post_id}/comments")
async def add_comment(post_id: str, data: CommentCreate, user: dict = Depends(get_current_user)):
    p = await db.media_posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(404, "Post not found")
    c = {
        "comment_id": f"cm_{uuid.uuid4().hex[:10]}",
        "post_id": post_id,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture"),
        "body": data.body,
        "created_at": iso(now_utc()),
    }
    await db.post_comments.insert_one(c)
    await db.media_posts.update_one({"post_id": post_id}, {"$inc": {"comment_count": 1}})
    if p["author_id"] != user["user_id"]:
        await push_notification(p["author_id"], "New comment", f"{user['name']}: {data.body[:40]}", "comment", "/feed")
    c.pop("_id", None)
    return c

# ----------------- TCG: Collections, Cards, Tracker, Forms -----------------
class TCGCollectionCreate(BaseModel):
    name: str
    description: str = ""
    cover_image: Optional[str] = None

class TCGCollectionSync(BaseModel):
    name: str
    description: str = ""
    cover_image: Optional[str] = None
    source_url: str  # WP page with gallery of card images

class TCGCardCreate(BaseModel):
    collection_id: str
    name: str
    image_url: str
    rarity: str = "Common"
    number: str = ""

class TCGClaimCreate(BaseModel):
    collection_id: str
    # rintaki.org/collection-claim form fields
    member_id: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    collection_name: Optional[str] = None
    member_notes: str = ""

class TCGTradeInCreate(BaseModel):
    # rintaki.org/trade-in form fields
    items_text: str  # multi-line item list "1. CardID, Qty, Collection"
    type_items: str = ""
    first_name: str
    last_name: str
    email: EmailStr
    member_id: Optional[str] = None
    payment_type: str = "US Dollar"  # "US Dollar" | "Anime Cash"
    payment_method: str = ""  # 3 preferred methods
    # legacy optional
    card_ids: List[str] = []
    shipping_notes: str = ""

class TCGTradeCreate(BaseModel):
    # rintaki.org/trade form fields
    items_trading: str
    items_receiving: str
    first_name: str
    last_name: str
    email: EmailStr
    member_id: Optional[str] = None
    partner_first_name: str
    partner_last_name: str
    partner_email: EmailStr
    # legacy/app-native optional
    partner_user_id: Optional[str] = None
    offered_card_ids: List[str] = []
    wanted_card_ids: List[str] = []
    notes: str = ""

@api.get("/tcg/collections")
async def tcg_collections(user: dict = Depends(get_current_user)):
    cols = await db.tcg_collections.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"collections": cols}

@api.post("/tcg/collections")
async def create_collection(data: TCGCollectionCreate, user: dict = Depends(require_admin)):
    c = {"collection_id": f"col_{uuid.uuid4().hex[:10]}", **data.model_dump(), "created_at": iso(now_utc())}
    await db.tcg_collections.insert_one(c)
    c.pop("_id", None)
    return c

def _parse_card_filename(name: str) -> dict:
    """Parse e.g. '001-rin.jpg' or '002-aiko-rare.jpg' → number, name, rarity."""
    import re
    base = name.rsplit(".", 1)[0]
    base = re.sub(r"-\d{2,4}x\d{2,4}$", "", base)  # strip WP resize suffix like -300x200
    parts = [p for p in re.split(r"[-_\s]+", base) if p]
    number = ""
    rarity = "Common"
    name_parts = []
    rarities = {"common", "rare", "legendary", "secret"}
    for p in parts:
        if p.isdigit() and not number:
            number = p
        elif p.lower() in rarities:
            rarity = p.capitalize()
        else:
            name_parts.append(p)
    display = " ".join(name_parts).title() if name_parts else base
    return {"number": number, "name": display, "rarity": rarity}


def _parse_card_caption(caption: str) -> Optional[dict]:
    """Parse a gallery figcaption like 'Set 1 – #1 – Common' or 'Set 2 - #10 - Super Rare'.

    Returns {'set_no', 'card_no', 'rarity', 'number', 'name'} or None if the caption
    doesn't match the Set/#/Rarity pattern.
      - number: combined 'S1-01' to keep cards sortable across sets
      - name:   the original caption, shown verbatim
    """
    if not caption:
        return None
    import re
    # Split on any of: em-dash, en-dash, hyphen, pipe
    parts = [p.strip() for p in re.split(r"\s*[–—\-|]\s*", caption) if p.strip()]
    if len(parts) < 2:
        return None
    set_no = ""
    card_no = ""
    rarity = ""
    for p in parts:
        m = re.match(r"set\s*(\d+)", p, re.I)
        if m:
            set_no = m.group(1)
            continue
        m = re.match(r"#\s*(\d+)", p)
        if m:
            card_no = m.group(1)
            continue
        # Anything left that isn't a set/# token is the rarity label
        if p and not rarity:
            rarity = p.strip()
    if not (set_no or card_no):
        return None
    # Sortable numeric: set*1000 + card number (so Set 1 #1..30 < Set 2 #1..30)
    try:
        sortable = f"S{int(set_no) if set_no else 0}-{int(card_no):03d}" if card_no else f"S{set_no or 0}"
    except ValueError:
        sortable = f"S{set_no or 0}-{card_no or '000'}"
    return {
        "set_no": set_no,
        "card_no": card_no,
        "rarity": rarity.title() if rarity else "Common",
        "number": sortable,
        "name": caption.strip(),
    }


def _card_meta(img: dict, fallback_index: int, existing_count: int = 0) -> dict:
    """Build a normalized card metadata dict from a scraped image.

    Priority: figcaption → Elementor lightbox title → alt text → filename parse.
    Always returns keys: name, number, rarity.
    """
    caption = (img.get("caption") or "").strip()
    parsed = _parse_card_caption(caption)
    if parsed:
        return {"name": parsed["name"], "number": parsed["number"], "rarity": parsed["rarity"]}
    alt = (img.get("alt") or "").strip()
    if alt:
        parsed_alt = _parse_card_caption(alt)
        if parsed_alt:
            return {"name": parsed_alt["name"], "number": parsed_alt["number"], "rarity": parsed_alt["rarity"]}
    lb = (img.get("lightbox_title") or "").strip()
    fm = _parse_card_filename(img.get("filename") or "")
    # Display name priority: alt → lightbox_title → filename display → "Card NNN"
    display_name = alt or lb or fm["name"] or f"Card {existing_count + fallback_index:03d}"
    return {
        "name": display_name,
        "number": fm["number"] or f"{existing_count + fallback_index:03d}",
        "rarity": fm["rarity"],
    }

async def _scrape_page_images(url: str) -> list:
    """Return list of image URLs found on a WP page (unique, in order).

    For each image, collects:
      - url:      full-size image URL (strips WP -WxH resize suffix)
      - filename: last path segment of url
      - alt:      <img alt> attribute
      - caption:  sibling/parent <figcaption> text if present (e.g. 'Set 1 – #1 – Common')
      - lightbox_title: Elementor lightbox data-elementor-lightbox-title if present
    """
    from bs4 import BeautifulSoup
    import re

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as hc:
        r = await hc.get(url, headers={"User-Agent": "Mozilla/5.0 RintakiApp/1.0"})
        if r.status_code != 200:
            raise HTTPException(400, f"Could not fetch page (HTTP {r.status_code})")
        html = r.text
    soup = BeautifulSoup(html, "lxml")
    # Prefer gallery / content area images
    seen = set()
    imgs = []
    # Look for images inside .wp-block-gallery first, fall back to all content images
    scopes = soup.select(
        ".elementor-image-gallery, .wp-block-gallery, .gallery, .entry-content, main, article"
    ) or [soup]
    for scope in scopes:
        for img in scope.find_all("img"):
            # prefer full-size: anchor href (lightbox target), data-full-url, data-src, then src
            anchor = img.find_parent("a")
            href = (anchor.get("href") if anchor else "") or ""
            src = (
                (href if re.search(r"\.(png|jpe?g|webp|gif)$", href, re.I) else "")
                or img.get("data-full-url")
                or img.get("data-src")
                or img.get("src")
                or ""
            )
            srcset = img.get("srcset") or ""
            if not src and srcset:
                # Pick the largest from srcset
                try:
                    largest = max(
                        (s.strip().rsplit(" ", 1) for s in srcset.split(",") if s.strip()),
                        key=lambda t: int(t[1].rstrip("w")) if len(t) == 2 and t[1].rstrip("w").isdigit() else 0,
                    )
                    if len(largest) >= 1:
                        src = largest[0]
                except Exception:
                    pass
            if not src:
                continue
            # Skip tiny / ui images
            if any(x in src for x in ("avatar", "gravatar", "emoji", "logo", "icon", "loading")):
                continue
            # strip WP resize suffix to get the original file URL
            src_canon = re.sub(r"-\d{2,4}x\d{2,4}(?=\.[a-zA-Z]{3,4}$)", "", src)
            if src_canon in seen:
                continue
            seen.add(src_canon)
            # Figcaption sits on the containing <figure> in WP galleries
            figure = img.find_parent("figure")
            cap_text = ""
            if figure:
                cap_el = figure.find("figcaption")
                if cap_el:
                    cap_text = cap_el.get_text(" ", strip=True)
            # Elementor lightbox title, e.g. data-elementor-lightbox-title="FC260101"
            lb_title = (anchor.get("data-elementor-lightbox-title") if anchor else "") or ""
            imgs.append({
                "url": src_canon,
                "filename": src_canon.rsplit("/", 1)[-1],
                "alt": img.get("alt", "") or "",
                "caption": cap_text,
                "lightbox_title": lb_title,
            })
    return imgs

@api.post("/tcg/collections/sync")
async def sync_collection_from_url(data: TCGCollectionSync, user: dict = Depends(require_admin)):
    imgs = await _scrape_page_images(data.source_url)
    if not imgs:
        raise HTTPException(400, "No images found at that URL")
    col_id = f"col_{uuid.uuid4().hex[:10]}"
    await db.tcg_collections.insert_one({
        "collection_id": col_id,
        "name": data.name,
        "description": data.description,
        "cover_image": data.cover_image or imgs[0]["url"],
        "source_url": data.source_url,
        "created_at": iso(now_utc()),
    })
    added = 0
    for i, img in enumerate(imgs, 1):
        meta = _card_meta(img, fallback_index=i)
        await db.tcg_cards.insert_one({
            "card_id": f"card_{uuid.uuid4().hex[:10]}",
            "collection_id": col_id,
            "name": meta["name"],
            "number": meta["number"],
            "rarity": meta["rarity"],
            "image_url": img["url"],
            "created_at": iso(now_utc()),
        })
        added += 1
    return {"collection_id": col_id, "added": added}

@api.post("/tcg/collections/{collection_id}/resync")
async def resync_collection(collection_id: str, user: dict = Depends(require_admin)):
    col = await db.tcg_collections.find_one({"collection_id": collection_id})
    if not col:
        raise HTTPException(404, "Collection not found")
    if not col.get("source_url"):
        raise HTTPException(400, "This collection has no source_url; create it via /tcg/collections/sync first.")
    imgs = await _scrape_page_images(col["source_url"])
    existing = await db.tcg_cards.find({"collection_id": collection_id}, {"_id": 0, "image_url": 1, "card_id": 1}).to_list(5000)
    existing_by_url = {c["image_url"]: c["card_id"] for c in existing}
    count_existing = len(existing)
    added = 0
    relabeled = 0
    for i, img in enumerate(imgs, 1):
        meta = _card_meta(img, fallback_index=added + 1, existing_count=count_existing)
        card_id = existing_by_url.get(img["url"])
        if card_id:
            # Update name/number/rarity in-place so existing collections pick up captions
            res = await db.tcg_cards.update_one(
                {"card_id": card_id},
                {"$set": {"name": meta["name"], "number": meta["number"], "rarity": meta["rarity"]}},
            )
            if res.modified_count:
                relabeled += 1
            continue
        await db.tcg_cards.insert_one({
            "card_id": f"card_{uuid.uuid4().hex[:10]}",
            "collection_id": collection_id,
            "name": meta["name"],
            "number": meta["number"],
            "rarity": meta["rarity"],
            "image_url": img["url"],
            "created_at": iso(now_utc()),
        })
        added += 1
    return {
        "added": added,
        "relabeled": relabeled,
        "total_found": len(imgs),
        "already_present": len(imgs) - added,
    }

@api.get("/tcg/collections/{collection_id}/cards")
async def tcg_cards(collection_id: str, user: dict = Depends(get_current_user)):
    cards = await db.tcg_cards.find({"collection_id": collection_id}, {"_id": 0}).sort("number", 1).to_list(1000)
    owned = await db.tcg_user_cards.find({"user_id": user["user_id"], "collection_id": collection_id}, {"_id": 0}).to_list(1000)
    owned_ids = {o["card_id"] for o in owned}
    return {"cards": cards, "owned_ids": list(owned_ids)}

@api.post("/tcg/cards")
async def create_card(data: TCGCardCreate, user: dict = Depends(require_admin)):
    c = {"card_id": f"card_{uuid.uuid4().hex[:10]}", **data.model_dump(), "created_at": iso(now_utc())}
    await db.tcg_cards.insert_one(c)
    c.pop("_id", None)
    return c

@api.post("/tcg/toggle-card/{card_id}")
async def toggle_card(card_id: str, user: dict = Depends(get_current_user)):
    card = await db.tcg_cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Card not found")
    existing = await db.tcg_user_cards.find_one({"user_id": user["user_id"], "card_id": card_id})
    if existing:
        await db.tcg_user_cards.delete_one({"user_id": user["user_id"], "card_id": card_id})
        return {"owned": False}
    await db.tcg_user_cards.insert_one({
        "user_id": user["user_id"],
        "card_id": card_id,
        "collection_id": card["collection_id"],
        "added_at": iso(now_utc()),
    })
    return {"owned": True}

@api.delete("/tcg/cards/{card_id}")
async def delete_card(card_id: str, user: dict = Depends(require_admin)):
    """Admin: delete a single card and all user ownership records for it."""
    card = await db.tcg_cards.find_one({"card_id": card_id})
    if not card:
        raise HTTPException(404, "Card not found")
    await db.tcg_cards.delete_one({"card_id": card_id})
    await db.tcg_user_cards.delete_many({"card_id": card_id})
    return {"ok": True}

@api.delete("/tcg/collections/{collection_id}")
async def delete_collection(collection_id: str, user: dict = Depends(require_admin)):
    """Admin: delete a collection, all its cards, and all user ownership records for them."""
    col = await db.tcg_collections.find_one({"collection_id": collection_id})
    if not col:
        raise HTTPException(404, "Collection not found")
    # Get card IDs so we can clean up ownership
    cards = await db.tcg_cards.find({"collection_id": collection_id}, {"card_id": 1, "_id": 0}).to_list(10000)
    card_ids = [c["card_id"] for c in cards]
    await db.tcg_cards.delete_many({"collection_id": collection_id})
    if card_ids:
        await db.tcg_user_cards.delete_many({"card_id": {"$in": card_ids}})
    await db.tcg_user_cards.delete_many({"collection_id": collection_id})
    await db.tcg_collections.delete_one({"collection_id": collection_id})
    return {"ok": True, "cards_deleted": len(card_ids)}


@api.get("/tcg/my-collection")
async def my_collection(user: dict = Depends(get_current_user)):
    owned = await db.tcg_user_cards.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(5000)
    # enrich with card data
    card_ids = [o["card_id"] for o in owned]
    cards = []
    if card_ids:
        cards = await db.tcg_cards.find({"card_id": {"$in": card_ids}}, {"_id": 0}).to_list(5000)
    return {"cards": cards}

@api.post("/tcg/claim")
async def tcg_claim(data: TCGClaimCreate, user: dict = Depends(get_current_user)):
    total = await db.tcg_cards.count_documents({"collection_id": data.collection_id})
    owned = await db.tcg_user_cards.count_documents({"user_id": user["user_id"], "collection_id": data.collection_id})
    payload = data.model_dump()
    claim = {
        "claim_id": f"clm_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "user_name": user["name"],
        "owned_count": owned,
        "total_count": total,
        "status": "pending",
        "created_at": iso(now_utc()),
        **payload,
    }
    await db.tcg_claims.insert_one(claim)
    claim.pop("_id", None)
    return claim

@api.get("/tcg/claims")
async def list_claims(user: dict = Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"user_id": user["user_id"]}
    items = await db.tcg_claims.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"claims": items}

@api.post("/tcg/claims/{claim_id}/approve")
async def approve_claim(claim_id: str, user: dict = Depends(require_admin)):
    claim = await db.tcg_claims.find_one({"claim_id": claim_id})
    if not claim:
        raise HTTPException(404, "Claim not found")
    if claim.get("status") == "approved":
        return {"ok": True, "already": True}
    await db.tcg_claims.update_one({"claim_id": claim_id}, {"$set": {"status": "approved", "approved_at": iso(now_utc())}})
    # Award 50 points + 100 anime_cash for completing a theme set
    await add_points(claim["user_id"], 50, "Theme set completion award", ref=f"theme_set:{claim_id}")
    await add_anime_cash(claim["user_id"], 100, "Theme set completion cash", ref=f"theme_set_cash:{claim_id}")
    await push_notification(claim["user_id"], "Award approved!", "You earned 50 pts + 100 Anime Cash for your theme set.", "tcg", "/tcg/claims")
    return {"ok": True}

@api.post("/tcg/tradein")
async def tcg_tradein(data: TCGTradeInCreate, user: dict = Depends(get_current_user)):
    t = {
        "tradein_id": f"ti_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "user_name": user["name"],
        **data.model_dump(),
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.tcg_tradeins.insert_one(t)
    t.pop("_id", None)
    return t

@api.get("/tcg/tradeins")
async def list_tradeins(user: dict = Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"user_id": user["user_id"]}
    items = await db.tcg_tradeins.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"tradeins": items}

@api.post("/tcg/trade")
async def tcg_trade(data: TCGTradeCreate, user: dict = Depends(get_current_user)):
    partner_name = f"{data.partner_first_name} {data.partner_last_name}".strip()
    partner_user_id = data.partner_user_id
    if partner_user_id:
        partner = await db.users.find_one({"user_id": partner_user_id})
        if partner:
            partner_name = partner.get("name", partner_name)
    t = {
        "trade_id": f"td_{uuid.uuid4().hex[:10]}",
        "from_user_id": user["user_id"],
        "from_name": user["name"],
        "to_user_id": partner_user_id,
        "to_name": partner_name,
        **data.model_dump(),
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.tcg_trades.insert_one(t)
    if partner_user_id:
        await push_notification(partner_user_id, "Trade request", f"{user['name']} wants to trade cards with you.", "tcg", "/tcg/trade")
    t.pop("_id", None)
    return t

@api.get("/tcg/trades")
async def list_trades(user: dict = Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"$or": [{"from_user_id": user["user_id"]}, {"to_user_id": user["user_id"]}]}
    items = await db.tcg_trades.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"trades": items}

# ----------------- Member Dashboard: Trips, Giveaways, Contests, Articles -----------------
class TripCreate(BaseModel):
    title: str
    description: str
    destination: str
    starts_at: str
    price: float = 0.0
    cover_image: Optional[str] = None
    signup_link: Optional[str] = None

@api.get("/trips")
async def list_trips(user: dict = Depends(get_current_user)):
    items = await db.trips.find({}, {"_id": 0}).sort("starts_at", 1).to_list(100)
    return {"trips": items}

@api.post("/trips")
async def create_trip(data: TripCreate, user: dict = Depends(require_admin)):
    t = {"trip_id": f"tr_{uuid.uuid4().hex[:10]}", **data.model_dump(), "created_at": iso(now_utc())}
    await db.trips.insert_one(t)
    t.pop("_id", None)
    return t

class GiveawayCreate(BaseModel):
    title: str
    description: str
    prize_type: str = "anime_item"  # or "gift_card"
    ends_at: str
    cover_image: Optional[str] = None

@api.get("/giveaways")
async def list_giveaways(user: dict = Depends(get_current_user)):
    items = await db.giveaways.find({}, {"_id": 0}).sort("ends_at", 1).to_list(50)
    for g in items:
        g["entered"] = user["user_id"] in (g.get("entries") or [])
        g["entry_count"] = len(g.get("entries") or [])
        g.pop("entries", None)
    return {"giveaways": items}

@api.post("/giveaways")
async def create_giveaway(data: GiveawayCreate, user: dict = Depends(require_admin)):
    g = {"giveaway_id": f"gv_{uuid.uuid4().hex[:10]}", **data.model_dump(), "entries": [], "created_at": iso(now_utc())}
    await db.giveaways.insert_one(g)
    g.pop("_id", None)
    g["entered"] = False
    g["entry_count"] = 0
    g.pop("entries", None)
    return g

@api.post("/giveaways/{giveaway_id}/enter")
async def enter_giveaway(giveaway_id: str, user: dict = Depends(get_current_user)):
    g = await db.giveaways.find_one({"giveaway_id": giveaway_id})
    if not g:
        raise HTTPException(404, "Giveaway not found")
    if user["user_id"] in (g.get("entries") or []):
        return {"entered": True}
    await db.giveaways.update_one({"giveaway_id": giveaway_id}, {"$addToSet": {"entries": user["user_id"]}})
    return {"entered": True}

class ContestCreate(BaseModel):
    title: str
    description: str
    rules: str = ""
    ends_at: str
    cover_image: Optional[str] = None
    prize: str = ""

@api.get("/contests")
async def list_contests(user: dict = Depends(get_current_user)):
    items = await db.contests.find({}, {"_id": 0}).sort("ends_at", 1).to_list(50)
    return {"contests": items}

@api.post("/contests")
async def create_contest(data: ContestCreate, user: dict = Depends(require_admin)):
    c = {"contest_id": f"ct_{uuid.uuid4().hex[:10]}", **data.model_dump(), "created_at": iso(now_utc())}
    await db.contests.insert_one(c)
    c.pop("_id", None)
    return c

class ArticleSubmissionCreate(BaseModel):
    name: str = ""
    email: str = ""
    member_id: str = ""
    content: str = ""
    # Optional file: {filename, mime, data_b64, size}
    file_name: Optional[str] = None
    file_mime: Optional[str] = None
    file_data_b64: Optional[str] = None
    file_size: Optional[int] = None
    # Legacy: kept for existing submissions (points reward still uses this)
    kind: str = "blog"  # "blog" or "magazine"
    title: str = ""
    summary: str = ""

@api.get("/articles")
async def list_articles(user: dict = Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"user_id": user["user_id"]}
    # Strip base64 file payload from list responses; /articles/{id}/file streams it separately
    items = await db.article_submissions.find(q, {"_id": 0, "file_data_b64": 0}).sort("created_at", -1).to_list(200)
    return {"articles": items}

@api.post("/articles")
async def create_article(data: ArticleSubmissionCreate, user: dict = Depends(require_member)):
    # Require at least one of content or file
    if not (data.content or "").strip() and not data.file_data_b64:
        raise HTTPException(400, "Please provide either written content or an uploaded file.")
    # File size guard (10 MB after base64 decode ~ 13.3 MB encoded)
    if data.file_data_b64 and len(data.file_data_b64) > 14_000_000:
        raise HTTPException(413, "File too large. Max 10 MB.")
    if not (data.email or "").strip():
        # default to user's account email
        data.email = user.get("email", "")
    payload = data.model_dump()
    # Auto-title from first 60 chars of content or filename
    if not payload.get("title"):
        if payload.get("content"):
            payload["title"] = payload["content"][:60].strip() + ("…" if len(payload["content"]) > 60 else "")
        elif payload.get("file_name"):
            payload["title"] = payload["file_name"]
        else:
            payload["title"] = "Untitled submission"
    a = {
        "article_id": f"ar_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "user_name": user["name"],
        **payload,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.article_submissions.insert_one(a)
    # Return a copy without _id and without the raw base64 (reduces payload size)
    a.pop("_id", None)
    a.pop("file_data_b64", None)
    return a

@api.get("/articles/{article_id}/file")
async def download_article_file(article_id: str, user: dict = Depends(get_current_user)):
    a = await db.article_submissions.find_one({"article_id": article_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Not found")
    # Only admin or the author
    if user.get("role") != "admin" and a.get("user_id") != user["user_id"]:
        raise HTTPException(403, "Forbidden")
    if not a.get("file_data_b64"):
        raise HTTPException(404, "No file attached")
    import base64 as _b64
    data = _b64.b64decode(a["file_data_b64"])
    from fastapi.responses import Response
    return Response(
        content=data,
        media_type=a.get("file_mime") or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{a.get("file_name") or article_id}"'},
    )

@api.post("/articles/{article_id}/approve")
async def approve_article(article_id: str, user: dict = Depends(require_admin)):
    a = await db.article_submissions.find_one({"article_id": article_id})
    if not a:
        raise HTTPException(404, "Not found")
    if a.get("status") == "approved":
        return {"ok": True, "already": True}
    reward = 25 if a["kind"] == "blog" else 50
    await db.article_submissions.update_one({"article_id": article_id}, {"$set": {"status": "approved", "approved_at": iso(now_utc())}})
    await add_points(a["user_id"], reward, f"Approved {a['kind']} article", ref=f"article:{article_id}")
    await push_notification(a["user_id"], "Article approved!", f"Your submission '{a['title']}' earned {reward} points.", "article", "/dashboard/submit-article")
    return {"ok": True}

# ----------------- Extended Profile -----------------
class ExtendedProfile(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    city: Optional[str] = None
    favorite_anime: Optional[str] = None
    favorite_manga: Optional[str] = None
    cosplay_interest: Optional[str] = None
    how_you_found_us: Optional[str] = None
    notes: Optional[str] = None

@api.get("/profile/extended")
async def get_extended(user: dict = Depends(get_current_user)):
    doc = await db.extended_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {"user_id": user["user_id"]}
    return doc

@api.put("/profile/extended")
async def put_extended(data: ExtendedProfile, user: dict = Depends(get_current_user)):
    payload = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    payload["user_id"] = user["user_id"]
    payload["updated_at"] = iso(now_utc())
    await db.extended_profiles.update_one({"user_id": user["user_id"]}, {"$set": payload}, upsert=True)
    return payload

# ----------------- Events with Tickets (Stripe) -----------------
class EventTicketEventUpdate(BaseModel):
    ticket_price: Optional[float] = None
    ticket_enabled: bool = False

@api.patch("/events/{event_id}")
async def update_event(event_id: str, data: EventTicketEventUpdate, user: dict = Depends(require_admin)):
    await db.events.update_one({"event_id": event_id}, {"$set": data.model_dump(exclude_none=True)})
    ev = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return ev

class TicketCheckoutIn(BaseModel):
    event_id: str
    quantity: int = 1
    origin_url: str  # window.location.origin

@api.post("/payments/tickets/checkout")
async def ticket_checkout(data: TicketCheckoutIn, request: Request, user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    ev = await db.events.find_one({"event_id": data.event_id})
    if not ev:
        raise HTTPException(404, "Event not found")
    if not ev.get("ticket_enabled") or not ev.get("ticket_price"):
        raise HTTPException(400, "Tickets not available for this event")
    qty = max(1, min(10, int(data.quantity)))
    amount = float(ev["ticket_price"]) * qty
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    success_url = f"{data.origin_url}/tickets/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/events"
    metadata = {
        "user_id": user["user_id"],
        "event_id": ev["event_id"],
        "quantity": str(qty),
        "kind": "event_ticket",
    }
    req = CheckoutSessionRequest(amount=amount, currency="usd", success_url=success_url, cancel_url=cancel_url, metadata=metadata)
    session = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "event_id": ev["event_id"],
        "amount": amount,
        "currency": "usd",
        "quantity": qty,
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "open",
        "created_at": iso(now_utc()),
    })
    return {"url": session.url, "session_id": session.session_id}

@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=f"{host_url}/api/webhook/stripe")
    status = await stripe_checkout.get_checkout_status(session_id)

    # Idempotent ticket creation
    if status.payment_status == "paid" and tx.get("payment_status") != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": status.status, "paid_at": iso(now_utc())}},
        )
        qty = int(tx.get("quantity", 1))
        for _ in range(qty):
            await db.tickets.insert_one({
                "ticket_id": f"tk_{uuid.uuid4().hex[:10]}",
                "user_id": tx["user_id"],
                "event_id": tx["event_id"],
                "session_id": session_id,
                "created_at": iso(now_utc()),
            })
        await push_notification(tx["user_id"], "Ticket confirmed!", f"You have {qty} ticket(s). See My Tickets.", "ticket", "/tickets")
    elif status.payment_status != tx.get("payment_status"):
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status}},
        )
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=f"{host_url}/api/webhook/stripe")
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        logger.warning(f"stripe webhook error: {e}")
        return {"ok": False}
    # Mirror the logic: flip to paid and grant ticket once
    if webhook_response and webhook_response.session_id:
        tx = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
        if tx and webhook_response.payment_status == "paid" and tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "status": "complete", "paid_at": iso(now_utc())}},
            )
            qty = int(tx.get("quantity", 1))
            for _ in range(qty):
                await db.tickets.insert_one({
                    "ticket_id": f"tk_{uuid.uuid4().hex[:10]}",
                    "user_id": tx["user_id"],
                    "event_id": tx["event_id"],
                    "session_id": webhook_response.session_id,
                    "created_at": iso(now_utc()),
                })
    return {"ok": True}

@api.get("/tickets")
async def my_tickets(user: dict = Depends(get_current_user)):
    items = await db.tickets.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich with event info
    ev_ids = list({t["event_id"] for t in items})
    events = {}
    if ev_ids:
        async for ev in db.events.find({"event_id": {"$in": ev_ids}}, {"_id": 0}):
            events[ev["event_id"]] = ev
    for t in items:
        t["event"] = events.get(t["event_id"])
    return {"tickets": items}

# ----------------- Wire up -----------------
app.include_router(api)

# Serve Spotlight uploads (images & videos) behind /api/uploads so the
# k8s ingress routes them to backend:8001 like any other /api/* path.
app.mount("/api/uploads/spotlight", StaticFiles(directory=str(UPLOADS_DIR)), name="spotlight-uploads")

# Serve point-claim proof photos (images only, admin + member can see).
CLAIMS_DIR_STATIC = Path("/app/backend/uploads/claims")
CLAIMS_DIR_STATIC.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/claims", StaticFiles(directory=str(CLAIMS_DIR_STATIC)), name="claim-uploads")

# Serve the WP plugin zip so the admin can download + install it on rintaki.org
PLUGIN_DIR = Path("/app/backend/uploads/plugin")
PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/plugin", StaticFiles(directory=str(PLUGIN_DIR)), name="plugin-zip")

_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[_frontend_url, "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
