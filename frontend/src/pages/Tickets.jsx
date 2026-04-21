import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, Button, Sticker } from "@/components/ui-brutal";
import { CheckCircle, Ticket as TicketIcon, XCircle, Spinner } from "@phosphor-icons/react";

export function TicketSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState({ loading: true, paid: false, text: "Checking payment…" });
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) { setStatus({ loading: false, paid: false, text: "No session id" }); return; }
    let attempts = 0;
    const max = 10;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { setStatus({ loading: false, paid: true, text: "Payment confirmed!" }); return; }
        if (data.status === "expired") { setStatus({ loading: false, paid: false, text: "Session expired." }); return; }
        attempts++;
        if (attempts >= max) { setStatus({ loading: false, paid: false, text: "Still processing. Check My Tickets in a moment." }); return; }
        setTimeout(poll, 2000);
      } catch {
        setStatus({ loading: false, paid: false, text: "Could not verify payment." });
      }
    };
    poll();
  }, [sessionId]);

  return (
    <div className="py-10 text-center space-y-5">
      {status.loading ? (
        <>
          <div className="w-16 h-16 bg-[var(--secondary)] border-2 border-black rounded-full mx-auto flex items-center justify-center animate-pulse"><Spinner size={28} weight="bold" /></div>
          <h1 className="font-black text-2xl">Processing…</h1>
          <p className="text-sm text-[var(--muted-fg)]">{status.text}</p>
        </>
      ) : status.paid ? (
        <>
          <div className="w-16 h-16 bg-[var(--accent)] border-2 border-black rounded-full mx-auto flex items-center justify-center shadow-[4px_4px_0_#111] tilt-2"><CheckCircle size={28} weight="fill" /></div>
          <h1 className="font-black text-3xl">You're in!</h1>
          <p className="text-sm">Your ticket has been issued.</p>
          <div className="flex gap-2 justify-center">
            <Link to="/tickets"><Button>View my tickets</Button></Link>
            <Link to="/"><Button variant="ghost">Home</Button></Link>
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 bg-[var(--primary)] text-white border-2 border-black rounded-full mx-auto flex items-center justify-center"><XCircle size={28} weight="fill" /></div>
          <h1 className="font-black text-3xl">Something went wrong</h1>
          <p className="text-sm text-[var(--muted-fg)]">{status.text}</p>
          <Link to="/events"><Button variant="ghost">Back to events</Button></Link>
        </>
      )}
    </div>
  );
}

export function MyTickets() {
  const [tickets, setTickets] = useState([]);
  useEffect(() => { api.get("/tickets").then(({ data }) => setTickets(data.tickets || [])); }, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><TicketIcon size={26} weight="fill" className="text-[var(--primary)]" /> My tickets</h1>
        <p className="text-[var(--muted-fg)] text-sm">Show at entry. Screenshots are fine.</p>
      </div>
      {tickets.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted-fg)]">No tickets yet. <Link to="/events" className="font-bold underline">Browse events</Link>.</p></Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.ticket_id} className="p-0 overflow-hidden" data-testid={`ticket-${t.ticket_id}`}>
              {t.event?.cover_image && <div className="aspect-[16/9] border-b-2 border-black"><img src={t.event.cover_image} className="w-full h-full object-cover" alt="" /></div>}
              <div className="p-4">
                <Sticker color="primary">✓ Paid</Sticker>
                <h3 className="font-black text-xl mt-2">{t.event?.title || "Event"}</h3>
                <p className="text-xs text-[var(--muted-fg)]">{t.event?.starts_at ? new Date(t.event.starts_at).toLocaleString() : ""}</p>
                <p className="text-xs font-bold uppercase tracking-widest mt-1">{t.event?.location}</p>
                <div className="mt-3 font-mono text-[10px] bg-black text-white p-2 rounded-lg">TICKET #{t.ticket_id}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
