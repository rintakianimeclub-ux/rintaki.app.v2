import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, Sticker, Button, Avatar, EmptyState } from "@/components/ui-brutal";
import { ArrowLeft, ArrowSquareOut, ArrowsClockwise, ChatCircleDots } from "@phosphor-icons/react";

export default function ForumThread() {
  const { id } = useParams(); // treated as Asgaros slug (can be forum OR topic)
  const [forum, setForum] = useState(null);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    setLoading(true); setNotFound(false);
    // Try as forum first; if 404, try as topic
    try {
      const { data } = await api.get(`/forums/asgaros/forum/${id}`);
      setForum(data); setTopic(null);
      setLoading(false);
      return;
    } catch { /* try topic */ }
    try {
      const { data } = await api.get(`/forums/asgaros/topic/${id}`);
      setTopic(data); setForum(null);
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="text-sm text-[var(--muted-fg)] p-6">Loading…</div>;

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link to="/forums" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back to forums</Link>
        <EmptyState title="Not found" body="This forum or topic doesn't exist on rintaki.org anymore." icon={ChatCircleDots} />
      </div>
    );
  }

  // === Forum view (topics list) ===
  if (forum) {
    const f = forum.forum;
    return (
      <div className="space-y-5">
        <Link to="/forums" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Forums</Link>
        <div>
          <h1 className="font-black text-3xl leading-tight">{f.title}</h1>
          <a href={f.url} target="_blank" rel="noreferrer" className="text-xs font-bold underline text-[var(--primary)]">Open on rintaki.org <ArrowSquareOut size={10} weight="bold" className="inline" /></a>
        </div>
        {forum.topics.length === 0 ? (
          <EmptyState title="No topics yet" icon={ChatCircleDots} />
        ) : (
          <div className="space-y-2">
            {forum.topics.map((t) => (
              <Link key={t.slug} to={`/forums/${t.slug}`} data-testid={`topic-${t.slug}`}>
                <Card className="p-3">
                  <div className="flex gap-2 flex-wrap mb-1">
                    {t.is_sticky && <Sticker color="primary">📌 Sticky</Sticker>}
                  </div>
                  <h3 className="font-black text-base leading-tight">{t.title}</h3>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--muted-fg)] mt-1">
                    {t.stats}{t.author ? ` · started by ${t.author}` : ""}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // === Topic view (posts thread) ===
  const t = topic.topic;
  const parent = topic.parent_forum;
  return (
    <div className="space-y-5">
      <Link to={parent ? `/forums/${parent.slug}` : "/forums"} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
        <ArrowLeft size={14} weight="bold" /> {parent ? parent.title : "Forums"}
      </Link>
      <div>
        <h1 className="font-black text-3xl leading-tight">{t.title}</h1>
        <a href={t.url} target="_blank" rel="noreferrer" className="text-xs font-bold underline text-[var(--primary)]">Open on rintaki.org <ArrowSquareOut size={10} weight="bold" className="inline" /></a>
      </div>

      <div className="space-y-3">
        {topic.posts.map((p) => (
          <Card key={p.number} className="p-0 overflow-hidden" data-testid={`post-${p.number}`}>
            <div className="flex items-center gap-2 p-3 border-b-2 border-black bg-[var(--muted)]">
              <Avatar user={{ name: p.author, picture: p.avatar }} size={28} />
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm truncate">{p.author || "Anonymous"}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--muted-fg)]">#{p.number} · {p.date}</div>
              </div>
            </div>
            <div className="p-3 prose-sm text-sm" dangerouslySetInnerHTML={{ __html: p.body_html || p.body_text }} />
            {p.reactions && (
              <div className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-fg)]">{p.reactions}</div>
            )}
          </Card>
        ))}
      </div>

      <Card className="bg-[var(--secondary)] text-center">
        <p className="text-xs font-bold">
          To reply, head to <a href={t.url} target="_blank" rel="noreferrer" className="underline">rintaki.org</a> and post there — replies sync back here within 5 minutes.
        </p>
        <a href={t.url} target="_blank" rel="noreferrer" className="block mt-2">
          <Button className="w-full">Reply on rintaki.org <ArrowSquareOut size={12} weight="bold" /></Button>
        </a>
      </Card>
    </div>
  );
}
