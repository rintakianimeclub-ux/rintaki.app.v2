import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, Sticker } from "@/components/ui-brutal";
import { ArrowLeft, ArrowSquareOut, UserCircle } from "@phosphor-icons/react";

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-3 py-2 border-b border-black/10 last:border-0">
      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] flex-shrink-0">{label}</div>
      <div className="text-sm font-bold text-right break-words">{value}</div>
    </div>
  );
}

export default function DashboardProfile() {
  const { user } = useAuth();
  const [wp, setWp] = useState(null);
  const [wpLoading, setWpLoading] = useState(true);

  const [extForm, setExtForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/profile/wordpress")
      .then(({ data }) => setWp(data))
      .catch(() => setWp({ found: false }))
      .finally(() => setWpLoading(false));
    api.get("/profile/extended").then(({ data }) => setExtForm(data || {})).catch(() => {});
  }, []);

  const saveExt = async (e) => {
    e.preventDefault();
    await api.put("/profile/extended", extForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const f = (k) => ({
    value: extForm[k] || "",
    onChange: (e) => setExtForm({ ...extForm, [k]: e.target.value }),
  });

  const fullAddress = wp && [wp.address1, wp.address2, wp.city, wp.state, wp.zip, wp.country].filter(Boolean).join(", ");
  const displayName = wp?.first_name || wp?.last_name
    ? `${wp.first_name || ""} ${wp.last_name || ""}`.trim()
    : wp?.display_name || user?.name;

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>

      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><UserCircle size={26} weight="fill" className="text-[var(--primary)]" /> Profile</h1>
        <p className="text-[var(--muted-fg)] text-sm">Your rintaki.org account info.</p>
      </div>

      {/* WordPress / PMPro profile info */}
      <Card className="p-0 overflow-hidden" data-testid="wp-profile-card">
        <div className="bg-[var(--primary)] text-white p-4">
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-14 h-14 rounded-full border-2 border-black object-cover" />
            ) : (
              <div className="w-14 h-14 bg-white text-black border-2 border-black rounded-full flex items-center justify-center font-black text-xl">
                {displayName?.[0]?.toUpperCase() || "R"}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-black text-xl leading-tight truncate">{displayName}</div>
              <div className="text-[11px] opacity-90 truncate">{wp?.email || user?.email}</div>
              {wp?.membership_name && (
                <Sticker color="secondary" className="mt-1 inline-block">
                  {wp.membership_name}
                </Sticker>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          {wpLoading ? (
            <div className="text-xs text-[var(--muted-fg)]">Loading your WordPress profile…</div>
          ) : wp?.plugin_outdated ? (
            <div className="text-xs bg-[var(--secondary)] border-2 border-black rounded-lg p-3" data-testid="plugin-warning">
              ⚙️ <strong>Admin:</strong> Your rintaki.org sync plugin needs to be updated to v1.2.0 to show member profile info here. Grab the latest copy at <code>/app/wp-plugin/rintaki-app-sync.php</code>.
            </div>
          ) : wp?.found ? (
            <>
              <Row label="Username" value={wp.username} />
              <Row label="First name" value={wp.first_name} />
              <Row label="Last name" value={wp.last_name} />
              <Row label="Phone" value={wp.phone} />
              <Row label="Address" value={fullAddress} />
              <Row label="Member since" value={wp.registered ? new Date(wp.registered).toLocaleDateString() : ""} />
              <a href="https://rintaki.org/membership-account/" target="_blank" rel="noreferrer" className="block mt-3" data-testid="edit-wp-profile">
                <Button className="w-full" variant="dark">
                  Edit on rintaki.org <ArrowSquareOut size={12} weight="bold" />
                </Button>
              </a>
              <p className="text-[10px] text-[var(--muted-fg)] font-bold uppercase tracking-widest text-center mt-2">
                Info pulled from your WordPress / PMPro checkout
              </p>
            </>
          ) : (
            <div className="text-xs text-[var(--muted-fg)]">
              We couldn't fetch your WordPress profile right now. Try again later or edit directly on <a href="https://rintaki.org/membership-account/" target="_blank" rel="noreferrer" className="underline font-bold">rintaki.org</a>.
            </div>
          )}
        </div>
      </Card>

      {/* Extended app-only profile (favorite anime, cosplay, etc.) */}
      <div>
        <h2 className="font-black text-xl mb-2">Otaku details</h2>
        <p className="text-[var(--muted-fg)] text-xs mb-3">Help us personalize the club experience. Only admins can see this.</p>
        <form onSubmit={saveExt} className="space-y-3" data-testid="ext-profile-form">
          <Input placeholder="Favorite anime" data-testid="ext-anime" {...f("favorite_anime")} />
          <Input placeholder="Favorite manga" data-testid="ext-manga" {...f("favorite_manga")} />
          <Input placeholder="Cosplay interest? (series / characters)" data-testid="ext-cosplay" {...f("cosplay_interest")} />
          <Input placeholder="Birthday" type="date" data-testid="ext-birthday" {...f("birthday")} />
          <Input placeholder="How did you find us?" data-testid="ext-found" {...f("how_you_found_us")} />
          <Textarea rows={3} placeholder="Anything else?" data-testid="ext-notes" {...f("notes")} />
          <Button type="submit" className="w-full" data-testid="ext-save">
            {saved ? "Saved!" : "Save otaku details"}
          </Button>
        </form>
      </div>
    </div>
  );
}
