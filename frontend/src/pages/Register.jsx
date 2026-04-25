import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui-brutal";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Sparkle } from "@phosphor-icons/react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await register(form);
    setLoading(false);
    if (res.ok) navigate("/");
    else setErr(res.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md pop-in" data-testid="register-form">
        <Link to="/login" className="flex items-center gap-3 mb-6">
          <Logo size={42} />
          <div>
            <div className="font-black text-xl leading-none">RINTAKI</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-fg)]">Anime Club Society</div>
          </div>
        </Link>
        <h2 className="font-black text-3xl md:text-4xl mb-1">Join the club</h2>
        <p className="text-[var(--muted-fg)] mb-6">Get <span className="hand-underline font-bold">10 free points</span> on signup.</p>

        <div className="mb-4">
          <GoogleSignInButton onError={(msg) => setErr(msg)} />
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="h-0.5 bg-black flex-1" />
          <span className="text-xs uppercase tracking-widest font-bold">or email</span>
          <div className="h-0.5 bg-black flex-1" />
        </div>

        <div className="space-y-3">
          <Input placeholder="Your display name" required value={form.name}
                 data-testid="reg-name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="email" placeholder="you@rintaki.org" required value={form.email}
                 data-testid="reg-email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="Create a password (min 6 chars)" required value={form.password}
                 data-testid="reg-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>

        {err && (
          <div className="mt-3 bg-[var(--primary)] text-white border-2 border-black rounded-lg px-3 py-2 text-sm font-bold shadow-[3px_3px_0_#111]" data-testid="register-error">
            {err}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full mt-5" data-testid="register-submit">
          <Sparkle size={16} weight="fill" /> {loading ? "Creating..." : "Create Account"}
        </Button>

        <p className="text-sm mt-5 text-center">
          Already a member?{" "}
          <Link to="/login" className="font-bold underline decoration-[var(--primary)] decoration-2" data-testid="login-link">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
