import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea } from "@/components/ui-brutal";
import {
  ArrowLeft, Trophy, Buildings, CurrencyCircleDollar, ArrowsClockwise, ArrowSquareOut,
  Star, Users, PencilSimple, ShieldCheck, HandHeart, Gift, CaretRight, Lock,
  Check, Hourglass, X as XIcon, Camera, CheckCircle, Shield, PaperPlaneTilt,
} from "@phosphor-icons/react";

// Map a section heading → icon + brutal color.  Falls back to a neutral card.
const SECTION_STYLES = [
  { match: /member|active|status/i,           icon: Star,         color: "bg-[var(--primary)] text-white",   pill: "bg-[var(--secondary)] text-black" },
  { match: /sign.?in|sheet|fundraiser|hours/i, icon: Users,        color: "bg-[var(--accent)]",               pill: "bg-black text-white" },
  { match: /submission|article|review|blog/i,  icon: PencilSimple, color: "bg-[var(--secondary)]",            pill: "bg-[var(--primary)] text-white" },
  { match: /award|month|winner/i,              icon: Trophy,       color: "bg-[var(--purple)] text-white",    pill: "bg-[var(--secondary)] text-black" },
  { match: /community|sponsor/i,               icon: HandHeart,    color: "bg-white",                         pill: "bg-[var(--primary)] text-white" },
  { match: /bonus|extra|apparel/i,             icon: Gift,         color: "bg-[var(--secondary)]",            pill: "bg-black text-white" },
  { match: /spend|redeem|use/i,                icon: ShieldCheck,  color: "bg-black text-white",              pill: "bg-[var(--secondary)] text-black" },
];
function styleForSection(heading) {
  const s = SECTION_STYLES.find((s) => s.match.test(heading));
  return s || { icon: Star, color: "bg-white", pill: "bg-[var(--primary)] text-white" };
}

// Friendlier label for unit strings ("pts per hr" → "pts/hr", "per month" → "/mo", etc)
function shortUnit(unit) {
  if (!unit) return "";
  return unit
    .replace(/^pts?$|^points?$/i, "pts")
    .replace(/per\s*hr/i, "/ hr")
    .replace(/per\s*month/i, "/ mo")
    .replace(/per\s*year/i, "/ yr")
    .replace(/per\s*\$/i, "/ $")
    .replace(/per\s*\$(\d+)/i, "/ $$$1")
    .trim();
}

// Pick a sensible default amount for a ranged/varies item (e.g. "25-50 pts" → 25, "Varies" → 0)
function defaultClaimAmount(item) {
  const raw = String(item.amount || "").trim();
  const m = raw.match(/(\d+)(?:-(\d+))?/);
  if (m) return parseInt(m[1], 10);
  return 0;
}

// Small status pill + action per item
function ModeBadge({ mode, claim }) {
  if (claim) {
    if (claim.status === "pending")
      return <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-[var(--secondary)] text-black border-2 border-black rounded-full px-2 py-0.5"><Hourglass size={10} weight="bold" /> Pending</span>;
    if (claim.status === "approved")
      return <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-[var(--primary)] text-white border-2 border-black rounded-full px-2 py-0.5"><CheckCircle size={10} weight="fill" /> +{claim.approved_amount || claim.amount}</span>;
    if (claim.status === "rejected")
      return <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-black text-white border-2 border-black rounded-full px-2 py-0.5"><XIcon size={10} weight="bold" /> Declined</span>;
  }
  if (mode === "auto")
    return <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-[var(--primary)] text-white border-2 border-black rounded-full px-2 py-0.5"><CheckCircle size={10} weight="fill" /> Auto</span>;
  if (mode === "admin")
    return <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-black text-white border-2 border-black rounded-full px-2 py-0.5"><Shield size={10} weight="fill" /> Admin</span>;
  return null;
}

function ItemRow({ section, item, pill, claimByKey, onClaim, streakProgress }) {
  const claim = claimByKey?.[item.item_key];
  const canClaim = item.mode === "claim" && (!claim || claim.status === "rejected");
  const isStreakItem = /1,?000\s*points/i.test(item.desc) && /30\s*days/i.test(item.desc);
  return (
    <div className="py-2 border-b border-dashed border-black/10 last:border-0" data-testid="guide-item">
      <div className="flex items-center gap-3">
        <div className={`shrink-0 min-w-[64px] text-center border-2 border-black rounded-full px-2.5 py-1 font-black text-xs uppercase tracking-wider ${pill}`}>
          {item.amount}{item.unit ? ` ${shortUnit(item.unit).replace(/^pts\b/, "pts")}` : ""}
        </div>
        <div className="text-sm flex-1 leading-snug">{item.desc}</div>
        <ModeBadge mode={item.mode} claim={claim} />
      </div>
      {isStreakItem && streakProgress && (
        <div className="mt-2 ml-[76px]" data-testid="streak-progress">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">
            <span>{streakProgress.total_30d} / {streakProgress.threshold} pts</span>
            {streakProgress.cooldown_days_left > 0 ? (
              <span className="text-[var(--primary)]">Cooldown: {streakProgress.cooldown_days_left}d</span>
            ) : streakProgress.total_30d >= streakProgress.threshold ? (
              <span className="text-[var(--primary)]">Ready to unlock!</span>
            ) : (
              <span>{streakProgress.days_left}d window</span>
            )}
          </div>
          <div className="h-2 bg-black/10 border-2 border-black rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-[var(--primary)] transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.round((streakProgress.total_30d / streakProgress.threshold) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
      {canClaim && (
        <div className="flex justify-end mt-1">
          <button onClick={() => onClaim(section, item)}
                  data-testid={`claim-btn-${item.item_key}`}
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-white border-2 border-black rounded-full px-3 py-1 shadow-[2px_2px_0_#111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
            <PaperPlaneTilt size={11} weight="bold" /> Claim
          </button>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, claimByKey, onClaim, streakProgress }) {
  const { icon: Icon, color, pill } = styleForSection(section.heading);
  return (
    <Card className={`${color} p-0 overflow-hidden`} data-testid={`guide-section-${section.heading.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-black bg-black/5">
        <div className="w-9 h-9 bg-white text-black border-2 border-black rounded-full flex items-center justify-center">
          <Icon size={18} weight="fill" />
        </div>
        <div className="font-black text-base leading-tight flex-1">{section.heading}</div>
        {section.items?.length > 0 && (
          <span className="text-[10px] font-black uppercase tracking-widest bg-white border-2 border-black rounded-full px-2 py-0.5 text-black">
            {section.items.length}
          </span>
        )}
      </div>
      {section.intro && (
        <p className="text-[13px] leading-snug px-3 pt-3 opacity-90">{section.intro}</p>
      )}
      {section.items?.length > 0 && (
        <div className="px-3 pb-3 pt-1 bg-white/80 text-black mt-3 border-t-2 border-black">
          {section.items.map((it, i) => (
            <ItemRow key={i} section={section} item={it} pill={pill}
                     claimByKey={claimByKey} onClaim={onClaim}
                     streakProgress={streakProgress} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ClaimModal({ open, section, item, onClose, onSubmitted }) {
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(""); // data URL
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open && item) {
      setAmount(defaultClaimAmount(item));
      setNote(""); setPhoto(""); setErr("");
    }
  }, [open, item]);

  if (!open || !item) return null;

  const onPickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      setErr("Photo too large — max 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) { setErr("Enter a valid amount."); return; }
    setSubmitting(true);
    try {
      await api.post("/guides/points/claim", {
        item_key: item.item_key,
        item_heading: section.heading,
        item_desc: item.desc,
        amount: amt,
        note: note.trim(),
        photo_data_url: photo || null,
      });
      onSubmitted?.();
      onClose();
    } catch (e2) {
      setErr(e2.response?.data?.detail || "Failed to submit claim.");
    } finally {
      setSubmitting(false);
    }
  };

  const ranged = String(item.amount || "").match(/^\d+-\d+$/);
  const amountHint = ranged
    ? `Range: ${item.amount} ${shortUnit(item.unit)} — admin sets the final amount.`
    : String(item.amount).toLowerCase() === "varies"
    ? "Admin will set the final amount."
    : "";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]"
            data-testid="claim-form">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-black text-xl">Submit claim</h2>
          <button type="button" onClick={onClose} data-testid="claim-close"
                  className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><XIcon size={14} weight="bold" /></button>
        </div>

        <div className="bg-black text-white border-2 border-black rounded-xl p-3 mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{section.heading}</div>
          <div className="font-bold text-sm leading-snug">{item.desc}</div>
          <div className="text-[10px] font-black uppercase tracking-widest mt-1 text-[var(--secondary)]">
            {item.amount} {shortUnit(item.unit)}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Claim amount</label>
            <Input type="number" min="1" max="500" value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   data-testid="claim-amount" />
            {amountHint && <p className="text-[10px] text-[var(--muted-fg)] font-bold mt-1">{amountHint}</p>}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Note (optional)</label>
            <Textarea rows={3} placeholder="e.g. Attended monthly meeting on April 23"
                      value={note} onChange={(e) => setNote(e.target.value)}
                      data-testid="claim-note" />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">Photo proof (optional)</label>
            {photo ? (
              <div className="relative border-2 border-black rounded-lg overflow-hidden mt-1" data-testid="claim-photo-preview">
                <img src={photo} alt="preview" className="w-full max-h-48 object-cover" />
                <button type="button" onClick={() => setPhoto("")}
                        className="absolute top-1 right-1 w-7 h-7 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0_#111]">
                  <XIcon size={12} weight="bold" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 border-2 border-dashed border-black rounded-xl py-3 cursor-pointer bg-[var(--muted)]">
                <Camera size={18} weight="fill" />
                <span className="font-bold text-sm">Attach receipt / photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} data-testid="claim-photo-input" />
              </label>
            )}
          </div>

          {err && (
            <div className="bg-[var(--primary)] text-white border-2 border-black rounded-lg px-3 py-2 text-sm font-bold" data-testid="claim-err">{err}</div>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="w-full mt-3" data-testid="claim-submit">
          {submitting ? "Submitting…" : "Submit for admin review"}
        </Button>
        <p className="text-[10px] text-center text-[var(--muted-fg)] font-bold uppercase tracking-widest mt-2">
          Points credit to MyCred on rintaki.org once approved.
        </p>
      </form>
    </div>
  );
}

function ParsedGuide({ endpoint, title, icon: Icon, subtitle, source_url, heroStat, lockedBody, fallbackSections, enableClaims, enableStreak }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isMember = !!user && (isAdmin || user.is_member);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [myClaims, setMyClaims] = useState([]);
  const [streakProgress, setStreakProgress] = useState(null);
  const [claimModal, setClaimModal] = useState({ open: false, section: null, item: null });

  const load = async (refresh = false) => {
    try {
      setErr("");
      if (refresh) setRefreshing(true); else setLoading(true);
      const { data: d } = await api.get(endpoint, { params: refresh ? { refresh: 1 } : {} });
      setData(d);
    } catch (e) {
      setErr(e.response?.data?.detail || "Couldn't reach rintaki.org.");
    } finally {
      setRefreshing(false); setLoading(false);
    }
  };
  const loadClaims = async () => {
    if (!enableClaims || !isMember) return;
    try {
      const { data: d } = await api.get("/guides/points/my-claims");
      setMyClaims(d.claims || []);
    } catch { /* ignore */ }
  };
  const loadStreak = async () => {
    if (!enableStreak || !isMember) return;
    try {
      const { data: d } = await api.get("/guides/points/streak-progress");
      setStreakProgress(d);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); loadClaims(); loadStreak(); /* eslint-disable-next-line */ }, [endpoint]);

  // Latest claim per item_key (most recent wins)
  const claimByKey = React.useMemo(() => {
    const m = {};
    for (const c of myClaims) {
      if (!m[c.item_key]) m[c.item_key] = c;  // already sorted newest-first by API
    }
    return m;
  }, [myClaims]);

  const openClaim = (section, item) => setClaimModal({ open: true, section, item });
  const closeClaim = () => setClaimModal({ open: false, section: null, item: null });

  // When rintaki.org returns the PMPro "Membership Required" placeholder,
  // the parser will produce a single section with heading like "Membership Required".
  const sections = data?.sections || [];
  const isLocked = sections.length === 1 && /membership required|members? only|restricted/i.test(sections[0].heading || "");
  const useFallback = !loading && !err && (isLocked || sections.length === 0) && fallbackSections;

  return (
    <div className="space-y-5 pb-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" data-testid="back-dash">
        <ArrowLeft size={14} weight="bold" /> Back
      </Link>

      {/* Hero */}
      <Card className="bg-black text-white p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-14 h-14 bg-[var(--primary)] text-white border-2 border-black rounded-2xl flex items-center justify-center shadow-[3px_3px_0_#fff]">
            <Icon size={26} weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-2xl leading-tight">{title}</h1>
            {subtitle && <p className="text-[12px] opacity-80 leading-snug">{subtitle}</p>}
          </div>
          {isAdmin && (
            <button onClick={() => load(true)} disabled={refreshing} data-testid="guide-refresh"
              className="w-10 h-10 bg-white text-black border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0_#fff] disabled:opacity-50">
              <ArrowsClockwise size={14} weight="bold" className={refreshing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
        {heroStat && (
          <div className="bg-[var(--primary)] px-4 py-2 border-t-2 border-white/30 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-90">{heroStat.label}</span>
            <span className="font-black text-xl">{heroStat.value}</span>
          </div>
        )}
      </Card>

      {/* Claim status banner for members */}
      {enableClaims && isMember && myClaims.length > 0 && (
        <Card className="bg-[var(--secondary)] p-3 flex items-center gap-2" data-testid="my-claims-banner">
          <div className="flex-1 text-sm font-bold leading-tight">
            <div className="flex items-center gap-1.5"><Hourglass size={14} weight="fill" />
              {myClaims.filter(c => c.status === "pending").length} pending ·&nbsp;
              <CheckCircle size={14} weight="fill" />
              {myClaims.filter(c => c.status === "approved").length} approved
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] mt-0.5">Your claims</div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card data-testid="guide-loading" className="text-center">
          <div className="animate-pulse text-sm font-bold text-[var(--muted-fg)]">Syncing from rintaki.org…</div>
        </Card>
      ) : err ? (
        <Card className="bg-[var(--secondary)]" data-testid="guide-err">
          <p className="text-sm font-bold">Couldn't reach rintaki.org.</p>
          <p className="text-xs text-[var(--muted-fg)] mt-1">{err}</p>
        </Card>
      ) : useFallback ? (
        <>
          {isLocked && (
            <Card className="bg-[var(--secondary)]" data-testid="guide-locked">
              <div className="flex items-center gap-2 font-black"><Lock size={16} weight="fill" /> Locked on rintaki.org</div>
              <p className="text-sm mt-1">{lockedBody || "The website requires a member login to view this page. Here's the in-app summary while we wait for admin to open it up."}</p>
            </Card>
          )}
          {fallbackSections.map((s, i) => <SectionCard key={i} section={s} claimByKey={{}} onClaim={() => {}} streakProgress={null} />)}
        </>
      ) : (
        <>
          {sections.map((s, i) => <SectionCard key={i} section={s} claimByKey={claimByKey} onClaim={openClaim} streakProgress={streakProgress} />)}
        </>
      )}

      <div className="pt-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--muted-fg)]">
        <span data-testid="guide-cached">
          {useFallback ? "Offline summary" : data?.stale ? "Cached · sync failed" : data?.cached ? "From cache" : "Just synced"}
        </span>
        <a href={source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline text-[var(--primary)]">
          Open on rintaki.org <ArrowSquareOut size={10} weight="bold" />
        </a>
      </div>

      <ClaimModal open={claimModal.open} section={claimModal.section} item={claimModal.item}
                  onClose={closeClaim} onSubmitted={loadClaims} />
    </div>
  );
}

// --- Offline fallbacks (used only when rintaki.org locks the page) ---
const ANIME_CASH_FALLBACK = [
  {
    heading: "How Anime Cash works",
    level: 3,
    intro: "Anime Cash is real store credit. $1 Anime Cash = $1 off at the club shop. Balances sync live with MyCred on rintaki.org.",
    items: [],
  },
  {
    heading: "Earning Anime Cash",
    level: 3,
    intro: "",
    items: [
      { amount: "$5", unit: "/ mo", desc: "Regular membership", mode: "auto", item_key: "cash_regular" },
      { amount: "$10", unit: "/ mo", desc: "Premium membership", mode: "auto", item_key: "cash_premium" },
      { amount: "25", unit: "cash", desc: "Article of the month" },
      { amount: "Varies", unit: "", desc: "Giveaway & contest bonuses" },
    ],
  },
  {
    heading: "Spending Anime Cash",
    level: 3,
    intro: "Applies automatically at checkout on rintaki.org — no code needed. Stacks with coupon codes where allowed. Does not expire while membership stays active.",
    items: [],
  },
];

export function PointsGuide() {
  const { user } = useAuth();
  const heroStat = user ? { label: "Your points", value: user.points ?? 0 } : null;
  return (
    <ParsedGuide
      endpoint="/guides/points/parsed"
      title="Points Guide"
      subtitle="Earn reputation & perks by participating in the club."
      icon={Trophy}
      source_url="https://rintaki.org/points/"
      heroStat={heroStat}
      enableClaims={true}
      enableStreak={true}
    />
  );
}

export function AnimeCashGuide() {
  const { user } = useAuth();
  const heroStat = user ? { label: "Your Anime Cash", value: `$${user.anime_cash ?? 0}` } : null;
  return (
    <ParsedGuide
      endpoint="/guides/anime-cash/parsed"
      title="Anime Cash"
      subtitle="Real store credit for the club shop — $1 = $1 off."
      icon={CurrencyCircleDollar}
      source_url="https://rintaki.org/member-dashboard/anime-cash/"
      heroStat={heroStat}
      fallbackSections={ANIME_CASH_FALLBACK}
      lockedBody="The Anime Cash page on rintaki.org is members-only. Here's the summary — we'll pull the live content as soon as the page is opened to the public."
    />
  );
}

export function LibraryGuide() {
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Buildings size={26} weight="fill" className="text-[var(--primary)]" /> Library guide</h1>
      </div>
      <Card>
        <h3 className="font-black text-lg">How borrowing works</h3>
        <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
          <li>Browse the catalog on Libib (see Library tab).</li>
          <li>Message an admin to reserve a title (DM inside the app).</li>
          <li>Pick up at the club / meetup and enjoy.</li>
          <li>Return by due date to earn +5 points per title.</li>
        </ol>
      </Card>
      <Card>
        <h3 className="font-black text-lg">Late returns</h3>
        <p className="text-sm mt-1">Late returns cost 3 points per week. Repeat late returns may limit future borrowing.</p>
      </Card>
    </div>
  );
}
