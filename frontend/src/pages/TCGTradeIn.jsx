import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, Sticker } from "@/components/ui-brutal";
import { ArrowLeft, PaperPlaneTilt } from "@phosphor-icons/react";

const STEPS = [
  { num: "One", title: "Fill out the form", body: "Fill out the form below and we'll email confirming your info and the cards you want to send in." },
  { num: "Two", title: "Ship your cards", body: "We send you a prepaid label. Mail your cards to our office. Once they arrive we'll email you." },
  { num: "Three", title: "Payment sent", body: "We verify the cards, send payment through your preferred method, and mail back anything unacceptable." },
];

export default function TCGTradeIn() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [tradeins, setTradeins] = useState([]);
  const [form, setForm] = useState({
    items_text: "",
    type_items: "",
    first_name: "",
    last_name: "",
    email: user?.email || "",
    member_id: "",
    payment_type: "US Dollar",
    payment_method: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get("/tcg/tradeins").then(({ data }) => setTradeins(data.tradeins || [])); }, []);

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg("");
    try {
      await api.post("/tcg/tradein", form);
      setMsg("✓ Trade-in submitted! We'll email you next steps.");
      setForm({ ...form, items_text: "", type_items: "", payment_method: "" });
      const { data } = await api.get("/tcg/tradeins");
      setTradeins(data.tradeins || []);
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
        <h1 className="font-black text-3xl">Trade-In</h1>
        <p className="text-[var(--muted-fg)] text-sm">Submit the form below to trade-in cards. Max 10 items per form.</p>
      </div>

      {/* Steps tabs */}
      <Card className="p-3">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s.num} onClick={() => setStep(i)}
                    data-testid={`tradein-step-${i+1}`}
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
        <h3 className="font-black text-sm uppercase tracking-widest">Trade-in form</h3>
        <form onSubmit={submit} className="space-y-3 mt-3" data-testid="tradein-form">
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Trade-Ins <span className="text-[var(--muted-fg)]">(max 10 items)</span> *</label>
            <p className="text-[10px] text-[var(--muted-fg)] mt-0.5">Start each line with a number. Include: Card ID#, Qty, Collection Name.</p>
            <Textarea required rows={5} placeholder={"1. FC260134, 2, Fashionista 2026\n2. FC260118, 1, Fashionista 2026"}
                      data-testid="ti-items" {...f("items_text")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Type items *</label>
            <Input required placeholder="e.g., Common, Rare, Ultra Rare" data-testid="ti-types" {...f("type_items")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Your Name *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input required placeholder="First" data-testid="ti-first" {...f("first_name")} />
              <Input required placeholder="Last" data-testid="ti-last" {...f("last_name")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Your Email *</label>
            <Input type="email" required data-testid="ti-email" {...f("email")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Member ID # <span className="text-[var(--muted-fg)]">(if you are a member)</span></label>
            <Input data-testid="ti-member-id" {...f("member_id")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Payment Type</label>
            <div className="flex gap-2 mt-1">
              {["US Dollar", "Anime Cash"].map((v) => (
                <button type="button" key={v} onClick={() => setForm({ ...form, payment_type: v })}
                        data-testid={`ti-pt-${v.toLowerCase().replace(/\s/g, "-")}`}
                        className={`flex-1 border-2 border-black rounded-full py-2 text-sm font-bold ${form.payment_type === v ? "bg-[var(--primary)] text-white" : "bg-white"}`}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Payment Method</label>
            <p className="text-[10px] text-[var(--muted-fg)] mt-0.5">List 3 preferred methods. <b>Cash App, Apple Pay, and Zelle cannot be used.</b></p>
            <Textarea rows={3} placeholder={"1. Venmo (@handle)\n2. PayPal (email)\n3. Check by mail"}
                      data-testid="ti-payment-method" {...f("payment_method")} />
          </div>
          {msg && <div className={`text-sm font-bold ${msg.startsWith("✓") ? "text-green-700" : "text-[var(--primary)]"}`}>{msg}</div>}
          <Button type="submit" disabled={submitting} className="w-full" data-testid="ti-submit">
            <PaperPlaneTilt size={14} weight="fill" /> {submitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </Card>

      {tradeins.length > 0 && (
        <div>
          <h2 className="font-black text-xl mb-2">My trade-ins</h2>
          <div className="space-y-2">
            {tradeins.map((t) => (
              <Card key={t.tradein_id} className="p-3" data-testid={`ti-${t.tradein_id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{t.first_name} {t.last_name}</div>
                    <div className="text-xs text-[var(--muted-fg)]">{t.payment_type} · {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <Sticker color="secondary">{t.status}</Sticker>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
