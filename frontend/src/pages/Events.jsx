import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Input, Textarea, EmptyState } from "@/components/ui-brutal";
import { Calendar, Plus, MapPin, X, Ticket, CurrencyDollar } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export default function Events() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [buyFor, setBuyFor] = useState(null);
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", starts_at: "", cover_image: "", ticket_price: "", ticket_enabled: false });

  const load = async () => { const { data } = await api.get("/events"); setEvents(data.events || []); };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { title: form.title, description: form.description, location: form.location, starts_at: new Date(form.starts_at).toISOString(), cover_image: form.cover_image };
    const { data: ev } = await api.post("/events", payload);
    if (form.ticket_enabled && form.ticket_price) {
      await api.patch(`/events/${ev.event_id}`, { ticket_enabled: true, ticket_price: parseFloat(form.ticket_price) });
    }
    setOpen(false);
    setForm({ title: "", description: "", location: "", starts_at: "", cover_image: "", ticket_price: "", ticket_enabled: false });
    load();
  };

  const buy = async () => {
    setBuying(true);
    try {
      const origin_url = window.location.origin;
      const { data } = await api.post("/payments/tickets/checkout", { event_id: buyFor.event_id, quantity: qty, origin_url });
      window.location.href = data.url;
    } catch (e) {
      alert(e.response?.data?.detail || "Checkout failed");
      setBuying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-black text-3xl">Events</h1>
          <p className="text-[var(--muted-fg)] text-sm">Meetups, conventions & watch parties.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/tickets" className="sticker bg-[var(--secondary)]" data-testid="my-tickets-link"><Ticket size={12} weight="fill" /> My tickets</Link>
          {isAdmin && <Button onClick={() => setOpen(true)} data-testid="new-event-btn"><Plus size={14} weight="bold" /></Button>}
        </div>
      </div>

      {events.length === 0 ? <EmptyState title="No events" icon={Calendar} /> : (
        <div className="space-y-4">
          {events.map((ev) => (
            <Card key={ev.event_id} className="p-0 overflow-hidden" data-testid={`event-${ev.event_id}`}>
              {ev.cover_image && <div className="aspect-[16/9] border-b-2 border-black"><img src={ev.cover_image} className="w-full h-full object-cover" alt="" /></div>}
              <div className="p-4">
                <Sticker color="accent">
                  <Calendar size={12} weight="bold" /> {new Date(ev.starts_at).toLocaleDateString()} · {new Date(ev.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Sticker>
                <h3 className="font-black text-xl mt-2">{ev.title}</h3>
                <p className="text-sm text-[var(--muted-fg)]">{ev.description}</p>
                <div className="text-xs font-bold uppercase tracking-widest flex items-center gap-1 mt-2">
                  <MapPin size={12} weight="bold" /> {ev.location || "TBA"}
                </div>
                {ev.ticket_enabled && ev.ticket_price && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1"><CurrencyDollar size={18} weight="fill" /><span className="font-black text-xl">{Number(ev.ticket_price).toFixed(2)}</span></div>
                    <Button onClick={() => { setBuyFor(ev); setQty(1); }} data-testid={`buy-${ev.event_id}`}>
                      <Ticket size={14} weight="fill" /> Buy ticket
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {buyFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3" onClick={() => setBuyFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="buy-modal">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-black text-xl">Buy ticket</h2>
              <button onClick={() => setBuyFor(null)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <p className="font-bold">{buyFor.title}</p>
            <p className="text-xs text-[var(--muted-fg)]">{new Date(buyFor.starts_at).toLocaleString()} · {buyFor.location}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm font-bold uppercase tracking-widest">Quantity</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 border-2 border-black rounded-full font-black">-</button>
                <span className="font-black text-xl w-6 text-center">{qty}</span>
                <button onClick={() => setQty(Math.min(10, qty + 1))} className="w-8 h-8 border-2 border-black rounded-full font-black">+</button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t-2 border-black pt-3">
              <div className="text-sm font-bold">Total</div>
              <div className="font-black text-2xl">${(Number(buyFor.ticket_price) * qty).toFixed(2)}</div>
            </div>
            <Button onClick={buy} disabled={buying} className="w-full mt-4" data-testid="checkout-btn">
              {buying ? "Redirecting to Stripe..." : "Checkout with Stripe"}
            </Button>
            <p className="text-[10px] text-center text-[var(--muted-fg)] mt-2">Secure payment via Stripe. You can test with card 4242 4242 4242 4242.</p>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="new-event-form">
            <div className="flex justify-between items-center mb-3"><h2 className="font-black text-xl">Create event</h2><button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button></div>
            <div className="space-y-3">
              <Input required placeholder="Title" value={form.title} data-testid="event-title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea required rows={3} placeholder="Description" value={form.description} data-testid="event-description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input placeholder="Location" value={form.location} data-testid="event-location" onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Input type="datetime-local" required value={form.starts_at} data-testid="event-starts-at" onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              <Input placeholder="Cover image URL" value={form.cover_image} data-testid="event-cover" onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={form.ticket_enabled} onChange={(e) => setForm({ ...form, ticket_enabled: e.target.checked })} data-testid="event-ticket-enabled" /> Sell tickets via Stripe
              </label>
              {form.ticket_enabled && <Input type="number" step="0.01" placeholder="Ticket price USD" value={form.ticket_price} data-testid="event-price" onChange={(e) => setForm({ ...form, ticket_price: e.target.value })} />}
            </div>
            <Button type="submit" className="w-full mt-3" data-testid="event-submit">Create</Button>
          </form>
        </div>
      )}
    </div>
  );
}
