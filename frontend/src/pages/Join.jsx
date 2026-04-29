import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Sticker } from "@/components/ui-brutal";
import { Check, SignIn, Sparkle, ArrowSquareOut, ArrowsClockwise } from "@phosphor-icons/react";

const TIER_COLORS = {
  free:    "bg-white",
  regular: "bg-[var(--secondary)]",
  premium: "bg-[var(--accent)]",
};

export default function Join() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [meta, setMeta] = useState({ source: "", cached_at: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    setRefreshing(refresh);
    const { data } = await api.get("https://rintaki.org/membership-account/membership-levels/", { params: refresh ? { refresh: 1 } : {} }).catch(() => ({ data: { levels: [] } }));
    setLevels(data.levels || []);
    setMeta({ source: data.source || "", cached_at: data.cached_at || 0 });
    setLoading(false);
    setRefreshing(false);
  };
  useEffect(() => { load(false); }, []);

  const lastUpdated = meta.cached_at ? new Date(meta.cached_at * 1000).toLocaleString() : "";
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-5">
      <div>
        <Sticker color="primary" className="tilt-1">★ Join the club</Sticker>
        <h1 className="font-black text-3xl mt-2">Become a member</h1>
        <p className="text-[var(--muted-fg)] text-sm mt-1">
          Browse the app for free — become a member to earn points, unlock the members dashboard,
          post in the forum, and claim monthly perks.
        </p>
      </div>

      {/* Sign-in link for existing members */}
      {!user && (
        <Link to="/login" data-testid="join-signin-link">
          <Card className="bg-black text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--secondary)] text-black border-2 border-black rounded-full flex items-center justify-center">
              <SignIn size={18} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="font-black">Already a member?</div>
              <div className="text-xs opacity-80">Sign in with your email or Google</div>
            </div>
          </Card>
        </Link>
      )}

      {user && !user.is_member && user.role !== "admin" && (
        <Card className="bg-[var(--secondary)]">
          <div className="flex items-center gap-2 font-black">
            <Sparkle size={18} weight="fill" /> Logged in as {user.name?.split(" ")[0]}
          </div>
          <p className="text-xs mt-1 font-bold">
            Pick a membership below and complete checkout on rintaki.org to unlock points & the members dashboard.
          </p>
        </Card>
      )}

      {/* Levels */}
      {loading ? (
        <div className="text-sm text-[var(--muted-fg)]">Loading membership levels…</div>
      ) : (
        <div className="space-y-3">
          {levels.map((lvl) => (
            <Card key={lvl.level} className={`${TIER_COLORS[lvl.tier] || "bg-white"} p-0 overflow-hidden`} data-testid={`level-${lvl.level}`}>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div>
                    <Sticker color="primary">Level {lvl.level}</Sticker>
                    <h2 className="font-black text-2xl mt-1 leading-tight">{lvl.name}</h2>
                    {lvl.subtitle && (
                      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] mt-0.5">
                        {lvl.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-3xl leading-none">{lvl.price}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">
                      /{lvl.interval}
                    </div>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {lvl.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check size={14} weight="bold" className="mt-0.5 flex-shrink-0 text-[var(--primary)]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <a href={lvl.checkout_url} target="_blank" rel="noreferrer" data-testid={`join-level-${lvl.level}-btn`}>
                  <Button className="w-full mt-4">
                    Join {lvl.name} <ArrowSquareOut size={14} weight="bold" />
                  </Button>
                </a>
                <p className="text-[10px] text-[var(--muted-fg)] font-bold uppercase tracking-widest text-center mt-2">
                  Checkout on rintaki.org
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="text-center">
        <p className="text-xs text-[var(--muted-fg)]">
          Non-members can browse events, galleries, cards, magazines & the library for free.
          Only members earn points and access the members dashboard.
        </p>
        {lastUpdated && (
          <p className="text-[10px] text-[var(--muted-fg)] font-bold uppercase tracking-widest mt-2">
            Synced from rintaki.org · {lastUpdated}
          </p>
        )}
        {isAdmin && (
          <button onClick={() => load(true)} disabled={refreshing} data-testid="refresh-levels-btn"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest underline decoration-[var(--primary)] decoration-2 underline-offset-4 disabled:opacity-50">
            <ArrowsClockwise size={12} weight="bold" /> {refreshing ? "Refreshing…" : "Force refresh"}
          </button>
        )}
      </Card>
    </div>
  );
}
