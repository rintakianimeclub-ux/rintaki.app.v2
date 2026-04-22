import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, Input, Textarea, Avatar, EmptyState } from "@/components/ui-brutal";
import { Heart, ChatCircle, Plus, X, Image as ImageIcon, VideoCamera, PaperPlaneTilt, Clock } from "@phosphor-icons/react";

const VIDEO_MAX_SECONDS = 15;

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [commentFor, setCommentFor] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [form, setForm] = useState({ media_type: "image", media_url: "", caption: "", video_duration: null });
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const durationTimer = useRef(null);

  const load = async () => {
    const { data } = await api.get("/feed/posts");
    setPosts(data.posts || []);
    if (user) {
      try {
        const { data: pd } = await api.get("/feed/my-pending");
        setPending(pd.posts || []);
      } catch { setPending([]); }
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.user_id]);

  // Probe video duration when URL is pasted for a video post (client-side validation)
  useEffect(() => {
    if (form.media_type !== "video" || !form.media_url) {
      setForm((f) => ({ ...f, video_duration: null }));
      setPostErr("");
      return;
    }
    clearTimeout(durationTimer.current);
    durationTimer.current = setTimeout(() => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = form.media_url;
      v.onloadedmetadata = () => {
        const dur = Number(v.duration);
        setForm((f) => ({ ...f, video_duration: dur }));
        if (dur > VIDEO_MAX_SECONDS + 0.5) {
          setPostErr(`Video is ${dur.toFixed(1)}s — must be ${VIDEO_MAX_SECONDS}s or shorter.`);
        } else {
          setPostErr("");
        }
      };
      v.onerror = () => setPostErr("Couldn't load video — check the URL.");
    }, 400);
    return () => clearTimeout(durationTimer.current);
  }, [form.media_url, form.media_type]);

  const submit = async (e) => {
    e.preventDefault();
    setPostErr(""); setSubmitMsg("");
    if (form.media_type === "video" && form.video_duration && form.video_duration > VIDEO_MAX_SECONDS + 0.5) {
      setPostErr(`Video too long — must be ${VIDEO_MAX_SECONDS}s or shorter.`);
      return;
    }
    setPosting(true);
    try {
      const { data } = await api.post("/feed/posts", form);
      setSubmitMsg(data.message || "Submitted for admin review.");
      setOpen(false);
      setForm({ media_type: "image", media_url: "", caption: "", video_duration: null });
      load();
      setTimeout(() => setSubmitMsg(""), 4000);
    } catch (e) {
      setPostErr(e.response?.data?.detail || "Post failed");
    }
    setPosting(false);
  };

  const like = async (p) => {
    await api.post(`/feed/posts/${p.post_id}/like`);
    load();
  };

  const openComments = async (p) => {
    setCommentFor(p);
    const { data } = await api.get(`/feed/posts/${p.post_id}/comments`);
    setComments(data.comments || []);
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await api.post(`/feed/posts/${commentFor.post_id}/comments`, { body: commentBody });
    setCommentBody("");
    const { data } = await api.get(`/feed/posts/${commentFor.post_id}/comments`);
    setComments(data.comments || []);
    load();
  };

  const rewardHint = form.media_type === "video" ? "+2 pts" : "+1 pt";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-black text-3xl">Spotlight</h1>
          <p className="text-[var(--muted-fg)] text-sm">
            Photos +1 pt · Videos +2 pts (max {VIDEO_MAX_SECONDS}s) · admin must approve first.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="new-post-btn">
          <Plus size={14} weight="bold" /> Post
        </Button>
      </div>

      {submitMsg && (
        <div className="bg-[var(--secondary)] border-2 border-black rounded-lg px-3 py-2 text-sm font-bold" data-testid="submit-msg">
          ✓ {submitMsg}
        </div>
      )}

      {pending.length > 0 && (
        <Card className="bg-[var(--secondary)]" data-testid="my-pending">
          <div className="flex items-center gap-2 font-black text-sm">
            <Clock size={16} weight="fill" /> {pending.length} awaiting approval
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {pending.map((p) => (
              <div key={p.post_id} className="flex-shrink-0 w-16 h-16 border-2 border-black rounded-lg overflow-hidden bg-black relative">
                {p.media_type === "video" ? (
                  <video src={p.media_url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                )}
                {p.media_type === "video" && <VideoCamera size={14} weight="fill" className="absolute bottom-1 right-1 text-white" />}
              </div>
            ))}
          </div>
        </Card>
      )}

      {posts.length === 0 ? (
        <EmptyState title="Be the first!" body="Share an anime moment with your club." icon={ImageIcon} />
      ) : (
        <div className="space-y-5">
          {posts.map((p) => {
            const liked = p.likes?.includes(user?.user_id);
            return (
              <Card key={p.post_id} className="p-0 overflow-hidden" data-testid={`post-${p.post_id}`}>
                <div className="p-3 flex items-center gap-2 border-b-2 border-black">
                  <Avatar user={{ name: p.author_name, picture: p.author_picture }} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{p.author_name}</div>
                    <div className="text-[10px] text-[var(--muted-fg)]">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="bg-black aspect-square">
                  {p.media_type === "video" ? (
                    <video src={p.media_url} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => like(p)} data-testid={`like-${p.post_id}`}
                            className={`flex items-center gap-1 font-bold text-sm ${liked ? "text-[var(--primary)]" : ""}`}>
                      <Heart size={20} weight={liked ? "fill" : "bold"} />
                      {p.likes?.length || 0}
                    </button>
                    <button onClick={() => openComments(p)} data-testid={`comments-${p.post_id}`}
                            className="flex items-center gap-1 font-bold text-sm">
                      <ChatCircle size={20} weight="bold" /> {p.comment_count || 0}
                    </button>
                  </div>
                  {p.caption && <p className="text-sm whitespace-pre-wrap"><span className="font-bold mr-1">{p.author_name}</span>{p.caption}</p>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New post modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                className="bg-white border-2 border-black rounded-2xl w-full max-w-md p-5 shadow-[6px_6px_0_#111]" data-testid="new-post-form">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-black text-xl">New post</h2>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[
                  { v: "image", icon: ImageIcon, l: "Image" },
                  { v: "video", icon: VideoCamera, l: "Video" },
                ].map((opt) => (
                  <button type="button" key={opt.v} onClick={() => setForm({ ...form, media_type: opt.v })}
                          data-testid={`media-type-${opt.v}`}
                          className={`flex-1 border-2 border-black rounded-full py-2 font-bold text-sm flex items-center justify-center gap-1 ${form.media_type === opt.v ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
                    <opt.icon size={14} weight="bold" /> {opt.l}
                  </button>
                ))}
              </div>
              <Input required placeholder={`${form.media_type === "image" ? "Image" : "Video"} URL`} value={form.media_url}
                     data-testid="post-url" onChange={(e) => setForm({ ...form, media_url: e.target.value })} />
              {form.media_type === "video" && form.video_duration != null && (
                <div className={`text-xs font-bold ${postErr ? "text-[var(--primary)]" : "text-[var(--muted-fg)]"}`} data-testid="video-duration-label">
                  Duration: {form.video_duration.toFixed(1)}s / {VIDEO_MAX_SECONDS}s max
                </div>
              )}
              {postErr && (
                <div className="bg-[var(--primary)] text-white border-2 border-black rounded-lg px-3 py-2 text-xs font-bold" data-testid="post-err">
                  {postErr}
                </div>
              )}
              <Textarea rows={3} placeholder="Caption (optional)" value={form.caption}
                        data-testid="post-caption" onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </div>
            <Button type="submit" disabled={posting || !!postErr} className="w-full mt-4" data-testid="post-submit">
              {posting ? "Posting..." : `Submit for review (${rewardHint})`}
            </Button>
            <p className="text-[10px] text-center text-[var(--muted-fg)] font-bold uppercase tracking-widest mt-2">
              Points awarded after admin approves · synced to rintaki.org
            </p>
          </form>
        </div>
      )}

      {/* Comments sheet */}
      {commentFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setCommentFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white border-t-2 border-black rounded-t-2xl w-full max-w-md max-h-[80vh] flex flex-col" data-testid="comments-sheet">
            <div className="p-3 border-b-2 border-black flex justify-between items-center">
              <h3 className="font-black">Comments</h3>
              <button onClick={() => setCommentFor(null)} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center"><X size={14} weight="bold" /></button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {comments.length === 0 && <p className="text-sm text-[var(--muted-fg)]">Be the first to comment.</p>}
              {comments.map((c) => (
                <div key={c.comment_id} className="flex gap-2" data-testid={`comment-${c.comment_id}`}>
                  <Avatar user={{ name: c.author_name, picture: c.author_picture }} size={28} />
                  <div className="flex-1">
                    <div className="text-sm"><span className="font-bold mr-1">{c.author_name}</span>{c.body}</div>
                    <div className="text-[10px] text-[var(--muted-fg)]">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendComment} className="border-t-2 border-black p-2 flex gap-2">
              <Input placeholder="Add a comment..." value={commentBody}
                     data-testid="comment-input" onChange={(e) => setCommentBody(e.target.value)} />
              <Button type="submit" disabled={!commentBody.trim()} data-testid="comment-submit"><PaperPlaneTilt size={14} weight="fill" /></Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
