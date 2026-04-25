import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui-brutal";
import Logo from "@/components/Logo";
import { Lightning, Eye, EyeSlash } from "@phosphor-icons/react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate("/");
    else setErr(res.error);
  };

  return (
    <div className="min-h-screen relative overflow-hidden grid md:grid-cols-2">
      {/* Left decorative panel */}
      <div className="hidden md:block relative bg-[var(--primary)] border-r-2 border-black grain">
        <img
          src="https://images.pexels.com/photos/35089102/pexels-photo-35089102.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Rintaki"
          className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-60"
        />
        <div className="relative z-10 h-full flex flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <Logo size={52} ring="bg-white" className="shadow-[4px_4px_0_#111]" />
            <div>
              <div className="font-black text-xl tracking-tight">RINTAKI</div>
              <div className="text-[11px] uppercase tracking-[0.3em] opacity-90">Anime Club Society</div>
            </div>
          </div>
          <div>
            <h1 className="font-black text-5xl leading-[0.95] mb-3">
              Your<br/>otaku<br/><span className="hand-underline text-black">hub</span>.
            </h1>
            <p className="max-w-sm font-medium text-white/90">
              Forums, events, newsletters, and Points — the Rintaki Anime Club Society universe in one app.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="sticker bg-[var(--secondary)] text-black tilt-1">★ Points</span>
            <span className="sticker bg-[var(--accent)] text-black tilt-2">✦ Otaku World</span>
            <span className="sticker bg-white text-black tilt-3">⚡ Live Forums</span>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-md pop-in" data-testid="login-form">
          <div className="md:hidden flex items-center gap-3 mb-6">
            <Logo size={42} />
            <div>
              <div className="font-black text-xl leading-none">RINTAKI</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-fg)]">Anime Club Society</div>
            </div>
          </div>
          <h2 className="font-black text-3xl md:text-4xl mb-1">Welcome back</h2>
          <p className="text-[var(--muted-fg)] mb-6">Sign in to claim your daily points.</p>

          <div className="space-y-3">
            <Input
              type="email"
              required
              placeholder="you@rintaki.org"
              value={email}
              data-testid="login-email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                required
                placeholder="Password"
                value={password}
                data-testid="login-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black"
                aria-label="toggle password"
              >
                {show ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-3 bg-[var(--primary)] text-white border-2 border-black rounded-lg px-3 py-2 text-sm font-bold shadow-[3px_3px_0_#111]" data-testid="login-error">
              {err}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-5" data-testid="login-submit">
            <Lightning size={16} weight="fill" /> {loading ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-sm mt-5 text-center">
            New here?{" "}
            <Link to="/register" className="font-bold underline decoration-[var(--primary)] decoration-2" data-testid="register-link">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
