import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, EmptyState } from "@/components/ui-brutal";
import {
  ArrowLeft, Trophy, CurrencyCircleDollar, ArrowSquareOut, BookOpen,
  Hand, ChatCircle, Camera, PencilSimple, CheckCircle, Star, Crown,
  Sparkle, Target, Coin, ArrowUp, ArrowDown, MagnifyingGlass,
} from "@phosphor-icons/react";

// Map ref-bucket → icon + colour. One place to tweak the whole history feed.
const SOURCE_STYLES = {
  visit:           { icon: Hand,          label: "Daily visit",          bg: "bg-[var(--accent)]" },
  daily_login:     { icon: Sparkle,       label: "Daily bonus",          bg: "bg-[var(--secondary)]" },
  forum_reply:     { icon: ChatCircle,    label: "Forum reply",          bg: "bg-[var(--accent)]" },
  spotlight:       { icon: Camera,        label: "Spotlight",            bg: "bg-[var(--primary)] text-white" },
  article:         { icon: PencilSimple,  label: "Article approved",     bg: "bg-[var(--secondary)]" },
  claim:           { icon: CheckCircle,   label: "Claim approved",       bg: "bg-[var(--primary)] text-white" },
  theme_set:       { icon: Star,          label: "Theme set complete",   bg: "bg-[var(--purple)] text-white" },
  active_member:   { icon: Crown,         label: "Active Member bonus",  bg: "bg-black text-white" },
  streak_1000:     { icon: Target,        label: "1,000-pt streak",      bg: "bg-black text-white" },
  membership_cash: { icon: Coin,          label: "Monthly membership",   bg: "bg-[var(--secondary)]" },
  other:           { icon: Sparkle,       label: "Adjustment",           bg: "bg-white" },
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now - d) / 3600000;
  if (diffH < 1) return `${Math.max(1, Math.floor(diffH * 60))}m ago`;
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Group transactions by calendar day for clean section headers
function groupByDay(txs) {
  const map = new Map();
  for (const t of txs) {
    const day = (t.created_at || "").slice(0, 10) || "—";
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(t);
  }
  return Array.from(map.entries()); // [[day, [tx,...]], ...]
}

function dayLabel(isoDay) {
  if (!isoDay || isoDay === "—") return "Earlier";
  const d = new Date(isoDay + "T00:00:00");
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const iso = (x) => x.toISOString().slice(0, 10);
  if (iso(d) === iso(today)) return "Today";
  if (iso(d) === iso(yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function TxRow({ tx, isCash }) {
  const style = SOURCE_STYLES[tx.source] || SOURCE_STYLES.other;
  const amt = Number(tx.amount || 0);
  const positive = amt >= 0;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-dashed border-black/10 last:border-0" data-testid={`tx-${tx.tx_id}`}>
      <div className={`shrink-0 w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center ${style.bg}`}>
        <style.icon size={18} weight="fill" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm leading-tight truncate">{tx.reason || style.label}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] mt-0.5 flex items-center gap-1">
          <span>{style.label}</span>
          <span>·</span>
          <span>{formatDate(tx.created_at)}</span>
        </div>
      </div>
      <div className={`shrink-0 font-black text-sm ${positive ? "text-[var(--primary)]" : "text-black"}`}>
        {positive ? "+" : ""}{isCash ? "$" : ""}{Math.abs(amt)}
      </div>
    </div>
  );
}

export default function PointsHistory({ kind = "points" }) {
  const isCash = kind === "anime_cash";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | earned | spent
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get("/points/history", { params: { kind, limit: 300 } })
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ balance: 0, transactions: [], totals: {} }))
      .finally(() => setLoading(false));
  }, [kind]);

  const filtered = useMemo(() => {
    let list = data?.transactions || [];
    if (filter === "earned") list = list.filter((t) => Number(t.amount) > 0);
    if (filter === "spent")  list = list.filter((t) => Number(t.amount) < 0);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((t) => (t.reason || "").toLowerCase().includes(needle));
    return list;
  }, [data, filter, q]);

  const grouped = groupByDay(filtered);

  const Icon = isCash ? CurrencyCircleDollar : Trophy;
  const title = isCash ? "Anime Cash history" : "Points history";
  const subtitle = isCash ? "$1 Anime Cash = $1 off · synced with MyCred" : "Reputation + perks · synced with MyCred";
  const balance = data?.balance ?? 0;
  const balanceDisplay = isCash ? `$${balance}` : balance;
  const guideLink = isCash ? "/dashboard/anime-cash-guide" : "/dashboard/points-guide";
  const sourceUrl = isCash
    ? "https://rintaki.org/member-dashboard/anime-cash/"
    : "https://rintaki.org/points/";

  return (
    <div className="space-y-5 pb-6">
      <button onClick={() => navigate(-1)} data-testid="hist-back"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
        <ArrowLeft size={14} weight="bold" /> Back
      </button>

      {/* Hero */}
      <Card className="bg-black text-white p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className={`w-14 h-14 ${isCash ? "bg-[var(--accent)]" : "bg-[var(--primary)]"} text-black border-2 border-black rounded-2xl flex items-center justify-center shadow-[3px_3px_0_#fff]`}>
            <Icon size={28} weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-2xl leading-tight">{title}</h1>
            <p className="text-[12px] opacity-80 leading-snug">{subtitle}</p>
          </div>
        </div>
        <div className={`${isCash ? "bg-[var(--accent)] text-black" : "bg-[var(--primary)] text-white"} px-4 py-2 border-t-2 border-black flex items-center justify-between`}>
          <span className="text-[10px] font-black uppercase tracking-widest">Current balance</span>
          <span className="font-black text-2xl" data-testid="hist-balance">{balanceDisplay}</span>
        </div>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-2 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Earned</div>
          <div className="font-black text-lg text-[var(--primary)]">+{isCash && "$"}{data?.totals?.all_time_in || 0}</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Spent</div>
          <div className="font-black text-lg">{isCash && "$"}{Math.abs(data?.totals?.all_time_out || 0)}</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">30-day</div>
          <div className={`font-black text-lg ${(data?.totals?.last_30_days || 0) >= 0 ? "text-[var(--primary)]" : ""}`}>
            {(data?.totals?.last_30_days || 0) >= 0 ? "+" : ""}{isCash && "$"}{data?.totals?.last_30_days || 0}
          </div>
        </Card>
      </div>

      {/* Filter & search */}
      <Card className="p-2">
        <div className="flex gap-1 mb-2">
          {["all", "earned", "spent"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
                    className={`flex-1 border-2 border-black rounded-full py-1.5 text-[10px] font-black uppercase tracking-widest ${filter === f ? "bg-black text-white" : "bg-white"}`}>
              {f === "earned" ? <ArrowUp size={10} weight="bold" className="inline -mt-0.5" /> : f === "spent" ? <ArrowDown size={10} weight="bold" className="inline -mt-0.5" /> : null} {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-2 border-black rounded-full px-2 py-1 bg-white">
          <MagnifyingGlass size={14} weight="bold" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activity"
                 data-testid="hist-search"
                 className="bg-transparent outline-none text-sm flex-1" />
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <Card><div className="animate-pulse text-center text-sm text-[var(--muted-fg)]">Loading…</div></Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing yet" body={q ? `No matches for "${q}"` : "Your history will appear here as you earn."} icon={Icon} />
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, list]) => (
            <div key={day} data-testid={`tx-group-${day}`}>
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] mb-1 px-1">
                {dayLabel(day)}
              </div>
              <Card className="p-3">
                {list.map((tx) => <TxRow key={tx.tx_id} tx={tx} isCash={isCash} />)}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Footer links */}
      <div className="pt-2 space-y-2">
        <Link to={guideLink} data-testid="hist-guide-link">
          <Card className="flex items-center gap-3 bg-white">
            <div className="w-9 h-9 bg-black text-white border-2 border-black rounded-full flex items-center justify-center">
              <BookOpen size={16} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="font-black text-sm">How to earn more</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-fg)]">{isCash ? "Anime Cash" : "Points"} guide</div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Open →</span>
          </Card>
        </Link>
        <a href={sourceUrl} target="_blank" rel="noreferrer"
           className="block text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] text-center">
          <ArrowSquareOut size={10} weight="bold" className="inline -mt-0.5" /> View on rintaki.org
        </a>
      </div>
    </div>
  );
}
