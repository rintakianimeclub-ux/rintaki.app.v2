import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Button, Avatar, Input, Textarea } from "@/components/ui-brutal";
import { Users, ChatsCircle, Calendar, Newspaper, VideoCamera, FilmSlate, Check, X, Trophy, Hourglass, CheckCircle } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const resolveMediaUrl = (u) => {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/api/")) return `${BACKEND}${u}`;
  return u;
};

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [pointClaims, setPointClaims] = useState([]);
  const [claimBusy, setClaimBusy] = useState(null);
  const [overrideAmt, setOverrideAmt] = useState({});
  const [adminNote, setAdminNote] = useState({});

  const loadPending = async () => {
    try {
      const { data } = await api.get("/feed/pending");
      setPending(data.posts || []);
    } catch { setPending([]); }
  };
  const loadClaims = async () => {
    try {
      const { data } = await api.get("/admin/point-claims?status=pending");
      setPointClaims(data.claims || []);
    } catch { setPointClaims([]); }
  };

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => setStats({}));
    loadPending();
    loadClaims();
  }, []);

  const act = async (post_id, action) => {
    setBusyId(post_id);
    try {
      await api.post(`/feed/posts/${post_id}/${action}`);
      loadPending();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const decideClaim = async (claim_id, action) => {
    setClaimBusy(claim_id);
    try {
      const body = {};
      if (overrideAmt[claim_id]) body.amount = parseInt(overrideAmt[claim_id], 10);
      if (adminNote[claim_id]) body.admin_note = adminNote[claim_id];
      await api.post(`/admin/point-claims/${claim_id}/${action}`, body);
      loadClaims();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed");
    } finally {
      setClaimBusy(null);
    }
  };

  const tiles = [
    { label: "Users", key: "users", icon: Users, to: "/members" },
    { label: "Threads", key: "threads", icon: ChatsCircle, to: "/forums" },
    { label: "Events", key: "events", icon: Calendar, to: "/events" },
    { label: "Newsletters", key: "newsletters", icon: Newspaper, to: "/newsletters" },
    { label: "Videos", key: "videos", icon: VideoCamera, to: "/videos" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-black text-4xl">Admin</h1>
        <p className="text-[var(--muted-fg)]">Broadcast newsletters, post videos, create events.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tiles.map((t) => (
          <Link to={t.to} key={t.key} data-testid={`admin-tile-${t.key}`}>
            <Card className="text-center p-5">
              <t.icon size={28} weight="fill" className="mx-auto text-[var(--primary)]" />
              <div className="font-black text-3xl mt-2">{stats?.[t.key] ?? 0}</div>
              <div className="uppercase tracking-widest text-[10px] font-bold">{t.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Spotlight approval queue */}
      <div data-testid="spotlight-approval-queue">
        <h2 className="font-black text-xl mb-2">Spotlight approvals {pending.length > 0 && <span className="bg-[var(--primary)] text-white text-xs px-2 py-0.5 rounded-full border-2 border-black align-middle">{pending.length}</span>}</h2>
        {pending.length === 0 ? (
          <Card><p className="text-sm text-[var(--muted-fg)]">No pending Spotlight posts. ✓</p></Card>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <Card key={p.post_id} className="p-0 overflow-hidden" data-testid={`pending-${p.post_id}`}>
                <div className="flex">
                  <div className="w-28 h-28 bg-black flex-shrink-0 border-r-2 border-black">
                    {p.media_type === "video" ? (
                      <video src={resolveMediaUrl(p.media_url)} controls playsInline className="w-full h-full object-cover" />
                    ) : (
                      <img src={resolveMediaUrl(p.media_url)} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <Avatar user={{ name: p.author_name, picture: p.author_picture }} size={22} />
                      <div className="font-bold text-sm truncate">{p.author_name}</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-[var(--muted-fg)] mt-0.5">
                      {p.media_type} · {p.media_type === "video" ? "+2 pts" : "+1 pt"}
                      {p.video_duration ? ` · ${Number(p.video_duration).toFixed(1)}s` : ""}
                    </div>
                    {p.caption && <p className="text-xs text-[var(--muted-fg)] line-clamp-2 mt-1">{p.caption}</p>}
                    <div className="flex gap-2 mt-2">
                      <Button onClick={() => act(p.post_id, "approve")} disabled={busyId === p.post_id} data-testid={`approve-${p.post_id}`}>
                        <Check size={14} weight="bold" /> Approve
                      </Button>
                      <Button variant="dark" onClick={() => act(p.post_id, "reject")} disabled={busyId === p.post_id} data-testid={`reject-${p.post_id}`}>
                        <X size={14} weight="bold" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Point-claim approval queue */}
      <div data-testid="point-claims-queue">
        <h2 className="font-black text-xl mb-2 flex items-center gap-2">
          <Trophy size={20} weight="fill" className="text-[var(--primary)]" />
          Point claims {pointClaims.length > 0 && <span className="bg-[var(--primary)] text-white text-xs px-2 py-0.5 rounded-full border-2 border-black">{pointClaims.length}</span>}
        </h2>
        {pointClaims.length === 0 ? (
          <Card><p className="text-sm text-[var(--muted-fg)]">No pending point claims. <CheckCircle size={14} weight="fill" className="inline text-[var(--primary)]" /></p></Card>
        ) : (
          <div className="space-y-3">
            {pointClaims.map((c) => (
              <Card key={c.claim_id} className="p-3" data-testid={`claim-${c.claim_id}`}>
                <div className="flex items-start gap-3">
                  <Avatar user={{ name: c.user_name }} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{c.user_name}</div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-[var(--muted-fg)]">{c.user_email}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-[var(--secondary)] border-2 border-black rounded-full px-2 py-0.5"><Hourglass size={10} weight="bold" /> {new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <div className="bg-black text-white border-2 border-black rounded-lg p-2 mt-2">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{c.item_heading}</div>
                  <div className="font-bold text-sm leading-snug">{c.item_desc}</div>
                  <div className="text-xs opacity-80 mt-1">Member claimed: <b className="text-[var(--secondary)]">{c.amount} pts</b></div>
                </div>
                {c.note && (
                  <p className="text-xs mt-2 border-l-2 border-black pl-2 italic">{c.note}</p>
                )}
                {c.photo_url && (
                  <img src={resolveMediaUrl(c.photo_url)} alt="proof" className="w-full max-h-48 object-cover rounded-lg border-2 border-black mt-2" data-testid={`claim-photo-${c.claim_id}`} />
                )}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input type="number" placeholder={`Override (default ${c.amount})`}
                         value={overrideAmt[c.claim_id] || ""}
                         onChange={(e) => setOverrideAmt({ ...overrideAmt, [c.claim_id]: e.target.value })}
                         data-testid={`claim-amt-${c.claim_id}`} />
                  <Input placeholder="Admin note (optional)"
                         value={adminNote[c.claim_id] || ""}
                         onChange={(e) => setAdminNote({ ...adminNote, [c.claim_id]: e.target.value })}
                         data-testid={`claim-note-${c.claim_id}`} />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={() => decideClaim(c.claim_id, "approve")} disabled={claimBusy === c.claim_id} data-testid={`approve-claim-${c.claim_id}`}>
                    <Check size={14} weight="bold" /> Approve & credit MyCred
                  </Button>
                  <Button variant="dark" onClick={() => decideClaim(c.claim_id, "reject")} disabled={claimBusy === c.claim_id} data-testid={`reject-claim-${c.claim_id}`}>
                    <X size={14} weight="bold" /> Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <h3 className="font-black text-lg mb-2">Quick actions</h3>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Create an event from the <Link to="/events" className="font-bold underline">Events page</Link>.</li>
          <li>Publish a newsletter from <Link to="/newsletters" className="font-bold underline">Otaku World</Link>.</li>
          <li>Add a video from the <Link to="/videos" className="font-bold underline">Videos page</Link>.</li>
          <li>Add an external gallery link from the <Link to="/events-gallery" className="font-bold underline">Events Gallery page</Link>.</li>
        </ul>
      </Card>

      <Link to="/events-gallery" data-testid="admin-events-gallery-shortcut">
        <Card className="bg-[var(--accent)] flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white border-2 border-black rounded-full flex items-center justify-center">
            <FilmSlate size={18} weight="fill" />
          </div>
          <div className="flex-1">
            <div className="font-black">Manage Events Gallery</div>
            <div className="text-xs">Add external links to pages of photos or videos</div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
