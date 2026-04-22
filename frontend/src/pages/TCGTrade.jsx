import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, Sticker } from "@/components/ui-brutal";
import { ArrowLeft, ArrowsLeftRight } from "@phosphor-icons/react";

const STEPS = [
  { num: "One", title: "Verify the trade", body: "We contact you and your partner to verify the list of cards to be exchanged and request full names and addresses." },
  { num: "Two", title: "Mail your cards", body: "We send prepaid labels to you and your partner. Both parties mail cards to our office." },
  { num: "Three", title: "Cards exchanged", body: "Once both sets are received, we verify the cards against submissions and mail the traded cards to each of you. We only hold cards for 5 days — please mail ASAP." },
];

export default function TCGTrade() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState({
    items_trading: "",
    items_receiving: "",
    first_name: "",
    last_name: "",
    email: user?.email || "",
    member_id: "",
    partner_first_name: "",
    partner_last_name: "",
    partner_email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get("/tcg/trades").then(({ data }) => setTrades(data.trades || [])); }, []);

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg("");
    try {
      await api.post("/tcg/trade", form);
      setMsg("✓ Trade request submitted! We'll email both parties.");
      setForm({ ...form, items_trading: "", items_receiving: "" });
      const { data } = await api.get("/tcg/trades");
      setTrades(data.trades || []);
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Submission failed.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <Link to="/tcg" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" data-testid="back-tcg">
        <ArrowLeft size={14} weight="bold" /> Back
      </Link>
      <div>
        <h1 className="font-black text-3xl">Trade with Someone</h1>
        <p className="text-[var(--muted-fg)] text-sm">Submit trading info for yourself and your trading partner. Max 10 items per form.</p>
      </div>

      <Card className="p-3">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s.num} onClick={() => setStep(i)}
                    data-testid={`trade-step-${i+1}`}
                    className={`flex-1 border-2 border-black rounded-lg py-2 text-xs font-bold uppercase tracking-widest ${step === i ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
              Step {s.num}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <div className="font-black text-sm">{STEPS[step].title}</div>
          <p className="text-sm text-[var(--muted-fg)] mt-1 leading-relaxed">{STEPS[step].body}</p>
        </div>
      </Card>

      <Card>
        <h3 className="font-black text-sm uppercase tracking-widest">Trade form</h3>
        <form onSubmit={submit} className="space-y-3 mt-3" data-testid="trade-form">
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Item(s) Trading <span className="text-[var(--muted-fg)]">(max 10)</span> *</label>
            <p className="text-[10px] text-[var(--muted-fg)] mt-0.5">Number each line. Include: Card ID#, Qty, Collection Name.</p>
            <Textarea required rows={4} placeholder={"1. FC260134, 1, Fashionista 2026"} data-testid="trade-trading" {...f("items_trading")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Item(s) Receiving <span className="text-[var(--muted-fg)]">(max 10)</span> *</label>
            <p className="text-[10px] text-[var(--muted-fg)] mt-0.5">Number each line. Include: Card ID#, Qty, Collection Name.</p>
            <Textarea required rows={4} placeholder={"1. FC260118, 1, Fashionista 2026"} data-testid="trade-receiving" {...f("items_receiving")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Your Name *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input required placeholder="First" data-testid="trade-first" {...f("first_name")} />
              <Input required placeholder="Last" data-testid="trade-last" {...f("last_name")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Your Email *</label>
            <Input type="email" required data-testid="trade-email" {...f("email")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Member ID # <span className="text-[var(--muted-fg)]">(if you are a member)</span></label>
            <Input data-testid="trade-member-id" {...f("member_id")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Trading Partner Name *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input required placeholder="First" data-testid="trade-partner-first" {...f("partner_first_name")} />
              <Input required placeholder="Last" data-testid="trade-partner-last" {...f("partner_last_name")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Trading Partner Email *</label>
            <Input type="email" required data-testid="trade-partner-email" {...f("partner_email")} />
          </div>
          {msg && <div className={`text-sm font-bold ${msg.startsWith("✓") ? "text-green-700" : "text-[var(--primary)]"}`}>{msg}</div>}
          <Button type="submit" disabled={submitting} className="w-full" data-testid="trade-submit">
            <ArrowsLeftRight size={14} weight="bold" /> {submitting ? "Sending..." : "Submit"}
          </Button>
        </form>
      </Card>

      {trades.length > 0 && (
        <div>
          <h2 className="font-black text-xl mb-2">My trades</h2>
          <div className="space-y-2">
            {trades.map((t) => (
              <Card key={t.trade_id} className="p-3" data-testid={`my-trade-${t.trade_id}`}>
                <div className="font-bold">{t.first_name || t.from_name} ↔ {t.partner_first_name || t.to_name}</div>
                <div className="text-xs text-[var(--muted-fg)]">{new Date(t.created_at).toLocaleDateString()}</div>
                <Sticker color="secondary" className="mt-1">{t.status}</Sticker>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
