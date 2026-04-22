import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea, Sticker } from "@/components/ui-brutal";
import { ArrowLeft, Trophy } from "@phosphor-icons/react";

export default function TCGClaim() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const preset = params.get("collection") || "";
  const [collections, setCollections] = useState([]);
  const [claims, setClaims] = useState([]);
  const [form, setForm] = useState({
    collection_id: preset,
    member_id: "",
    first_name: "",
    last_name: "",
    email: user?.email || "",
    address: "",
    city: "",
    state: "",
    zip: "",
    member_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/tcg/collections").then(({ data }) => setCollections(data.collections || []));
    api.get("/tcg/claims").then(({ data }) => setClaims(data.claims || []));
  }, []);

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg("");
    try {
      const selected = collections.find((c) => c.collection_id === form.collection_id);
      await api.post("/tcg/claim", { ...form, collection_name: selected?.name });
      setMsg("✓ Claim submitted! We'll email you.");
      setForm({ ...form, member_notes: "" });
      const { data } = await api.get("/tcg/claims");
      setClaims(data.claims || []);
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
        <h1 className="font-black text-3xl flex items-center gap-2"><Trophy size={26} weight="fill" className="text-[var(--primary)]" /> Claim Prize</h1>
        <p className="text-[var(--muted-fg)] text-sm">Collected a full set? Submit proof and earn $25–$100 cash.</p>
      </div>

      <Card>
        <h3 className="font-black text-sm uppercase tracking-widest">Complete Collection Form</h3>
        <form onSubmit={submit} className="space-y-3 mt-3" data-testid="claim-form">
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Member ID <span className="text-[var(--muted-fg)]">(only if a member)</span></label>
            <Input data-testid="claim-member-id" {...f("member_id")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Name *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input required placeholder="First" data-testid="claim-first" {...f("first_name")} />
              <Input required placeholder="Last" data-testid="claim-last" {...f("last_name")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Email *</label>
            <Input type="email" required data-testid="claim-email" {...f("email")} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Address</label>
            <div className="space-y-2 mt-1">
              <Input placeholder="Address" data-testid="claim-address" {...f("address")} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" data-testid="claim-city" {...f("city")} />
                <Input placeholder="State" data-testid="claim-state" {...f("state")} />
              </div>
              <Input placeholder="Zip" data-testid="claim-zip" {...f("zip")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest">Collection Name *</label>
            <select required value={form.collection_id} onChange={(e) => setForm({ ...form, collection_id: e.target.value })}
                    data-testid="claim-collection"
                    className="w-full mt-1 rounded-lg border-2 border-black px-4 py-3 bg-white font-medium shadow-[3px_3px_0_#111]">
              <option value="">Pick a collection</option>
              {collections.map((c) => <option key={c.collection_id} value={c.collection_id}>{c.name}</option>)}
            </select>
          </div>
          <Textarea rows={2} placeholder="Anything we should know? (optional)" data-testid="claim-notes" {...f("member_notes")} />
          {msg && <div className={`text-sm font-bold ${msg.startsWith("✓") ? "text-green-700" : "text-[var(--primary)]"}`}>{msg}</div>}
          <Button type="submit" disabled={submitting || !form.collection_id} className="w-full" data-testid="claim-submit">
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </Card>

      {claims.length > 0 && (
        <div>
          <h2 className="font-black text-xl mb-2">My claims</h2>
          <div className="space-y-2">
            {claims.map((c) => (
              <Card key={c.claim_id} className="p-3" data-testid={`claim-${c.claim_id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{c.collection_name || collections.find((x) => x.collection_id === c.collection_id)?.name || "Collection"}</div>
                    <div className="text-xs text-[var(--muted-fg)]">{c.owned_count}/{c.total_count} owned · {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <Sticker color={c.status === "approved" ? "accent" : c.status === "rejected" ? "primary" : "secondary"}>{c.status}</Sticker>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
