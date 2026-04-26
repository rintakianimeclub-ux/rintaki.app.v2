# Rintaki App — Test Credentials

## Primary admin (real account)
- **Email:** `rintakianimeclub@gmail.com`
- **Password:** `Admin@Rintaki2026`
- **Role:** `admin`
- **Display name:** Rin Sanada (synced from Google)
- **Login methods:** either **Continue with Google** (same Gmail) OR email + password

> This account is also synced with your Google login, so you can use either flow.
> After you deploy, change the password from a trusted device (we'll add a "change password" UI when you ask for it).

## Seeded dev admin (demoted — kept for rollback safety only)
- Email: `admin@rintaki.org` / Password `Admin@Rintaki2026`
- Role: `member` (no longer has admin powers)

## Auth flows
- JWT (email/password) — `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Emergent Google OAuth — `/api/auth/google/session` (sets `session_token` cookie)

Both flows share the same `users` collection keyed by `email` (lowercased).
`get_current_user` checks `session_token` cookie first, then `access_token` JWT, then `Authorization: Bearer`.

## How to change the admin email later
1. Edit `/app/backend/.env` → `ADMIN_EMAIL="..."` and `ADMIN_PASSWORD="..."`
2. Restart backend: `sudo supervisorctl restart backend`
3. On boot, the server:
   - Creates that user if missing (with the env password)
   - Ensures role=admin on every startup
   - Resets password if it doesn't match the env value
4. Old admins with default seed name are demoted to `member` automatically.

## MongoDB quick checks
```bash
mongosh rintaki_db
db.users.find({role:"admin"}, {email:1, name:1, _id:0})
```
