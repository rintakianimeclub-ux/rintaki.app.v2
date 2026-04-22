import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import {
  Calendar, Ticket, Images, FilmSlate, Plus, X, Trash, CaretRight, ArrowSquareOut, ArrowsClockwise,
} from "@phosphor-icons/react";

const KIND_META = {
  photos: { label: "Photos", icon: Images },
  videos: { label: "Videos", icon: FilmSlate },
  mixed:  { label: "Gallery", icon: Images },
};

export default function EventsGallery() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [links, setLinks] = useState([]);
  const [open, setOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncForm, setSyncForm] = useState({ source_url: "https://rintaki.org/gallery/", section_filter: "", replace: false });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [form, setForm] = useState({ title: "", url: "", kind: "mixed", cover_image: "", description: "" });

  const load = async () => {
    const { data } = await api.get("/gallery/links").catch(() => ({ data: { links: [] } }));
    setLinks(data.links || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/gallery/links", form);
    setOpen(false);
    setForm({ title: "", url: "", kind: "mixed", cover_image: "", description: "" });
    load();
  };

  const runSync = async (e) => {
    e.preventDefault();
    setSyncing(true); setSyncMsg("");
    try {
      const { data } = await api.post("/gallery/links/sync", syncForm);
      setSyncMsg(`Imported ${data.created} · skipped ${data.skipped} (already present) · found ${data.total_found}`);
      load();
    } catch (err) {
      setSyncMsg(err.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this gallery link?")) return;
    await api.delete(`/gallery/links/${id}`);
    load();
  };

  // Group by section for display
  const grouped = links.reduce((acc, g) => {
    const k = g.section || "Galleries";
    (acc[k] = acc[k] || []).push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-3xl">Events Gallery</h1>
        <p className="text-[var(--muted-fg)] text-sm">Photos & videos from our events and trips.</p>
      </div>

      {/* Top: Events + My Tickets tiles (same style as More page) */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/events" data-testid="gallery-top-events">
          <Card className="bg-[var(--primary)] text-white h-full p-3">
            <Calendar size={24} weight="fill" />
            <div className="font-black mt-2 leading-tight">Events</div>
            <div className="text-[11px] opacity-90">Upcoming & past events</div>
          </Card>
        </Link>
        <Link to="/tickets" data-testid="gallery-top-tickets">
          <Card className="bg-[var(--accent)] h-full p-3">
            <Ticket size={24} weight="fill" />
            <div className="font-black mt-2 leading-tight">My Tickets</div>
            <div className="text-[11px] opacity-80">Your purchased tickets</div>
          </Card>
        </Link>
      </div>

      {/* Admin: sync + add */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setSyncOpen(true)} variant="primary" className="w-full" data-testid="sync-gallery-btn">
            <ArrowsClockwise size={14} weight="bold" /> Sync from rintaki.org
          </Button>
          <Button onClick={() => setOpen(true)} variant="dark" className="w-full" data-testid="add-gallery-link-btn">
            <Plus size={14} weight="bold" /> Add manually
          </Button>
        </div>
      )}

      {/* Gallery link grid, grouped by section */}
      {links.length === 0 ? (
        <EmptyState title="No galleries yet" body={isAdmin ? "Tap \u201CSync from rintaki.org\u201D to import all galleries from your NextGEN album page." : "Check back soon."} icon={Images} />
      ) : (
        Object.entries(grouped).map(([section, items]) => (
          <div key={section} className="space-y-3">
            <h2 className="font-black text-xl mt-1">{section}</h2>
            <div className="space-y-3">
              {items.map((g) => {
                const meta = KIND_META[g.kind] || KIND_META.mixed;
                return (
                  <div key={g.gallery_id} className="relative" data-testid={`gallery-${g.gallery_id}`}>
                    <a href={g.url} target="_blank" rel="noreferrer">
                      <Card className="p-0 overflow-hidden">
                        {g.cover_image && (
                          <div className="aspect-[16/9] border-b-2 border-black overflow-hidden bg-black">
                            <img src={g.cover_image} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-[var(--secondary)] border-2 border-black rounded-full px-2 py-0.5">
                              <meta.icon size={12} weight="fill" /> {meta.label}
                            </div>
                            {g.photo_count != null && (
                              <div className="inline-flex items-center text-[10px] font-black uppercase tracking-widest bg-white border-2 border-black rounded-full px-2 py-0.5">
                                {g.photo_count} Photos
                              </div>
                            )}
                          </div>
                          <h3 className="font-black text-lg mt-2 leading-tight">{g.title}</h3>
                          {g.description && !g.synced && <p className="text-sm text-[var(--muted-fg)] line-clamp-2 mt-1">{g.description}</p>}
                          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] flex items-center gap-1">
                            Open gallery <ArrowSquareOut size={12} weight="bold" />
                          </div>
                        </div>
                      </Card>
                    </a>
                    {isAdmin && (
                      <button onClick={() => del(g.gallery_id)}
                              className="absolute top-2 right-2 w-8 h-8 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0_#111]"
                              data-testid={`del-gallery-${g.gallery_id}`}>
                        <Trash size={12} weight="bold" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]"
                data-testid="gallery-link-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Add gallery link</h2>
              <button type="button" onClick={() => setOpen(false)}
                      className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center">
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="space-y-3">
              <Input required placeholder="Title (e.g., AnimeNYC 2025)" value={form.title}
                     data-testid="gl-title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input required placeholder="Link URL (page of images or videos)" value={form.url}
                     data-testid="gl-url" onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest">Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {["photos", "videos", "mixed"].map((k) => (
                    <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                            data-testid={`gl-kind-${k}`}
                            className={`border-2 border-black rounded-full py-2 text-xs font-black uppercase tracking-widest ${form.kind === k ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <Input placeholder="Cover image URL (optional)" value={form.cover_image}
                     data-testid="gl-cover" onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
              <Textarea rows={2} placeholder="Description (optional)" value={form.description}
                        data-testid="gl-desc" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" className="w-full mt-3" data-testid="gl-submit">Add</Button>
          </form>
        </div>
      )}

      {/* Sync modal */}
      {syncOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => !syncing && setSyncOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={runSync}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]"
                data-testid="gallery-sync-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Sync from NextGEN album</h2>
              <button type="button" onClick={() => !syncing && setSyncOpen(false)}
                      className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center">
                <X size={14} weight="bold" />
              </button>
            </div>
            <p className="text-xs text-[var(--muted-fg)] mb-3">
              Paste the URL of any WordPress page that shows your NextGEN album (the page with the <code>[album ...]</code> shortcode). The app will scrape every child gallery and create one card per gallery.
            </p>
            <div className="space-y-3">
              <Input required placeholder="https://rintaki.org/gallery/" value={syncForm.source_url}
                     data-testid="sync-url" onChange={(e) => setSyncForm({ ...syncForm, source_url: e.target.value })} />
              <Input placeholder="Filter by section (e.g. AnimeMilwaukee) — optional" value={syncForm.section_filter}
                     data-testid="sync-section" onChange={(e) => setSyncForm({ ...syncForm, section_filter: e.target.value })} />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={syncForm.replace}
                       onChange={(e) => setSyncForm({ ...syncForm, replace: e.target.checked })}
                       data-testid="sync-replace" />
                Replace existing synced cards first
              </label>
              {syncMsg && (
                <div className="bg-[var(--secondary)] border-2 border-black rounded-lg px-3 py-2 text-sm font-bold" data-testid="sync-msg">
                  {syncMsg}
                </div>
              )}
            </div>
            <Button type="submit" disabled={syncing} className="w-full mt-3" data-testid="sync-submit">
              {syncing ? "Syncing…" : "Sync galleries"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
