import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Sticker } from "@/components/ui-brutal";
import { ArrowLeft, Calendar, MapPin, ArrowSquareOut, PencilSimple, Ticket, X } from "@phosphor-icons/react";
import { sanitizeHtml } from "@/lib/sanitize";

// Sanitize-then-strip so we never parse raw third-party HTML via innerHTML.
function stripHtml(s = "") {
  const d = document.createElement("div");
  d.innerHTML = sanitizeHtml(s);
  return (d.textContent || d.innerText || "").replace(/\s+/g, " ").trim();
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [ev, setEv] = useState(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("");
  const [gallery, setGallery] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/events/detail/${id}`);
    setEv(data);
    setBannerUrl(data.banner_url || "");
    const g = await api.get(`/events/media?event_id=${id}`);
    setGallery(g.data.media || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const saveBanner = async (e) => {
    e.preventDefault();
    await api.put(`/events/banner/${id}`, { banner_url: bannerUrl });
    setBannerOpen(false);
    load();
  };

  const clearBanner = async () => {
    if (!window.confirm("Remove the custom banner?")) return;
    await api.delete(`/events/banner/${id}`);
    setBannerUrl("");
    load();
  };

  if (!ev) return <div className="py-8 text-center text-sm text-[var(--muted-fg)]">Loading…</div>;

  const heroImg = ev.banner_url || ev.cover_image;

  return (
    <div className="-mx-4 -mt-5 space-y-5 pb-4">
      {/* Full-width banner */}
      <div className="relative">
        {heroImg ? (
          <div className="w-full aspect-[16/10] border-b-2 border-black overflow-hidden bg-black">
            <img src={heroImg} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full aspect-[16/10] bg-[var(--primary)] grain relative border-b-2 border-black">
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar size={56} weight="fill" className="text-white/50" />
            </div>
          </div>
        )}
        <Link to="/events" className="absolute top-3 left-3 w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[3px_3px_0_#111]" data-testid="back-events">
          <ArrowLeft size={16} weight="bold" />
        </Link>
        {isAdmin && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={() => setBannerOpen(true)}
                    data-testid="banner-edit-btn"
                    className="bg-white border-2 border-black rounded-full px-3 py-1.5 shadow-[3px_3px_0_#111] flex items-center gap-1 text-xs font-bold">
              <PencilSimple size={12} weight="bold" /> Banner
            </button>
          </div>
        )}
      </div>

      <div className="px-4 space-y-3">
        <Sticker color="accent">
          <Calendar size={12} weight="bold" /> {new Date(ev.start_date).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
          {!ev.all_day && ` · ${new Date(ev.start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </Sticker>
        <h1 className="font-black text-3xl leading-tight">{ev.title}</h1>
        {(ev.venue || ev.city) && (
          <div className="text-sm font-bold uppercase tracking-widest flex items-center gap-1">
            <MapPin size={14} weight="bold" /> {[ev.venue, ev.city].filter(Boolean).join(" · ")}
          </div>
        )}
        {ev.excerpt && <p className="text-sm">{stripHtml(ev.excerpt)}</p>}
        {ev.description && <p className="text-sm whitespace-pre-wrap text-[var(--muted-fg)]">{stripHtml(ev.description).slice(0, 500)}</p>}

        <a href={ev.url} target="_blank" rel="noreferrer" data-testid="view-on-site-btn">
          <Button className="w-full">
            <Ticket size={14} weight="fill" /> View event & buy tickets
            <ArrowSquareOut size={14} weight="bold" />
          </Button>
        </a>
      </div>

      {gallery.length > 0 && (
        <div className="px-4">
          <h2 className="font-black text-xl mb-2">From this event</h2>
          <div className="grid grid-cols-3 gap-1">
            {gallery.map((m) => (
              <a key={m.media_id} href={m.url} target="_blank" rel="noreferrer" className="aspect-square border-2 border-black rounded-lg overflow-hidden bg-black" data-testid={`gallery-${m.media_id}`}>
                {m.kind === "video" ? <video src={m.url} muted className="w-full h-full object-cover" /> : <img src={m.url} alt="" className="w-full h-full object-cover" />}
              </a>
            ))}
          </div>
        </div>
      )}

      {bannerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setBannerOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveBanner}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="banner-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">Event banner</h2>
              <button type="button" onClick={() => setBannerOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <p className="text-xs text-[var(--muted-fg)] mb-2">Paste a full-width image URL (recommended 16:10 or wider). This overrides the default event cover for this event only.</p>
            <Input required placeholder="https://rintaki.org/wp-content/uploads/..." value={bannerUrl} data-testid="banner-url" onChange={(e) => setBannerUrl(e.target.value)} />
            {bannerUrl && (
              <div className="mt-3 aspect-[16/10] border-2 border-black rounded-lg overflow-hidden">
                <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex gap-2 mt-4">
              {ev.banner_url && <Button type="button" variant="ghost" onClick={clearBanner} data-testid="banner-remove">Remove</Button>}
              <Button type="submit" className="flex-1" data-testid="banner-save">Save banner</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
