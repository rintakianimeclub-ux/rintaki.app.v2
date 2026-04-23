import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, Sticker } from "@/components/ui-brutal";
import { Camera, PencilSimple, ArrowSquareOut, Trophy, CurrencyCircleDollar, Check, X } from "@phosphor-icons/react";

function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-3 py-2 border-b border-black/10 last:border-0">
      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] flex-shrink-0">{label}</div>
      <div className="text-sm font-bold text-right break-words min-w-0">{value}</div>
    </div>
  );
}

export default function Profile() {
  const { userId } = useParams();
  const { user: me, refresh } = useAuth();
  const isSelf = !userId || userId === me?.user_id;

  const [profile, setProfile] = useState(null);
  const [wp, setWp] = useState(null);
  const [wpLoading, setWpLoading] = useState(true);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "" });
  const [saving, setSaving] = useState(false);

  // Image uploads
  const [uploading, setUploading] = useState("");
  const bannerInput = useRef(null);
  const avatarInput = useRef(null);

  const loadProfile = async () => {
    if (isSelf && me) {
      setProfile(me);
      setForm({ name: me.name || "", bio: me.bio || "" });
    } else if (userId) {
      const { data } = await api.get(`/users/${userId}`);
      setProfile(data);
    }
  };

  useEffect(() => { loadProfile(); /* eslint-disable-next-line */ }, [userId, me?.user_id]);

  useEffect(() => {
    if (!isSelf) { setWpLoading(false); return; }
    api.get("/profile/wordpress")
      .then(({ data }) => setWp(data))
      .catch(() => setWp(null))
      .finally(() => setWpLoading(false));
  }, [isSelf]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/profile", form);
      await refresh();
      await loadProfile();
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const onImage = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Max 10 MB."); return; }
    setUploading(field);
    try {
      const b64 = await fileToB64(file);
      await api.post("/profile/upload-image", { field, file_name: file.name, mime: file.type, data_b64: b64 });
      await refresh();
      await loadProfile();
    } catch (err) {
      alert(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading("");
    }
  };

  if (!profile) return <div className="text-sm text-[var(--muted-fg)]">Loading…</div>;

  const banner = profile.banner_image;
  const fullName = wp?.first_name || wp?.last_name
    ? `${wp.first_name || ""} ${wp.last_name || ""}`.trim()
    : profile.name;
  const address = wp && [wp.address1, wp.address2, wp.city, wp.state, wp.zip, wp.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      {/* Banner + avatar */}
      <div className="relative" data-testid="profile-header">
        <div className="relative aspect-[16/8] bg-gradient-to-br from-[var(--accent)] to-[var(--purple)] border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0_#111]">
          {banner && <img src={banner} alt="" className="w-full h-full object-cover" />}
          {isSelf && (
            <>
              <input ref={bannerInput} type="file" accept="image/*" className="hidden"
                     onChange={(e) => onImage(e, "banner_image")} data-testid="banner-input" />
              <button onClick={() => bannerInput.current?.click()} disabled={uploading === "banner_image"}
                      data-testid="change-banner-btn"
                      className="absolute top-2 right-2 bg-white border-2 border-black rounded-full px-3 py-1.5 shadow-[2px_2px_0_#111] flex items-center gap-1 text-xs font-black uppercase tracking-widest">
                <Camera size={12} weight="bold" /> {uploading === "banner_image" ? "…" : "Banner"}
              </button>
            </>
          )}
        </div>
        {/* Avatar */}
        <div className="absolute -bottom-6 left-4">
          <div className="w-24 h-24 rounded-full border-2 border-black overflow-hidden bg-white shadow-[4px_4px_0_#111]">
            {profile.picture ? (
              <img src={profile.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[var(--primary)] text-white flex items-center justify-center font-black text-3xl">
                {fullName?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          {isSelf && (
            <>
              <input ref={avatarInput} type="file" accept="image/*" className="hidden"
                     onChange={(e) => onImage(e, "picture")} data-testid="avatar-input" />
              <button onClick={() => avatarInput.current?.click()} disabled={uploading === "picture"}
                      data-testid="change-avatar-btn"
                      className="absolute -bottom-1 -right-1 w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0_#111]"
                      aria-label="Change avatar">
                <Camera size={13} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="pt-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-black text-2xl leading-tight">{fullName || profile.name}</h1>
          {isSelf && (
            <button onClick={() => setEditOpen(true)} data-testid="edit-profile-btn"
                    className="flex items-center gap-1 border-2 border-black rounded-full px-3 py-1.5 bg-white shadow-[2px_2px_0_#111] text-xs font-black uppercase tracking-widest">
              <PencilSimple size={12} weight="bold" /> Edit
            </button>
          )}
        </div>
        <div className="text-xs text-[var(--muted-fg)] font-bold">{profile.email}</div>
        {profile.membership_name && (
          <Sticker color="primary" className="mt-1 inline-block">{profile.membership_name}</Sticker>
        )}
        {profile.bio && <p className="text-sm mt-2">{profile.bio}</p>}
      </div>

      {/* Points / cash quick stats (member only) */}
      {(profile.is_member || profile.role === "admin") && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center gap-2">
            <Trophy size={20} weight="fill" className="text-[var(--primary)]" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Points</div>
              <div className="font-black text-xl">{profile.points ?? 0}</div>
            </div>
          </Card>
          <Card className="flex items-center gap-2">
            <CurrencyCircleDollar size={20} weight="fill" className="text-[var(--primary)]" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Anime Cash</div>
              <div className="font-black text-xl">${profile.anime_cash ?? 0}</div>
            </div>
          </Card>
        </div>
      )}

      {/* WordPress-linked fields (self only) */}
      {isSelf && (
        <Card data-testid="wp-linked-card">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-lg">Account details</h2>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">From rintaki.org</div>
          </div>
          {wpLoading ? (
            <div className="text-xs text-[var(--muted-fg)] mt-2">Loading your rintaki.org profile…</div>
          ) : wp?.plugin_outdated ? (
            <div className="text-xs bg-[var(--secondary)] border-2 border-black rounded-lg p-3 mt-2" data-testid="plugin-warning">
              ⚙️ <b>Admin note:</b> install plugin v1.2.0 (<code>/app/wp-plugin/rintaki-app-sync.php</code>) on rintaki.org to sync full profile fields.
            </div>
          ) : wp?.found ? (
            <>
              <div className="mt-2">
                <Row label="Username" value={wp.username} />
                <Row label="First name" value={wp.first_name} />
                <Row label="Last name" value={wp.last_name} />
                <Row label="Phone" value={wp.phone} />
                <Row label="Address" value={address} />
                <Row label="Membership" value={wp.membership_name} />
                <Row label="Member since" value={wp.registered ? new Date(wp.registered).toLocaleDateString() : ""} />
              </div>
              <a href="https://rintaki.org/membership-account/" target="_blank" rel="noreferrer" className="block mt-3" data-testid="edit-wp-link">
                <Button variant="dark" className="w-full">
                  Edit on rintaki.org <ArrowSquareOut size={12} weight="bold" />
                </Button>
              </a>
            </>
          ) : (
            <div className="text-xs text-[var(--muted-fg)] mt-2">
              No linked WordPress profile found for <b>{profile.email}</b>. Sign up on{" "}
              <a href="https://rintaki.org" target="_blank" rel="noreferrer" className="underline font-bold">rintaki.org</a>{" "}
              using the same email to link automatically.
            </div>
          )}
        </Card>
      )}

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setEditOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveProfile}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="edit-profile-form">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-xl">Edit profile</h2>
              <button type="button" onClick={() => setEditOpen(false)}
                      className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center">
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest">Display name</label>
                <Input required value={form.name} data-testid="edit-name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest">Bio</label>
                <Textarea rows={4} value={form.bio} data-testid="edit-bio" onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <p className="text-[10px] text-[var(--muted-fg)] font-bold">
                First / last name, address, phone and membership level are synced from rintaki.org — edit them there to update here.
              </p>
            </div>
            <Button type="submit" disabled={saving} className="w-full mt-3" data-testid="edit-save">
              {saving ? "Saving…" : <><Check size={14} weight="bold" /> Save</>}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
