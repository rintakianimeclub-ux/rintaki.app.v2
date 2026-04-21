import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import { ArrowLeft, Plus, X, Gift, Confetti, Airplane, Article, ShoppingBag, DiscordLogo } from "@phosphor-icons/react";

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
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", prize_type: "anime_item", ends_at: "", cover_image: "" });

  const load = async () => { const { data } = await api.get("/giveaways"); setItems(data.giveaways || []); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/giveaways", { ...form, ends_at: new Date(form.ends_at).toISOString() });
    setOpen(false);
    setForm({ title: "", description: "", prize_type: "anime_item", ends_at: "", cover_image: "" });
    load();
  };

  const enter = async (id) => { await api.post(`/giveaways/${id}/enter`); load(); };

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-black text-3xl flex items-center gap-2"><Gift size={26} weight="fill" className="text-[var(--primary)]" /> Giveaways</h1>
          <p className="text-[var(--muted-fg)] text-sm">Monthly prizes for members.</p>
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)} data-testid="new-giveaway-btn"><Plus size={14} weight="bold" /></Button>}
      </div>

      {items.length === 0 ? <EmptyState title="No giveaways yet" icon={Gift} /> : (
        <div className="space-y-3">
          {items.map((g) => (
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
  const [form, setForm] = useState({ title: "", kind: "blog", summary: "", content: "" });
  const [items, setItems] = useState([]);
  const [sent, setSent] = useState(false);

  const load = async () => { const { data } = await api.get("/articles"); setItems(data.articles || []); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/articles", form);
    setForm({ title: "", kind: "blog", summary: "", content: "" });
    setSent(true);
    setTimeout(() => setSent(false), 2500);
    load();
  };

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Article size={26} weight="fill" className="text-[var(--primary)]" /> Submit article</h1>
        <p className="text-[var(--muted-fg)] text-sm">Admin approves → you earn points. Blog = +25 · Magazine = +50.</p>
      </div>

      <form onSubmit={submit} className="space-y-3" data-testid="article-form">
        <div className="flex gap-2">
          {[["blog", "Blog"], ["magazine", "Magazine"]].map(([v, l]) => (
            <button type="button" key={v} onClick={() => setForm({ ...form, kind: v })}
                    data-testid={`article-kind-${v}`}
                    className={`flex-1 border-2 border-black rounded-full py-2 font-bold text-sm ${form.kind === v ? "bg-[var(--primary)] text-white" : "bg-white"}`}>{l}</button>
          ))}
        </div>
        <Input required placeholder="Title" value={form.title} data-testid="article-title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="One-line summary" value={form.summary} data-testid="article-summary" onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        <Textarea required rows={8} placeholder="Write your article..." value={form.content} data-testid="article-content" onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <Button type="submit" className="w-full" data-testid="article-submit">{sent ? "Submitted!" : "Submit for review"}</Button>
      </form>

      <div>
        <h2 className="font-black text-xl mb-2">My submissions</h2>
        {items.length === 0 ? <p className="text-sm text-[var(--muted-fg)]">None yet.</p> : (
          <div className="space-y-2">
            {items.map((a) => (
              <Card key={a.article_id} className="p-3" data-testid={`sub-${a.article_id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{a.title}</div>
                    <div className="text-xs text-[var(--muted-fg)]">{a.kind} · {new Date(a.created_at).toLocaleDateString()}</div>
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
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><ShoppingBag size={26} weight="fill" className="text-[var(--primary)]" /> Members shop</h1>
        <p className="text-[var(--muted-fg)] text-sm">Spend points & anime cash on members-exclusive items.</p>
      </div>
      <Card>
        <p className="text-sm">Our members shop runs on WooCommerce at rintaki.org. Click below to browse and use your points + anime cash at checkout.</p>
        <a href="https://www.rintaki.org/shop" target="_blank" rel="noreferrer" className="block mt-3" data-testid="shop-open">
          <Button className="w-full">Open members shop</Button>
        </a>
      </Card>
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
