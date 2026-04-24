import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Input } from "@/components/ui-brutal";
import { ArrowLeft, CheckCircle, Plus, X, ArrowsClockwise, Trash } from "@phosphor-icons/react";

export default function TCGCollection() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [collection, setCollection] = useState(null);
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState(new Set());
  const [viewOwnedOnly, setViewOwnedOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", image_url: "", rarity: "Common", number: "" });
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState("");

  const load = useCallback(async () => {
    const [cols, data] = await Promise.all([
      api.get("/tcg/collections"),
      api.get(`/tcg/collections/${id}/cards`),
    ]);
    const col = (cols.data.collections || []).find((c) => c.collection_id === id);
    setCollection(col);
    setCards(data.data.cards || []);
    setOwned(new Set(data.data.owned_ids || []));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (card) => {
    const { data } = await api.post(`/tcg/toggle-card/${card.card_id}`);
    setOwned((prev) => {
      const s = new Set(prev);
      if (data.owned) s.add(card.card_id); else s.delete(card.card_id);
      return s;
    });
  };

  const addCard = async (e) => {
    e.preventDefault();
    await api.post("/tcg/cards", { ...newCard, collection_id: id });
    setAddOpen(false);
    setNewCard({ name: "", image_url: "", rarity: "Common", number: "" });
    load();
  };

  const visible = viewOwnedOnly ? cards.filter((c) => owned.has(c.card_id)) : cards;
  const progress = cards.length > 0 ? Math.round((owned.size / cards.length) * 100) : 0;

  if (!collection) return <div className="py-8">Loading...</div>;

  return (
    <div className="space-y-4">
      <Link to="/tcg" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" data-testid="back-tcg">
        <ArrowLeft size={14} weight="bold" /> Back to cards
      </Link>

      <Card className="p-4">
        <h1 className="font-black text-2xl">{collection.name}</h1>
        <p className="text-sm text-[var(--muted-fg)]">{collection.description}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest mb-1">
            <span>{owned.size}/{cards.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 border-2 border-black rounded-full overflow-hidden bg-white">
            <div className="h-full bg-[var(--primary)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setViewOwnedOnly(false)} data-testid="view-all"
                  className={`sticker ${!viewOwnedOnly ? "bg-black text-white" : "bg-white"}`}>All ({cards.length})</button>
          <button onClick={() => setViewOwnedOnly(true)} data-testid="view-owned"
                  className={`sticker ${viewOwnedOnly ? "bg-[var(--primary)] text-white" : "bg-white"}`}>My cards ({owned.size})</button>
          <Link to={`/tcg/claim?collection=${id}`} className="sticker bg-[var(--secondary)] ml-auto" data-testid="claim-from-col">Claim award →</Link>
        </div>
      </Card>

      {isAdmin && (
        <div className="flex gap-2">
          {collection.source_url && (
            <Button variant="accent" onClick={async () => {
              setResyncing(true);
              setResyncMsg("");
              try {
                const { data } = await api.post(`/tcg/collections/${id}/resync`);
                const parts = [];
                if (data.added) parts.push(`+${data.added} new`);
                if (data.relabeled) parts.push(`relabeled ${data.relabeled}`);
                setResyncMsg(parts.length ? `✓ ${parts.join(" · ")}.` : "Up to date — no changes.");
                await load();
              } catch (e) {
                setResyncMsg(e.response?.data?.detail || "Resync failed");
              } finally { setResyncing(false); }
            }} disabled={resyncing} className="flex-1" data-testid="resync-btn">
              <ArrowsClockwise size={14} weight="bold" className={resyncing ? "animate-spin" : ""} />
              {resyncing ? "Resyncing…" : "Re-sync from website"}
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)} variant="ghost" className={collection.source_url ? "" : "w-full"} data-testid="add-card-btn">
            <Plus size={14} weight="bold" /> Add card
          </Button>
        </div>
      )}
      {resyncMsg && <div className={`text-sm font-bold ${resyncMsg.startsWith("✓") ? "text-green-700" : "text-[var(--primary)]"}`}>{resyncMsg}</div>}

      <div className="grid grid-cols-2 gap-3">
        {visible.map((c) => {
          const has = owned.has(c.card_id);
          return (
            <div key={c.card_id} className="relative" data-testid={`card-wrap-${c.card_id}`}>
              <button onClick={() => toggle(c)} data-testid={`card-${c.card_id}`}
                      className={`relative block w-full brutal rounded-lg overflow-hidden bg-white text-left transition ${has ? "" : "opacity-35 grayscale"}`}>
                <div className="aspect-[2/3] bg-[var(--muted)]">
                  <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-2">
                  <div className="font-black text-sm truncate">{c.name}</div>
                </div>
                {has && (
                  <div className="absolute top-1.5 right-1.5 w-7 h-7 bg-[var(--primary)] text-white rounded-full flex items-center justify-center border-2 border-black">
                    <CheckCircle size={15} weight="fill" />
                  </div>
                )}
              </button>
              {isAdmin && (
                <button
                  onClick={async (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (!window.confirm(`Delete card "${c.name}"? This cannot be undone.`)) return;
                    try {
                      await api.delete(`/tcg/cards/${c.card_id}`);
                      load();
                    } catch (err) {
                      alert(err.response?.data?.detail || "Delete failed");
                    }
                  }}
                  data-testid={`del-card-${c.card_id}`}
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0_#111]"
                  title="Delete card"
                >
                  <Trash size={11} weight="bold" />
                </button>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <div className="col-span-2 text-center text-sm text-[var(--muted-fg)] py-6">No cards to show.</div>}
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setAddOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={addCard}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Add card</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <div className="space-y-3">
              <Input required placeholder="Card name" value={newCard.name} onChange={(e) => setNewCard({ ...newCard, name: e.target.value })} />
              <Input required placeholder="Image URL" value={newCard.image_url} onChange={(e) => setNewCard({ ...newCard, image_url: e.target.value })} />
              <Input placeholder="Number (e.g., 001)" value={newCard.number} onChange={(e) => setNewCard({ ...newCard, number: e.target.value })} />
              <select value={newCard.rarity} onChange={(e) => setNewCard({ ...newCard, rarity: e.target.value })}
                      className="w-full rounded-lg border-2 border-black px-4 py-3 bg-white font-medium shadow-[3px_3px_0_#111]">
                {["Common", "Rare", "Legendary", "Secret"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full mt-3">Add card</Button>
          </form>
        </div>
      )}
    </div>
  );
}
