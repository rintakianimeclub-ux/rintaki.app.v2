import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import { VideoCamera, Plus, X, Play } from "@phosphor-icons/react";

function embedUrl(u) {
  if (!u) return null;
  // Youtube short/long
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = u.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return u;
}

export default function Videos() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", url: "", thumbnail: "" });

  const load = useCallback(async () => {
    const { data } = await api.get("/videos");
    setItems(data.videos || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/videos", form);
    setOpen(false);
    setForm({ title: "", description: "", url: "", thumbnail: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-black text-4xl">Videos</h1>
          <p className="text-[var(--muted-fg)]">Club videos, interviews, convention highlights.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} data-testid="new-video-btn">
            <Plus size={16} weight="bold" /> Add video
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No videos yet" icon={VideoCamera} body={isAdmin ? "Add the first one!" : "Check back soon."} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
          {items.map((v) => (
            <button key={v.video_id} onClick={() => setSelected(v)} className="text-left group" data-testid={`video-${v.video_id}`}>
              <Card className="p-0 overflow-hidden">
                <div className="aspect-video bg-black relative border-b-2 border-black overflow-hidden">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-black to-[var(--primary)]" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-[var(--primary)] text-white border-2 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0_#111]">
                      <Play size={22} weight="fill" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-black text-lg leading-tight">{v.title}</h3>
                  <p className="text-sm text-[var(--muted-fg)] line-clamp-2">{v.description}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl" data-testid="video-modal">
            <div className="aspect-video border-2 border-black bg-black rounded-xl overflow-hidden shadow-[8px_8px_0_#fff]">
              <iframe src={embedUrl(selected.url)} title={selected.title} allowFullScreen className="w-full h-full" />
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="font-black text-2xl text-white">{selected.title}</h2>
                <p className="text-white/80 text-sm">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center">
                <X size={16} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-lg p-6 shadow-[8px_8px_0_#111]" data-testid="new-video-form">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-2xl">Add video</h2>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={16} weight="bold" /></button>
            </div>
            <div className="space-y-3">
              <Input required placeholder="Title" value={form.title} data-testid="video-title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input required placeholder="YouTube / Vimeo / direct URL" value={form.url} data-testid="video-url" onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <Input placeholder="Thumbnail URL (optional)" value={form.thumbnail} data-testid="video-thumb" onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} />
              <Textarea rows={3} placeholder="Description (optional)" value={form.description} data-testid="video-desc" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="video-submit">Publish</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
