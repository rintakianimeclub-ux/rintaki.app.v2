import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Sticker, EmptyState, Input, Textarea } from "@/components/ui-brutal";
import TradingCardGuide from "@/components/TradingCardGuide";
import { CreditCard, Trophy, ArrowsLeftRight, PaperPlaneTilt, Plus, CaretRight, Cards, X, DownloadSimple, Spinner } from "@phosphor-icons/react";

export default function TCGHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [collections, setCollections] = useState([]);
  const [mine, setMine] = useState([]);
  const [trades, setTrades] = useState([]);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncForm, setSyncForm] = useState({ name: "", description: "", cover_image: "", source_url: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const load = async () => {
    const [cols, my, tr] = await Promise.all([
      api.get("/tcg/collections"),
      api.get("/tcg/my-collection"),
      api.get("/tcg/trades").catch(() => ({ data: { trades: [] } })),
    ]);
    setCollections(cols.data.collections || []);
    setMine(my.data.cards || []);
    setTrades(tr.data.trades || []);
  };
  useEffect(() => { load(); }, []);

  const sync = async (e) => {
    e.preventDefault();
    setSyncing(true);
    setSyncMsg("");
    try {
      const { data } = await api.post("/tcg/collections/sync", syncForm);
      setSyncMsg(`✓ Added ${data.added} cards`);
      setSyncForm({ name: "", description: "", cover_image: "", source_url: "" });
      setTimeout(() => { setSyncOpen(false); setSyncMsg(""); load(); }, 1400);
    } catch (err) {
      setSyncMsg(err.response?.data?.detail || "Sync failed");
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><CreditCard size={28} weight="fill" className="text-[var(--primary)]" /> Trading Cards</h1>
        <p className="text-[var(--muted-fg)] text-sm">Track your collection, claim awards & trade with the club.</p>
      </div>

      <TradingCardGuide />

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[var(--primary)] text-white p-3" data-testid="tcg-stat-owned">
          <Cards size={20} weight="fill" />
          <div className="font-black text-3xl mt-1">{mine.length}</div>
          <div className="text-xs uppercase tracking-widest">Cards owned</div>
        </Card>
        <Card className="bg-[var(--secondary)] p-3" data-testid="tcg-stat-sets">
          <Trophy size={20} weight="fill" />
          <div className="font-black text-3xl mt-1">{collections.length}</div>
          <div className="text-xs uppercase tracking-widest">Collections</div>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-black text-xl">Collections</h2>
          {isAdmin && (
            <Button onClick={() => setSyncOpen(true)} variant="dark" className="!py-1.5 !px-3 !text-xs" data-testid="new-collection-btn">
              <Plus size={12} weight="bold" /> New from URL
            </Button>
          )}
        </div>
        {collections.length === 0 ? (
          <EmptyState title="No collections yet" icon={Cards} body={isAdmin ? "Tap 'New from URL' to import from rintaki.org." : ""} />
        ) : (
          <div className="space-y-3">
            {collections.map((c) => (
              <Link key={c.collection_id} to={`/tcg/collections/${c.collection_id}`} data-testid={`col-${c.collection_id}`}>
                <Card className="p-3 flex items-center gap-3">
                  {c.cover_image && <img src={c.cover_image} alt="" className="w-16 h-16 rounded-lg border-2 border-black object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-black">{c.name}</div>
                    <div className="text-xs text-[var(--muted-fg)] line-clamp-2">{c.description}</div>
                    {c.source_url && <div className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest mt-0.5">↻ Synced</div>}
                  </div>
                  <CaretRight size={18} weight="bold" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-black text-xl mb-2">Submit a form</h2>
        <div className="space-y-2">
          <Link to="/tcg/claim" data-testid="form-claim">
            <Card className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--secondary)] border-2 border-black rounded-full flex items-center justify-center"><Trophy size={18} weight="fill" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-black">Claim Prize</div>
                <div className="text-xs text-[var(--muted-fg)]">Completed a full collection? Submit proof for $25–$100.</div>
              </div>
              <CaretRight size={18} weight="bold" />
            </Card>
          </Link>
          <Link to="/tcg/tradein" data-testid="form-tradein">
            <Card className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--accent)] border-2 border-black rounded-full flex items-center justify-center"><PaperPlaneTilt size={18} weight="fill" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-black">Trade-In</div>
                <div className="text-xs text-[var(--muted-fg)]">Send extra cards to the club for cash or Anime Cash.</div>
              </div>
              <CaretRight size={18} weight="bold" />
            </Card>
          </Link>
          <Link to="/tcg/trade" data-testid="form-trade">
            <Card className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--primary)] text-white border-2 border-black rounded-full flex items-center justify-center"><ArrowsLeftRight size={18} weight="fill" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-black">Trade with Someone</div>
                <div className="text-xs text-[var(--muted-fg)]">Middleman trade between two people, handled by the club.</div>
              </div>
              <CaretRight size={18} weight="bold" />
            </Card>
          </Link>
        </div>
      </div>

      {trades.length > 0 && (
        <div>
          <h2 className="font-black text-xl mb-2">My trades</h2>
          <div className="space-y-2">
            {trades.map((t) => (
              <Card key={t.trade_id} className="p-3" data-testid={`trade-${t.trade_id}`}>
                <div className="text-xs uppercase tracking-widest font-black text-[var(--muted-fg)]">{t.status}</div>
                <div className="font-bold">{t.from_name} → {t.to_name}</div>
                <div className="text-xs text-[var(--muted-fg)]">{t.notes}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sync new collection modal */}
      {syncOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setSyncOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={sync}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="sync-collection-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Import collection</h2>
              <button type="button" onClick={() => setSyncOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <p className="text-xs text-[var(--muted-fg)] mb-3">
              Paste a rintaki.org page URL that displays this collection's card images. The app will scan every image on the page and create cards.
            </p>
            <div className="space-y-3">
              <Input required placeholder="Collection name (e.g., Fashionista 2026)" value={syncForm.name}
                     data-testid="sync-name" onChange={(e) => setSyncForm({ ...syncForm, name: e.target.value })} />
              <Input required placeholder="https://rintaki.org/your-cards-page/" value={syncForm.source_url}
                     data-testid="sync-url" onChange={(e) => setSyncForm({ ...syncForm, source_url: e.target.value })} />
              <Input placeholder="Cover image URL (optional — defaults to 1st card)" value={syncForm.cover_image}
                     data-testid="sync-cover" onChange={(e) => setSyncForm({ ...syncForm, cover_image: e.target.value })} />
              <Textarea rows={2} placeholder="Description (optional)" value={syncForm.description}
                        data-testid="sync-desc" onChange={(e) => setSyncForm({ ...syncForm, description: e.target.value })} />
            </div>
            {syncMsg && <div className={`mt-3 text-sm font-bold ${syncMsg.startsWith("✓") ? "text-[var(--accent)]" : "text-[var(--primary)]"}`}>{syncMsg}</div>}
            <Button type="submit" disabled={syncing} className="w-full mt-4" data-testid="sync-submit">
              {syncing ? <><Spinner size={14} className="animate-spin" /> Importing…</> : <><DownloadSimple size={14} weight="bold" /> Import cards</>}
            </Button>
            <p className="text-[10px] text-center text-[var(--muted-fg)] mt-2">
              Tip: name files <code>001-rin.jpg</code>, <code>002-aiko-rare.jpg</code> — number & rarity will be auto-filled.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
