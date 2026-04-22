import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Button, Avatar } from "@/components/ui-brutal";
import { Users, ChatsCircle, Calendar, Newspaper, VideoCamera, FilmSlate, Check, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const loadPending = async () => {
    try {
      const { data } = await api.get("/feed/pending");
      setPending(data.posts || []);
    } catch { setPending([]); }
  };

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => setStats({}));
    loadPending();
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
                      <video src={p.media_url} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={p.media_url} alt="" className="w-full h-full object-cover" />
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
