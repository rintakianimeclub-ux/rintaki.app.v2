import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import { Calendar, MapPin, Ticket, ImagesSquare, FilmSlate, Plus, X, Trash, CaretRight } from "@phosphor-icons/react";
import { sanitizeHtml } from "@/lib/sanitize";

// Sanitize-then-strip so we never parse raw third-party HTML via innerHTML.
function stripHtml(s = "") {
  const d = document.createElement("div");
  d.innerHTML = sanitizeHtml(s);
  return (d.textContent || d.innerText || "").replace(/\s+/g, " ").trim();
}

const TABS = [
  { id: "upcoming", label: "Upcoming", icon: Calendar },
  { id: "past", label: "Past", icon: Calendar },
  { id: "photos", label: "Photos", icon: ImagesSquare },
  { id: "videos", label: "Videos", icon: FilmSlate },
];

export default function Events() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("upcoming");
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [open, setOpen] = useState(null); // "photo" | "video"
  const [form, setForm] = useState({ kind: "photo", url: "", caption: "", event_id: "", event_title: "" });
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(async () => {
    const [u, p, ph, vid] = await Promise.all([
      api.get("/events/upcoming").catch(() => ({ data: { events: [] } })),
      api.get("/events/past").catch(() => ({ data: { events: [] } })),
      api.get("/events/media?kind=photo").catch(() => ({ data: { media: [] } })),
      api.get("/events/media?kind=video").catch(() => ({ data: { media: [] } })),
    ]);
    setUpcoming(u.data.events || []);
    setPast(p.data.events || []);
    setPhotos(ph.data.media || []);
    setVideos(vid.data.media || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/events/media", { ...form, kind: open });
    setOpen(null);
    setForm({ kind: "photo", url: "", caption: "", event_id: "", event_title: "" });
    load();
  };

  const del = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    await api.delete(`/events/media/${id}`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-black text-3xl">Events</h1>
          <p className="text-[var(--muted-fg)] text-sm">Upcoming dates, past highlights, photos & videos.</p>
        </div>
        <Link to="/tickets" className="sticker bg-[var(--secondary)]" data-testid="my-tickets-link">
          <Ticket size={12} weight="fill" /> My tickets
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white border-2 border-black rounded-full shadow-[3px_3px_0_#111] overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`events-tab-${t.id}`}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap min-w-max px-3 ${
              tab === t.id ? "bg-[var(--primary)] text-white" : "text-black"
            }`}
          >
            <t.icon size={14} weight="bold" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "upcoming" && <EventList events={upcoming} emptyTitle="No upcoming events" />}
      {tab === "past"     && <EventList events={past}     emptyTitle="No past events yet" />}
      {tab === "photos"   && (
        <MediaGrid
          items={photos} kind="photo" isAdmin={isAdmin}
          onAdd={() => { setForm({ ...form, kind: "photo" }); setOpen("photo"); }}
          onDelete={del}
          onOpen={(p) => setLightbox(p)}
        />
      )}
      {tab === "videos"   && (
        <MediaGrid
          items={videos} kind="video" isAdmin={isAdmin}
          onAdd={() => { setForm({ ...form, kind: "video" }); setOpen("video"); }}
          onDelete={del}
          onOpen={(p) => setLightbox(p)}
        />
      )}

      {/* Add photo/video modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="event-media-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Add {open}</h2>
              <button type="button" onClick={() => setOpen(null)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <div className="space-y-3">
              <Input required placeholder={`${open === "photo" ? "Image" : "Video"} URL`} value={form.url}
                     data-testid="em-url" onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <Input placeholder="Event name (optional)" value={form.event_title}
                     data-testid="em-event-title" onChange={(e) => setForm({ ...form, event_title: e.target.value })} />
              <Textarea rows={2} placeholder="Caption (optional)" value={form.caption}
                        data-testid="em-caption" onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </div>
            <Button type="submit" className="w-full mt-3" data-testid="em-submit">Add</Button>
          </form>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
          {lightbox.kind === "video" ? (
            <video src={lightbox.url} controls autoPlay className="max-w-full max-h-full" />
          ) : (
            <img src={lightbox.url} alt="" className="max-w-full max-h-full object-contain" />
          )}
          {lightbox.caption && <div className="absolute bottom-4 left-4 right-4 text-white text-sm">{lightbox.caption}{lightbox.event_title && <span className="block text-xs text-white/70 mt-1">{lightbox.event_title}</span>}</div>}
        </div>
      )}
    </div>
  );
}

function EventList({ events, emptyTitle }) {
  if (events.length === 0) return <EmptyState title={emptyTitle} icon={Calendar} />;
  return (
    <div className="space-y-4">
      {events.map((ev) => (
        <Link key={ev.event_id} to={`/events/${ev.event_id}`} data-testid={`event-${ev.event_id}`}>
          <Card className="p-0 overflow-hidden">
            {(ev.banner_url || ev.cover_image) && (
              <div className="aspect-[16/9] border-b-2 border-black overflow-hidden">
                <img src={ev.banner_url || ev.cover_image} className="w-full h-full object-cover" alt="" />
              </div>
            )}
            <div className="p-3">
              <Sticker color="accent">
                <Calendar size={12} weight="bold" /> {new Date(ev.start_date).toLocaleDateString()}
                {!ev.all_day && ` · ${new Date(ev.start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </Sticker>
              <h3 className="font-black text-lg mt-2 leading-tight">{ev.title}</h3>
              {(ev.venue || ev.city) && (
                <div className="text-xs font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                  <MapPin size={12} weight="bold" /> {[ev.venue, ev.city].filter(Boolean).join(" · ")}
                </div>
              )}
              {ev.excerpt && <p className="text-sm text-[var(--muted-fg)] line-clamp-2 mt-1">{stripHtml(ev.excerpt)}</p>}
              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] flex items-center gap-1">
                View details <CaretRight size={12} weight="bold" />
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function MediaGrid({ items, kind, isAdmin, onAdd, onDelete, onOpen }) {
  return (
    <div className="space-y-3">
      {isAdmin && (
        <Button onClick={onAdd} variant="dark" className="w-full" data-testid={`add-${kind}-btn`}>
          <Plus size={14} weight="bold" /> Add {kind}
        </Button>
      )}
      {items.length === 0 ? (
        <EmptyState title={kind === "photo" ? "No photos yet" : "No videos yet"} icon={kind === "photo" ? ImagesSquare : FilmSlate} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((m) => (
            <div key={m.media_id} className="relative" data-testid={`em-${m.media_id}`}>
              <button onClick={() => onOpen(m)} className="w-full aspect-square border-2 border-black rounded-lg overflow-hidden bg-black block">
                {m.kind === "video" ? (
                  <video src={m.url} muted className="w-full h-full object-cover" />
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
              {(m.event_title || m.caption) && (
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-fg)] line-clamp-1 px-1">
                  {m.event_title || m.caption}
                </div>
              )}
              {isAdmin && (
                <button onClick={() => onDelete(m.media_id)}
                        className="absolute top-1 right-1 w-7 h-7 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0_#111]"
                        data-testid={`del-${m.media_id}`}>
                  <Trash size={12} weight="bold" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
