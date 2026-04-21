import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Sticker, EmptyState } from "@/components/ui-brutal";
import { CreditCard, Trophy, ArrowsLeftRight, PaperPlaneTilt, Plus, CaretRight, Cards } from "@phosphor-icons/react";

export default function TCGHome() {
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [mine, setMine] = useState([]);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    (async () => {
      const [cols, my, tr] = await Promise.all([
        api.get("/tcg/collections"),
        api.get("/tcg/my-collection"),
        api.get("/tcg/trades").catch(() => ({ data: { trades: [] } })),
      ]);
      setCollections(cols.data.collections || []);
      setMine(my.data.cards || []);
      setTrades(tr.data.trades || []);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><CreditCard size={28} weight="fill" className="text-[var(--primary)]" /> Trading Cards</h1>
        <p className="text-[var(--muted-fg)] text-sm">Track your collection, claim awards & trade with the club.</p>
      </div>

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
        <h2 className="font-black text-xl mb-2">Collections</h2>
        {collections.length === 0 ? (
          <EmptyState title="No collections yet" icon={Cards} />
        ) : (
          <div className="space-y-3">
            {collections.map((c) => (
              <Link key={c.collection_id} to={`/tcg/collections/${c.collection_id}`} data-testid={`col-${c.collection_id}`}>
                <Card className="p-3 flex items-center gap-3">
                  {c.cover_image && <img src={c.cover_image} alt="" className="w-16 h-16 rounded-lg border-2 border-black object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-black">{c.name}</div>
                    <div className="text-xs text-[var(--muted-fg)] line-clamp-2">{c.description}</div>
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
                <div className="font-black">Claim a theme set award</div>
                <div className="text-xs text-[var(--muted-fg)]">You've completed a full collection? Submit here.</div>
              </div>
              <CaretRight size={18} weight="bold" />
            </Card>
          </Link>
          <Link to="/tcg/tradein" data-testid="form-tradein">
            <Card className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--accent)] border-2 border-black rounded-full flex items-center justify-center"><PaperPlaneTilt size={18} weight="fill" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-black">Trade in cards to the club</div>
                <div className="text-xs text-[var(--muted-fg)]">Send cards back to the club for store credit.</div>
              </div>
              <CaretRight size={18} weight="bold" />
            </Card>
          </Link>
          <Link to="/tcg/trade" data-testid="form-trade">
            <Card className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--primary)] text-white border-2 border-black rounded-full flex items-center justify-center"><ArrowsLeftRight size={18} weight="fill" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-black">Trade with another member</div>
                <div className="text-xs text-[var(--muted-fg)]">Middleman trade through the club.</div>
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
    </div>
  );
}
