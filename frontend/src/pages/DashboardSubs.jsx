import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import { ArrowLeft, Plus, X, Gift, Confetti, Airplane, Article, CreditCard, DiscordLogo, ShoppingCart, ArrowSquareOut } from "@phosphor-icons/react";
import { sanitizeHtml } from "@/lib/sanitize";

export function Trips() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", destination: "", starts_at: "", price: 0, cover_image: "", signup_link: "" });

  const load = async () => { const { data } = await api.get("/trips"); setItems(data.trips || []); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/trips", { ...form, price: parseFloat(form.price) || 0, starts_at: new Date(form.starts_at).toISOString() });
    setOpen(false);
    setForm({ title: "", description: "", destination: "", starts_at: "", price: 0, cover_image: "", signup_link: "" });
    load();
  };

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-black text-3xl flex items-center gap-2"><Airplane size={26} weight="fill" className="text-[var(--primary)]" /> Trips & conventions</h1>
          <p className="text-[var(--muted-fg)] text-sm">Members-only travel.</p>
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)} data-testid="new-trip-btn"><Plus size={14} weight="bold" /></Button>}
      </div>

      {items.length === 0 ? <EmptyState title="No trips yet" icon={Airplane} /> : (
        <div className="space-y-3">
          {items.map((t) => (
            <Card key={t.trip_id} className="p-0 overflow-hidden" data-testid={`trip-${t.trip_id}`}>
              {t.cover_image && <div className="aspect-[16/9] border-b-2 border-black"><img src={t.cover_image} className="w-full h-full object-cover" alt="" /></div>}
              <div className="p-4">
                <Sticker color="accent">{new Date(t.starts_at).toLocaleDateString()}</Sticker>
                <h3 className="font-black text-xl mt-2">{t.title}</h3>
                <p className="text-xs font-bold uppercase tracking-widest mt-1">{t.destination}</p>
                <p className="text-sm mt-1 text-[var(--muted-fg)]">{t.description}</p>
                {t.price > 0 && <div className="mt-2 font-black">${t.price.toFixed(2)}</div>}
                {t.signup_link && <a href={t.signup_link} target="_blank" rel="noreferrer"><Button className="mt-3 w-full">Sign up</Button></a>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]">
            <div className="flex justify-between items-center mb-3"><h2 className="font-black text-xl">New trip</h2><button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button></div>
            <div className="space-y-3">
              <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              <Input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              <Input type="number" step="0.01" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <Input placeholder="Cover image URL" value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
              <Input placeholder="Signup link (optional)" value={form.signup_link} onChange={(e) => setForm({ ...form, signup_link: e.target.value })} />
              <Textarea rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" className="w-full mt-3">Publish</Button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Giveaways() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [params] = useSearchParams();
  const typeFilter = params.get("type"); // "anime_item" | "gift_card" | null
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", prize_type: typeFilter || "anime_item", ends_at: "", cover_image: "" });

  const load = async () => { const { data } = await api.get("/giveaways"); setItems(data.giveaways || []); };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (typeFilter) setForm((f) => ({ ...f, prize_type: typeFilter })); }, [typeFilter]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/giveaways", { ...form, ends_at: new Date(form.ends_at).toISOString() });
    setOpen(false);
    setForm({ title: "", description: "", prize_type: typeFilter || "anime_item", ends_at: "", cover_image: "" });
    load();
  };

  const enter = async (id) => { await api.post(`/giveaways/${id}/enter`); load(); };

  const filtered = typeFilter ? items.filter((g) => g.prize_type === typeFilter) : items;
  const pageTitle = typeFilter === "gift_card" ? "Gift Card Give Away" : typeFilter === "anime_item" ? "Anime Give Away" : "Giveaways";
  const pageDesc = typeFilter === "gift_card" ? "Monthly gift card drawings." : typeFilter === "anime_item" ? "Monthly anime prizes." : "Monthly prizes for members.";

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-black text-3xl flex items-center gap-2"><Gift size={26} weight="fill" className="text-[var(--primary)]" /> {pageTitle}</h1>
          <p className="text-[var(--muted-fg)] text-sm">{pageDesc}</p>
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)} data-testid="new-giveaway-btn"><Plus size={14} weight="bold" /></Button>}
      </div>

      {filtered.length === 0 ? <EmptyState title={`No ${pageTitle.toLowerCase()} yet`} icon={Gift} /> : (
        <div className="space-y-3">
          {filtered.map((g) => (
            <Card key={g.giveaway_id} className="p-0 overflow-hidden" data-testid={`giveaway-${g.giveaway_id}`}>
              {g.cover_image && <div className="aspect-[16/9] border-b-2 border-black"><img src={g.cover_image} className="w-full h-full object-cover" alt="" /></div>}
              <div className="p-4">
                <div className="flex gap-2 flex-wrap">
                  <Sticker color="secondary">{g.prize_type === "gift_card" ? "Gift Card" : "Anime Item"}</Sticker>
                  <Sticker color="accent">Ends {new Date(g.ends_at).toLocaleDateString()}</Sticker>
                  <Sticker color="white">{g.entry_count} entered</Sticker>
                </div>
                <h3 className="font-black text-xl mt-2">{g.title}</h3>
                <p className="text-sm text-[var(--muted-fg)]">{g.description}</p>
                <Button onClick={() => enter(g.giveaway_id)} disabled={g.entered} className="w-full mt-3" data-testid={`enter-${g.giveaway_id}`}>
                  {g.entered ? "Entered ✓" : "Enter giveaway"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]">
            <div className="flex justify-between items-center mb-3"><h2 className="font-black text-xl">New giveaway</h2><button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button></div>
            <div className="space-y-3">
              <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select value={form.prize_type} onChange={(e) => setForm({ ...form, prize_type: e.target.value })} className="w-full rounded-lg border-2 border-black px-4 py-3 bg-white font-medium shadow-[3px_3px_0_#111]">
                <option value="anime_item">Anime item</option>
                <option value="gift_card">Gift card</option>
              </select>
              <Input type="datetime-local" required value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              <Input placeholder="Cover image URL" value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
            </div>
            <Button type="submit" className="w-full mt-3">Publish</Button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Contests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", rules: "", ends_at: "", cover_image: "", prize: "" });

  const load = async () => { const { data } = await api.get("/contests"); setItems(data.contests || []); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/contests", { ...form, ends_at: new Date(form.ends_at).toISOString() });
    setOpen(false);
    setForm({ title: "", description: "", rules: "", ends_at: "", cover_image: "", prize: "" });
    load();
  };

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-black text-3xl flex items-center gap-2"><Confetti size={26} weight="fill" className="text-[var(--primary)]" /> Contests</h1>
          <p className="text-[var(--muted-fg)] text-sm">Members-only competitions.</p>
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)} data-testid="new-contest-btn"><Plus size={14} weight="bold" /></Button>}
      </div>

      {items.length === 0 ? <EmptyState title="No contests yet" icon={Confetti} /> : (
        <div className="space-y-3">
          {items.map((c) => (
            <Card key={c.contest_id} className="p-0 overflow-hidden" data-testid={`contest-${c.contest_id}`}>
              {c.cover_image && <div className="aspect-[16/9] border-b-2 border-black"><img src={c.cover_image} className="w-full h-full object-cover" alt="" /></div>}
              <div className="p-4">
                <Sticker color="accent">Ends {new Date(c.ends_at).toLocaleDateString()}</Sticker>
                <h3 className="font-black text-xl mt-2">{c.title}</h3>
                <p className="text-sm text-[var(--muted-fg)]">{c.description}</p>
                {c.prize && <div className="mt-2 text-xs font-black uppercase tracking-widest">Prize: {c.prize}</div>}
                {c.rules && <div className="text-xs mt-1 text-[var(--muted-fg)] whitespace-pre-wrap">{c.rules}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]">
            <div className="flex justify-between items-center mb-3"><h2 className="font-black text-xl">New contest</h2><button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button></div>
            <div className="space-y-3">
              <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Textarea rows={3} placeholder="Rules" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
              <Input placeholder="Prize" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} />
              <Input type="datetime-local" required value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              <Input placeholder="Cover image URL" value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
            </div>
            <Button type="submit" className="w-full mt-3">Publish</Button>
          </form>
        </div>
      )}
    </div>
  );
}

export function SubmitArticle() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "", email: "", member_id: "", content: "",
    file_name: "", file_mime: "", file_data_b64: "", file_size: 0,
  });
  const [items, setItems] = useState([]);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prefill name/email from the logged-in user
  useEffect(() => {
    setForm((f) => ({ ...f, name: user?.name || "", email: user?.email || "" }));
  }, [user?.name, user?.email]);

  const load = async () => { const { data } = await api.get("/articles"); setItems(data.articles || []); };
  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErr("File too large (max 10 MB)"); return; }
    // Convert to base64
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setForm((f) => ({ ...f, file_name: file.name, file_mime: file.type || "application/octet-stream", file_data_b64: b64, file_size: file.size }));
    setErr("");
  };

  const clearFile = () => setForm((f) => ({ ...f, file_name: "", file_mime: "", file_data_b64: "", file_size: 0 }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.content.trim() && !form.file_data_b64) {
      setErr("Please add your poem/article text OR upload a file.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/articles", form);
      setSent(true);
      setForm((f) => ({ ...f, content: "", file_name: "", file_mime: "", file_data_b64: "", file_size: 0 }));
      setTimeout(() => setSent(false), 3000);
      load();
    } catch (ex) {
      setErr(ex.response?.data?.detail || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Article size={26} weight="fill" className="text-[var(--primary)]" /> Article Submission</h1>
        <p className="text-[var(--muted-fg)] text-sm">
          Upload your article as Word or PDF, or type it in the box below. Artwork must be JPEG only. Admin approves → you earn points.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3" data-testid="article-form">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest">Name</label>
          <Input placeholder="Your name" data-testid="art-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest">Email *</label>
          <Input required type="email" placeholder="you@example.com" data-testid="art-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest">Member ID Number *</label>
          <Input required placeholder="Your member ID" data-testid="art-member-id" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest">Upload File (JPEG, DOC, PDF)</label>
          {form.file_name ? (
            <div className="flex items-center justify-between gap-2 bg-[var(--secondary)] border-2 border-black rounded-lg px-3 py-2 mt-1" data-testid="art-file-chip">
              <div className="flex items-center gap-2 min-w-0">
                <Article size={16} weight="fill" />
                <div className="min-w-0">
                  <div className="font-black text-sm truncate">{form.file_name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest">{(form.file_size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button type="button" onClick={clearFile} className="w-7 h-7 border-2 border-black rounded-full flex items-center justify-center" data-testid="art-clear-file">
                <X size={12} weight="bold" />
              </button>
            </div>
          ) : (
            <label className="block mt-1 cursor-pointer">
              <div className="border-2 border-dashed border-black rounded-lg py-4 text-center font-bold text-sm bg-white hover:bg-[var(--secondary)] transition">
                Tap to choose a file
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] mt-1">JPEG · DOC · DOCX · PDF · max 10 MB</div>
              </div>
              <input type="file" accept=".jpg,.jpeg,.doc,.docx,.pdf,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                     className="hidden" onChange={onFile} data-testid="art-file-input" />
            </label>
          )}
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest">Poem / Article</label>
          <Textarea rows={8} placeholder="Or type your submission here…" data-testid="art-content"
                    value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </div>

        {err && <div className="bg-[var(--primary)] text-white border-2 border-black rounded-lg px-3 py-2 text-sm font-bold" data-testid="art-err">{err}</div>}

        <Button type="submit" disabled={submitting} className="w-full" data-testid="art-submit">
          {submitting ? "Sending…" : sent ? "✓ Sent!" : "Send"}
        </Button>
        <p className="text-[10px] text-center text-[var(--muted-fg)] font-bold uppercase tracking-widest">
          +25 pts when admin approves · +50 pts if published in Otaku World
        </p>
      </form>

      <div>
        <h2 className="font-black text-xl mb-2">My submissions</h2>
        {items.length === 0 ? <p className="text-sm text-[var(--muted-fg)]">None yet.</p> : (
          <div className="space-y-2">
            {items.map((a) => (
              <Card key={a.article_id} className="p-3" data-testid={`sub-${a.article_id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{a.title || a.file_name || "Untitled"}</div>
                    <div className="text-xs text-[var(--muted-fg)]">
                      {a.file_name ? "File · " : ""}{new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`sticker ${a.status === "approved" ? "bg-[var(--accent)]" : "bg-[var(--secondary)]"}`}>{a.status}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MembersShop() {
  // Keep the export name `MembersShop` so the import in App.js still works,
  // but present it as the members-only "Catalog" (products tagged `members` on WooCommerce).
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/shop/members-catalog")
      .then(({ data }) => {
        setProducts(data.products || []);
        setInfo({ source: data.source, admin_hint: data.admin_hint });
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const decode = (s = "") => { const d = document.createElement("textarea"); d.innerHTML = sanitizeHtml(s); return d.value; };
  const strip = (s = "") => { const d = document.createElement("div"); d.innerHTML = sanitizeHtml(s); return (d.textContent || "").replace(/\s+/g, " ").trim(); };

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><CreditCard size={26} weight="fill" className="text-[var(--primary)]" /> Catalog</h1>
        <p className="text-[var(--muted-fg)] text-sm">Members-only products from rintaki.org.</p>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--muted-fg)]">Loading…</div>
      ) : products.length === 0 ? (
        <Card className="text-center space-y-2">
          <EmptyState title="No members products yet" body="This catalog shows products tagged 'members' on rintaki.org." icon={CreditCard} />
          {info?.admin_hint && (
            <div className="bg-[var(--secondary)] border-2 border-black rounded-lg px-3 py-2 text-xs text-left font-bold" data-testid="catalog-admin-hint">
              ⚙️ Admin: {info.admin_hint}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button key={p.id} onClick={() => setDetail(p)} data-testid={`catalog-product-${p.id}`} className="text-left">
              <Card className="p-0 overflow-hidden h-full flex flex-col">
                <div className="aspect-square border-b-2 border-black bg-black overflow-hidden">
                  {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="p-2">
                  <h3 className="font-black text-sm leading-tight line-clamp-2">{decode(p.name)}</h3>
                  <div className="font-black text-lg mt-1">{p.price}</div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()}
               className="bg-white border-2 border-black rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-[6px_6px_0_#111] max-h-[92vh] flex flex-col" data-testid="catalog-detail">
            <div className="flex items-center justify-between p-3 border-b-2 border-black sticky top-0 bg-white z-10">
              <div className="font-black text-sm uppercase tracking-widest line-clamp-1">{decode(detail.name)}</div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center">
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {detail.image && <div className="aspect-square bg-black border-b-2 border-black overflow-hidden"><img src={detail.image} alt="" className="w-full h-full object-contain" /></div>}
              <div className="p-4 space-y-3">
                <h2 className="font-black text-xl">{decode(detail.name)}</h2>
                <div className="font-black text-2xl">{detail.price}</div>
                {detail.short_description && <p className="text-sm">{strip(detail.short_description)}</p>}
                {detail.description && <div className="text-sm text-[var(--muted-fg)]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail.description) }} />}
              </div>
            </div>
            <div className="p-3 border-t-2 border-black bg-white">
              <a href={detail.add_to_cart_url} target="_blank" rel="noreferrer">
                <Button className="w-full"><ShoppingCart size={16} weight="fill" /> Add to cart — {detail.price} <ArrowSquareOut size={12} weight="bold" /></Button>
              </a>
              <p className="text-[10px] text-center text-[var(--muted-fg)] font-bold uppercase tracking-widest mt-2">Secure checkout on rintaki.org</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MembersDiscord() {
  const [url, setUrl] = useState("");
  useEffect(() => { api.get("/links").then(({ data }) => setUrl(data.social?.discord_members || "")); }, []);
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><DiscordLogo size={26} weight="fill" className="text-[#5865F2]" /> Members Discord</h1>
        <p className="text-[var(--muted-fg)] text-sm">Our private server, invite-only for paid members.</p>
      </div>
      <Card className="bg-[#5865F2] text-white">
        <p className="text-sm">Join the conversation — events coordination, trade chats, and late-night anime debates.</p>
        <a href={url} target="_blank" rel="noreferrer" className="block mt-3" data-testid="discord-open">
          <Button variant="ghost" className="w-full">Open members Discord →</Button>
        </a>
      </Card>
    </div>
  );
}
