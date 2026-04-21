import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, Button, Textarea, Avatar } from "@/components/ui-brutal";
import { ArrowLeft, ArrowsLeftRight } from "@phosphor-icons/react";

export default function TCGTrade() {
  const [members, setMembers] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [partner, setPartner] = useState("");
  const [offered, setOffered] = useState(new Set());
  const [wanted, setWanted] = useState(new Set());
  const [notes, setNotes] = useState("");
  const [trades, setTrades] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [m, my, tr, cols] = await Promise.all([
      api.get("/members"),
      api.get("/tcg/my-collection"),
      api.get("/tcg/trades"),
      api.get("/tcg/collections"),
    ]);
    setMembers(m.data.members || []);
    setMyCards(my.data.cards || []);
    setTrades(tr.data.trades || []);
    // fetch all cards (from each collection) for "wanted" selection
    const all = [];
    for (const c of cols.data.collections || []) {
      try {
        const { data } = await api.get(`/tcg/collections/${c.collection_id}/cards`);
        (data.cards || []).forEach((card) => all.push({ ...card, collection_name: c.name }));
      } catch {}
    }
    setAllCards(all);
  };
  useEffect(() => { load(); }, []);

  const toggle = (set, setter, id) => {
    const s = new Set(set);
    s.has(id) ? s.delete(id) : s.add(id);
    setter(s);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!partner || offered.size === 0 || wanted.size === 0) return;
    setSubmitting(true);
    try {
      await api.post("/tcg/trade", {
        partner_user_id: partner,
        offered_card_ids: Array.from(offered),
        wanted_card_ids: Array.from(wanted),
        notes,
      });
      setOffered(new Set()); setWanted(new Set()); setNotes(""); setPartner("");
      load();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <Link to="/tcg" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl">Trade with member</h1>
        <p className="text-[var(--muted-fg)] text-sm">Proposal goes through the club. You pick what you offer & what you want.</p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="trade-form">
        <div>
          <label className="text-xs font-black uppercase tracking-widest">Partner</label>
          <select required value={partner} onChange={(e) => setPartner(e.target.value)}
                  data-testid="trade-partner"
                  className="w-full mt-1 rounded-lg border-2 border-black px-4 py-3 bg-white font-medium shadow-[3px_3px_0_#111]">
            <option value="">Pick a member</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest mb-1">Cards you're offering ({offered.size})</div>
          {myCards.length === 0 ? (
            <p className="text-sm text-[var(--muted-fg)]">No cards owned yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {myCards.map((c) => {
                const on = offered.has(c.card_id);
                return (
                  <button type="button" key={c.card_id} onClick={() => toggle(offered, setOffered, c.card_id)}
                          data-testid={`offer-${c.card_id}`}
                          className={`aspect-[2/3] rounded-lg border-2 border-black overflow-hidden ${on ? "ring-4 ring-[var(--primary)]" : ""}`}>
                    <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest mb-1">Cards you want ({wanted.size})</div>
          <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-auto p-1">
            {allCards.map((c) => {
              const on = wanted.has(c.card_id);
              return (
                <button type="button" key={c.card_id} onClick={() => toggle(wanted, setWanted, c.card_id)}
                        data-testid={`want-${c.card_id}`}
                        className={`aspect-[2/3] rounded-lg border-2 border-black overflow-hidden ${on ? "ring-4 ring-[var(--accent)]" : ""}`}>
                  <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>

        <Textarea rows={3} placeholder="Notes for partner" value={notes} data-testid="trade-notes" onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" disabled={submitting || !partner || offered.size === 0 || wanted.size === 0} className="w-full" data-testid="trade-submit">
          <ArrowsLeftRight size={14} weight="bold" /> {submitting ? "Sending..." : "Send trade request"}
        </Button>
      </form>

      {trades.length > 0 && (
        <div>
          <h2 className="font-black text-xl mb-2">My trades</h2>
          <div className="space-y-2">
            {trades.map((t) => (
              <Card key={t.trade_id} className="p-3" data-testid={`my-trade-${t.trade_id}`}>
                <div className="font-bold">{t.from_name} ↔ {t.to_name}</div>
                <div className="text-xs text-[var(--muted-fg)]">{t.offered_card_ids.length} offered · {t.wanted_card_ids.length} wanted</div>
                <span className="sticker bg-[var(--secondary)] mt-1">{t.status}</span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
