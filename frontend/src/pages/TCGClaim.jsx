import React, { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, Button, Textarea, EmptyState } from "@/components/ui-brutal";
import { ArrowLeft, Trophy } from "@phosphor-icons/react";

export default function TCGClaim() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get("collection") || "";
  const [collections, setCollections] = useState([]);
  const [collection_id, setColId] = useState(preset);
  const [notes, setNotes] = useState("");
  const [claims, setClaims] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/tcg/collections").then(({ data }) => setCollections(data.collections || []));
    api.get("/tcg/claims").then(({ data }) => setClaims(data.claims || []));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/tcg/claim", { collection_id, member_notes: notes });
      setNotes("");
      const { data } = await api.get("/tcg/claims");
      setClaims(data.claims || []);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <Link to="/tcg" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" data-testid="back-tcg">
        <ArrowLeft size={14} weight="bold" /> Back
      </Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Trophy size={26} weight="fill" className="text-[var(--primary)]" /> Claim award</h1>
        <p className="text-[var(--muted-fg)] text-sm">Completed a theme set? Submit a claim. Admins approve → +50 pts + 100 Anime Cash.</p>
      </div>

      <form onSubmit={submit} className="space-y-3" data-testid="claim-form">
        <select required value={collection_id} onChange={(e) => setColId(e.target.value)}
                data-testid="claim-collection"
                className="w-full rounded-lg border-2 border-black px-4 py-3 bg-white font-medium shadow-[3px_3px_0_#111]">
          <option value="">Pick a collection</option>
          {collections.map((c) => <option key={c.collection_id} value={c.collection_id}>{c.name}</option>)}
        </select>
        <Textarea rows={3} placeholder="Anything we should know? (e.g., duplicates you have)"
                  value={notes} data-testid="claim-notes" onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" disabled={submitting || !collection_id} className="w-full" data-testid="claim-submit">
          {submitting ? "Submitting..." : "Submit claim"}
        </Button>
      </form>

      <div>
        <h2 className="font-black text-xl mb-2">My claims</h2>
        {claims.length === 0 ? (
          <p className="text-sm text-[var(--muted-fg)]">No claims yet.</p>
        ) : (
          <div className="space-y-2">
            {claims.map((c) => (
              <Card key={c.claim_id} className="p-3" data-testid={`claim-${c.claim_id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{collections.find((x) => x.collection_id === c.collection_id)?.name || "Collection"}</div>
                    <div className="text-xs text-[var(--muted-fg)]">{c.owned_count}/{c.total_count} owned · {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`sticker ${c.status === "approved" ? "bg-[var(--accent)]" : c.status === "rejected" ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)]"}`}>{c.status}</span>
                </div>
                {c.member_notes && <p className="text-sm mt-2">{c.member_notes}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
