import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, Button, Textarea, Input } from "@/components/ui-brutal";
import { ArrowLeft, PaperPlaneTilt } from "@phosphor-icons/react";

export default function TCGTradeIn() {
  const [cards, setCards] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [notes, setNotes] = useState("");
  const [tradeins, setTradeins] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [my, ti] = await Promise.all([
      api.get("/tcg/my-collection"),
      api.get("/tcg/tradeins"),
    ]);
    setCards(my.data.cards || []);
    setTradeins(ti.data.tradeins || []);
  };
  useEffect(() => { load(); }, []);

  const toggle = (id) => {
    setChecked((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (checked.size === 0) return;
    setSubmitting(true);
    try {
      await api.post("/tcg/tradein", { card_ids: Array.from(checked), shipping_notes: notes });
      setChecked(new Set());
      setNotes("");
      load();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <Link to="/tcg" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" data-testid="back-tcg">
        <ArrowLeft size={14} weight="bold" /> Back
      </Link>
      <div>
        <h1 className="font-black text-3xl">Trade-in to club</h1>
        <p className="text-[var(--muted-fg)] text-sm">Pick the cards you want to send back. We'll contact you with next steps.</p>
      </div>

      <form onSubmit={submit} className="space-y-3" data-testid="tradein-form">
        {cards.length === 0 ? (
          <Card><p className="text-sm text-[var(--muted-fg)]">You don't have any cards checked off yet. Go to <Link to="/tcg" className="font-bold underline">Cards</Link> and mark what you own.</p></Card>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {cards.map((c) => {
              const on = checked.has(c.card_id);
              return (
                <button type="button" key={c.card_id} onClick={() => toggle(c.card_id)}
                        data-testid={`ti-card-${c.card_id}`}
                        className={`relative brutal rounded-lg overflow-hidden bg-white ${on ? "ring-4 ring-[var(--primary)]" : ""}`}>
                  <div className="aspect-[2/3]"><img src={c.image_url} alt="" className="w-full h-full object-cover" /></div>
                  <div className="p-1.5">
                    <div className="font-black text-[11px] truncate">{c.name}</div>
                    <div className="text-[9px] uppercase tracking-widest text-[var(--muted-fg)]">{c.rarity}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <Textarea rows={3} placeholder="Shipping notes or questions" value={notes}
                  data-testid="ti-notes" onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" disabled={submitting || checked.size === 0} className="w-full" data-testid="ti-submit">
          <PaperPlaneTilt size={14} weight="fill" /> {submitting ? "Submitting..." : `Submit (${checked.size})`}
        </Button>
      </form>

      {tradeins.length > 0 && (
        <div>
          <h2 className="font-black text-xl mb-2">My trade-ins</h2>
          <div className="space-y-2">
            {tradeins.map((t) => (
              <Card key={t.tradein_id} className="p-3" data-testid={`ti-${t.tradein_id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{t.card_ids.length} cards</div>
                    <div className="text-xs text-[var(--muted-fg)]">{new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className="sticker bg-[var(--secondary)]">{t.status}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
