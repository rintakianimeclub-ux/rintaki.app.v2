import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker, Button, EmptyState } from "@/components/ui-brutal";
import { ChatsCircle, ArrowSquareOut, Plus, CaretRight, ArrowsClockwise, Lock } from "@phosphor-icons/react";

const ASGAROS_ADMIN = "https://rintaki.org/wp-admin/admin.php?page=asgarosforum-overview";

export default function Forums() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    setRefreshing(refresh);
    setErr("");
    try {
      const { data } = await api.get("/forums/asgaros/overview", { params: refresh ? { refresh: 1 } : {} });
      setData(data);
    } catch (e) {
      setErr(e.response?.data?.detail || "Couldn't load the forum.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(false); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-black text-4xl">Forums</h1>
          <p className="text-[var(--muted-fg)] text-sm">Live from rintaki.org · read-only in the app</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={refreshing} data-testid="forum-refresh"
                  className="w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center brutal-btn" aria-label="Refresh">
            <ArrowsClockwise size={14} weight="bold" className={refreshing ? "animate-spin" : ""} />
          </button>
          {isAdmin && (
            <a href={ASGAROS_ADMIN} target="_blank" rel="noreferrer" data-testid="admin-manage-forum">
              <Button variant="dark"><Plus size={14} weight="bold" /> Manage on rintaki.org <ArrowSquareOut size={12} weight="bold" /></Button>
            </a>
          )}
        </div>
      </div>

      {/* Public read-only note (hide for admin since they see the manage button) */}
      {!isAdmin && (
        <Card className="bg-[var(--secondary)] flex items-center gap-2 text-xs font-bold">
          <Lock size={14} weight="fill" /> Browse only — only admins create categories and threads (on rintaki.org).
        </Card>
      )}

      {err && (
        <Card className="bg-[var(--primary)] text-white">
          <div className="font-black text-sm">{err}</div>
          <button onClick={() => load(true)} className="underline font-bold text-xs mt-1">Try again</button>
        </Card>
      )}

      {!data && !err && <div className="text-sm text-[var(--muted-fg)]">Loading forum…</div>}

      {data?.categories?.length === 0 ? (
        <EmptyState title="No forums yet" icon={ChatsCircle} body={isAdmin ? "Create a category on rintaki.org to get started." : "Check back soon."} />
      ) : (
        <div className="space-y-5">
          {data?.categories?.map((cat) => (
            <section key={cat.name} data-testid={`cat-${cat.name.replace(/\s+/g, '-')}`}>
              <div className="sticky top-[64px] z-10 -mx-1 px-1 bg-[var(--bg)]/95 backdrop-blur py-1">
                <span className="inline-block bg-black text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border-2 border-black">
                  {cat.name}
                </span>
              </div>
              <div className="space-y-2 mt-2">
                {cat.forums.map((f) => (
                  <Link key={f.slug || f.url} to={`/forums/${f.slug}`} data-testid={`forum-${f.slug}`}>
                    <Card className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--primary)] text-white border-2 border-black rounded-full flex items-center justify-center flex-shrink-0">
                        <ChatsCircle size={18} weight="fill" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-base leading-tight">{f.title}</div>
                        {f.description && <div className="text-xs text-[var(--muted-fg)] line-clamp-2">{f.description}</div>}
                        <div className="flex gap-2 mt-1">
                          {f.stats && <Sticker color="white">{f.stats}</Sticker>}
                          {f.last_post?.when && <Sticker color="accent">Last: {f.last_post.when}</Sticker>}
                        </div>
                      </div>
                      <CaretRight size={18} weight="bold" />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {data?.source_url && (
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)]">
          Synced from <a href={data.source_url} target="_blank" rel="noreferrer" className="underline">rintaki.org/notice-board</a>
        </p>
      )}
    </div>
  );
}
