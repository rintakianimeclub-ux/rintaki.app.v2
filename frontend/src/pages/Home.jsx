import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button } from "@/components/ui-brutal";
import Logo from "@/components/Logo";
import { Fire, Calendar, ArrowUpRight, Trophy, Lightning,
  BookOpen, Buildings, FilmSlate, SignIn, Sparkle, CurrencyCircleDollar, ShoppingBag,
} from "@phosphor-icons/react";

function stripHtml(html = "") {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || d.innerText || "";
}

export default function Home() {
  const { user } = useAuth();
  const isMember = !!user && (user.role === "admin" || user.is_member);

  const [feed, setFeed] = useState([]);
  const [events, setEvents] = useState([]);
  const [threads, setThreads] = useState([]);
  const [magazines, setMagazines] = useState([]);
  const [claimed, setClaimed] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [f, e, t, m] = await Promise.all([
        api.get("/rintaki/feed").catch(() => ({ data: { posts: [] } })),
        api.get("/events").catch(() => ({ data: { events: [] } })),
        api.get("/forums/threads").catch(() => ({ data: { threads: [] } })),
        api.get("/magazines").catch(() => ({ data: { magazines: [] } })),
      ]);
      setFeed(f.data.posts || []);
      setEvents(e.data.events || []);
      setThreads(t.data.threads || []);
      setMagazines(m.data.magazines || []);
    })();
  }, []);

  const claimDaily = async () => {
    try {
      const { data } = await api.post("/points/daily-claim");
      setClaimed(true);
      setClaimMsg(`+5! Total: ${data.points}`);
    } catch (e) {
      setClaimMsg(e.response?.data?.detail || "Already claimed today");
      setClaimed(true);
    }
  };

  const heroImage = feed[0]?.image || "https://images.unsplash.com/photo-1722803921446-70be3842871e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwxfHxhbmltZSUyMGNvbnZlbnRpb24lMjBjcm93ZHxlbnwwfHx8fDE3NzY4MDYyMjh8MA&ixlib=rb-4.1.0&q=85";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border-2 border-black shadow-[6px_6px_0_#111] bg-[var(--primary)] text-white grain">
        <img src={heroImage} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-55" alt="" />
        <div className="relative p-5">
          <div className="flex items-start gap-3">
            <Logo size={72} ring="bg-white" className="shadow-[4px_4px_0_#111] tilt-2" />
            <div className="flex-1 min-w-0">
              {isMember ? (
                <>
                  <Sticker color="secondary" className="tilt-1">★ Hey {user?.name?.split(" ")[0] || "Otaku"}</Sticker>
                  <h1 className="font-black text-4xl leading-[1.05] mt-2">
                    <span className="bg-black px-2">Welcome!</span>
                  </h1>
                </>
              ) : (
                <>
                  <Sticker color="secondary" className="tilt-1">★ Rintaki Anime Club Society</Sticker>
                  <h1 className="font-black text-4xl leading-[1.05] mt-2">
                    <span className="bg-black px-2">Welcome!</span>
                  </h1>
                  <p className="mt-2 text-sm font-bold opacity-90 max-w-xs">
                    Forums, events, trading cards, magazines and galleries — all in one place.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Member: points/cash + daily claim */}
          {isMember && (
            <>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-white text-black border-2 border-black rounded-xl p-2 flex items-center gap-2">
                  <Trophy size={16} weight="fill" />
                  <div>
                    <div className="text-[9px] uppercase tracking-widest font-black text-[var(--muted-fg)]">Points</div>
                    <div className="font-black">{user?.points ?? 0}</div>
                  </div>
                </div>
                <div className="bg-white text-black border-2 border-black rounded-xl p-2 flex items-center gap-2">
                  <CurrencyCircleDollar size={16} weight="fill" />
                  <div>
                    <div className="text-[9px] uppercase tracking-widest font-black text-[var(--muted-fg)]">Anime Cash</div>
                    <div className="font-black">{user?.anime_cash ?? 0}</div>
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={claimDaily} disabled={claimed} className="mt-3 w-full" data-testid="claim-daily-btn">
                <Lightning size={14} weight="fill" /> {claimed ? claimMsg || "Claimed" : "Claim daily +5"}
              </Button>
            </>
          )}

          {/* Anonymous OR logged-in non-member: join CTA */}
          {!isMember && (
            <div className="mt-4 space-y-2">
              <Link to="/join" data-testid="hero-join-btn">
                <Button variant="secondary" className="w-full">
                  <Sparkle size={14} weight="fill" /> See membership benefits
                </Button>
              </Link>
              {!user && (
                <Link to="/login" data-testid="hero-signin-link">
                  <button className="w-full text-white text-xs font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">
                    Already a member? Sign in
                  </button>
                </Link>
              )}
              {user && !isMember && (
                <p className="text-[11px] text-white/80 font-bold text-center">
                  Logged in as {user.name?.split(" ")[0]}. Members earn points & unlock the dashboard.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Quick tiles — public */}
      <div className="grid grid-cols-5 gap-1.5">
        <QuickTile to="/events" icon={Calendar} label="Events" />
        <QuickTile to="/magazines" icon={BookOpen} label="Mag" />
        <QuickTile to="/library" icon={Buildings} label="Library" />
        <QuickTile to="/events-gallery" icon={FilmSlate} label="Gallery" />
        <QuickTile to="/shop" icon={ShoppingBag} label="Shop" />
      </div>

      {/* Latest rintaki articles */}
      <section>
        <SectionHeader title="From rintaki.org" icon={ArrowUpRight} />
        {feed.length === 0 ? (
          <Card><p className="text-sm text-[var(--muted-fg)]">No articles available.</p></Card>
        ) : (
          <div className="space-y-3">
            {feed.slice(0, 4).map((p) => (
              <a key={p.id} href={p.link} target="_blank" rel="noreferrer" data-testid={`feed-card-${p.id}`}>
                <Card className="p-0 overflow-hidden">
                  {p.image && <div className="aspect-video border-b-2 border-black overflow-hidden"><img src={p.image} className="w-full h-full object-cover" alt="" /></div>}
                  <div className="p-3">
                    <h3 className="font-black text-base line-clamp-2" dangerouslySetInnerHTML={{ __html: p.title }} />
                    <p className="mt-1 text-xs text-[var(--muted-fg)] line-clamp-2">{stripHtml(p.excerpt)}</p>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">Read →</div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming event */}
      {events[0] && (
        <section>
          <SectionHeader title="Next up" icon={Calendar} cta={{ to: "/events", label: "All" }} />
          <Link to="/events"><Card className="p-0 overflow-hidden" data-testid="home-next-event">
            {events[0].cover_image && <div className="aspect-[16/9] border-b-2 border-black"><img src={events[0].cover_image} className="w-full h-full object-cover" alt="" /></div>}
            <div className="p-3">
              <Sticker color="accent">{new Date(events[0].starts_at).toLocaleDateString()}</Sticker>
              <h3 className="font-black text-lg mt-2">{events[0].title}</h3>
              <p className="text-xs text-[var(--muted-fg)] line-clamp-2">{events[0].description}</p>
            </div>
          </Card></Link>
        </section>
      )}

      {/* Magazine */}
      {magazines[0] && (
        <section>
          <SectionHeader title="Otaku World" icon={BookOpen} cta={{ to: "/magazines", label: "Archive" }} />
          <Link to="/magazines"><Card className="flex gap-3 p-3" data-testid="home-magazine">
            {magazines[0].cover_image && <img src={magazines[0].cover_image} alt="" className="w-20 h-28 object-cover rounded-lg border-2 border-black" />}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-black text-[var(--primary)]">Latest issue</div>
              <h4 className="font-black line-clamp-2">{magazines[0].title}</h4>
              <p className="text-xs text-[var(--muted-fg)]">{magazines[0].issue}</p>
            </div>
          </Card></Link>
        </section>
      )}

      {/* Forum hot — browsing only for non-members; link still works */}
      <section>
        <SectionHeader title="Forum" icon={Fire} cta={{ to: "/forums", label: "All" }} />
        <div className="space-y-2">
          {threads.slice(0, 3).map((t) => (
            <Link key={t.thread_id} to={`/forums/${t.thread_id}`} data-testid={`home-thread-${t.thread_id}`}>
              <Card className="p-3">
                <div className="flex gap-2 mb-1">
                  <Sticker color="primary">{t.category}</Sticker>
                  {t.pinned && <Sticker color="secondary">📌</Sticker>}
                </div>
                <h4 className="font-black text-base line-clamp-2">{t.title}</h4>
                <div className="text-[10px] text-[var(--muted-fg)] font-bold uppercase tracking-widest mt-1">
                  {t.author_name} · {t.reply_count} replies · {t.likes?.length || 0} likes
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickTile({ to, icon: Icon, label }) {
  return (
    <Link to={to} data-testid={`quick-${label.toLowerCase()}`}>
      <Card className="p-2 text-center">
        <Icon size={18} weight="fill" className="mx-auto" />
        <div className="text-[9px] font-black uppercase tracking-widest mt-1 leading-tight">{label}</div>
      </Card>
    </Link>
  );
}

function SectionHeader({ title, icon: Icon, cta }) {
  return (
    <div className="flex items-end justify-between mb-2">
      <h2 className="font-black text-xl flex items-center gap-1">
        {Icon && <Icon size={18} weight="fill" className="text-[var(--primary)]" />} {title}
      </h2>
      {cta && <Link to={cta.to} className="text-[10px] font-black uppercase tracking-widest underline decoration-[var(--primary)] decoration-2 underline-offset-4">{cta.label} →</Link>}
    </div>
  );
}
