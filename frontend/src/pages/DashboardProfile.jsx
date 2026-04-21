import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Textarea } from "@/components/ui-brutal";
import { ArrowLeft } from "@phosphor-icons/react";

export default function DashboardProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/profile/extended").then(({ data }) => setForm(data || {}));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.put("/profile/extended", form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const f = (k) => ({
    value: form[k] || "",
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl">Member profile</h1>
        <p className="text-[var(--muted-fg)] text-sm">Help us personalize your club experience. Admin can see this.</p>
      </div>

      <form onSubmit={save} className="space-y-3" data-testid="ext-profile-form">
        <Input placeholder="Full name" data-testid="ext-fullname" {...f("full_name")} />
        <Input placeholder="Phone" data-testid="ext-phone" {...f("phone")} />
        <Input type="date" placeholder="Birthday" data-testid="ext-birthday" {...f("birthday")} />
        <Input placeholder="City" data-testid="ext-city" {...f("city")} />
        <Input placeholder="Favorite anime" data-testid="ext-anime" {...f("favorite_anime")} />
        <Input placeholder="Favorite manga" data-testid="ext-manga" {...f("favorite_manga")} />
        <Input placeholder="Cosplay interest? (series / characters)" data-testid="ext-cosplay" {...f("cosplay_interest")} />
        <Input placeholder="How did you find us?" data-testid="ext-found" {...f("how_you_found_us")} />
        <Textarea rows={3} placeholder="Anything else?" data-testid="ext-notes" {...f("notes")} />
        <Button type="submit" className="w-full" data-testid="ext-save">
          {saved ? "Saved!" : "Save"}
        </Button>
      </form>
    </div>
  );
}
