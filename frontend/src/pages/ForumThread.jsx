import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Avatar, EmptyState, Textarea } from "@/components/ui-brutal";
import { ArrowLeft, ArrowSquareOut, ArrowsClockwise, ChatCircleDots, PaperPlaneTilt, Lock } from "@phosphor-icons/react";
import { sanitizeHtml } from "@/lib/sanitize";

export default function ForumThread() {
  const { id } = useParams(); // treated as Asgaros slug (can be forum OR topic)
  const { user } = useAuth();
  const isMember = !!user && (user.role === "admin" || user.is_member);
  const [forum, setForum] = useState(null);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // reply form state (only used when viewing a topic)
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyErr, setReplyErr] = useState("");
  const [replySuccess, setReplySuccess] = useState(false);

  const load = async () => {
    setLoading(true); setNotFound(false);
    // Try forum first — if it has topics, use it. Otherwise fall through to topic.
    let forumData = null;
    try {
      const { data } = await api.get(`/forums/asgaros/forum/${id}`);
      if (data?.topics?.length > 0) {
        setForum(data); setTopic(null);
        setLoading(false);
        return;
      }
      forumData = data;
    } catch { /* try topic */ }
    try {
      const { data } = await api.get(`/forums/asgaros/topic/${id}`, { params: { refresh: replySuccess ? 1 : 0 } });
      setTopic(data); setForum(null);
    } catch {
      if (forumData) { setForum(forumData); setTopic(null); }
      else { setNotFound(true); }
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true); setReplyErr(""); setReplySuccess(false);
    try {
      await api.post(`/forums/asgaros/topic/${id}/reply`, { text: reply });
      setReply("");
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 4000);
      // Refresh from source to show the new post
      try {
        const { data } = await api.get(`/forums/asgaros/topic/${id}`, { params: { refresh: 1 } });
        setTopic(data);
      } catch { /* noop */ }
    } catch (err) {
      setReplyErr(err.response?.data?.detail || "Reply failed");
    } finally {
      setPosting(false);
    }
  };

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
            <div className="p-3 prose-sm text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.body_html || p.body_text) }} />
            {p.reactions && (
              <div className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-fg)]">{p.reactions}</div>
            )}
          </Card>
        ))}
      </div>

      {/* Member reply form */}
      {isMember ? (
        <form onSubmit={submitReply} className="space-y-2" data-testid="reply-form">
          <label className="text-[10px] font-black uppercase tracking-widest">Reply · +2 pts</label>
          <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder={`Reply as ${user.name?.split(" ")[0] || "you"}…`}
                    data-testid="reply-body" required />
          {replyErr && (
            <div className="bg-[var(--primary)] text-white border-2 border-black rounded-lg px-3 py-2 text-xs font-bold" data-testid="reply-err">
              {replyErr}
            </div>
          )}
          {replySuccess && (
            <div className="bg-[var(--secondary)] border-2 border-black rounded-lg px-3 py-2 text-xs font-bold" data-testid="reply-success">
              ✓ Posted to rintaki.org! It may take a few seconds to appear above.
            </div>
          )}
          <Button type="submit" disabled={posting || !reply.trim()} className="w-full" data-testid="reply-submit">
            {posting ? "Posting…" : <><PaperPlaneTilt size={14} weight="fill" /> Post reply</>}
          </Button>
          <p className="text-[10px] text-center text-[var(--muted-fg)] font-bold uppercase tracking-widest">
            Your reply posts directly to rintaki.org as {user.email}
          </p>
        </form>
      ) : user ? (
        <Card className="bg-[var(--secondary)] text-center">
          <p className="text-xs font-bold flex items-center justify-center gap-1">
            <Lock size={14} weight="fill" /> Members can reply from the app
          </p>
          <Link to="/join" className="block mt-2" data-testid="reply-join-link">
            <Button className="w-full">Become a member</Button>
          </Link>
        </Card>
      ) : (
        <Card className="bg-[var(--secondary)] text-center">
          <p className="text-xs font-bold">Sign in to reply</p>
          <Link to="/login" className="block mt-2" data-testid="reply-signin-link">
            <Button className="w-full">Sign in</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

