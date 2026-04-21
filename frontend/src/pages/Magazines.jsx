import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import { BookOpen, Plus, FilePdf, X, Trash } from "@phosphor-icons/react";

export default function Magazines() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", issue: "", pdf_url: "", cover_image: "", description: "" });

  const load = async () => {
    const { data } = await api.get("/magazines");
    setItems(data.magazines || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/magazines", form);
    setOpen(false);
    setForm({ title: "", issue: "", pdf_url: "", cover_image: "", description: "" });
    load();
  };

  const del = async (id) => {
    if (!window.confirm("Delete this magazine issue?")) return;
    await api.delete(`/magazines/${id}`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-black text-3xl">Magazine</h1>
          <p className="text-[var(--muted-fg)] text-sm">Otaku World PDF issues.</p>
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)} data-testid="new-magazine-btn"><Plus size={14} weight="bold" /> Upload</Button>}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No issues yet" icon={BookOpen} />
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <Card key={m.magazine_id} className="p-3 flex gap-3" data-testid={`magazine-${m.magazine_id}`}>
              <div className="w-24 h-32 shrink-0 border-2 border-black rounded-lg overflow-hidden bg-[var(--muted)]">
                {m.cover_image ? <img src={m.cover_image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen size={28} /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-black text-[var(--primary)]">Otaku World</div>
                <h3 className="font-black text-lg leading-tight">{m.title}</h3>
                <p className="text-xs text-[var(--muted-fg)]">{m.issue}</p>
                {m.description && <p className="text-sm mt-1 line-clamp-2">{m.description}</p>}
                <div className="flex gap-2 mt-2">
                  <Button onClick={() => setSelected(m)} className="!py-1.5 !px-3 !text-xs" data-testid={`read-${m.magazine_id}`}>
                    <FilePdf size={14} weight="fill" /> Read
                  </Button>
                  {isAdmin && (
                    <button onClick={() => del(m.magazine_id)} className="text-xs font-bold flex items-center gap-1 text-[var(--primary)]" data-testid={`del-${m.magazine_id}`}>
                      <Trash size={14} weight="bold" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={() => setSelected(null)}>
          <div className="p-2 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-white font-black truncate px-2">{selected.title}</div>
            <div className="flex gap-2">
              <a href={selected.pdf_url} target="_blank" rel="noreferrer" data-testid="magazine-download" className="bg-white border-2 border-black rounded-full px-3 py-1 text-xs font-bold">Open</a>
              <button onClick={() => setSelected(null)} className="w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
          </div>
          <iframe title={selected.title} src={selected.pdf_url} className="flex-1 bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="new-magazine-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Upload issue</h2>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <div className="space-y-3">
              <Input required placeholder="Title (e.g., Otaku World)" value={form.title} data-testid="mg-title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Issue (e.g., Vol. 5, Issue 1)" value={form.issue} data-testid="mg-issue" onChange={(e) => setForm({ ...form, issue: e.target.value })} />
              <Input required placeholder="PDF URL (rintaki.org/...)" value={form.pdf_url} data-testid="mg-pdf" onChange={(e) => setForm({ ...form, pdf_url: e.target.value })} />
              <Input placeholder="Cover image URL (optional)" value={form.cover_image} data-testid="mg-cover" onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
              <Textarea rows={2} placeholder="Short description" value={form.description} data-testid="mg-desc" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" className="w-full mt-4" data-testid="mg-submit">Publish</Button>
          </form>
        </div>
      )}
    </div>
  );
}
