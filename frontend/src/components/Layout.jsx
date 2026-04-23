import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import {
  HouseSimple,
  ChatsCircle,
  CreditCard,
  Images,
  List as ListIcon,
  Bell,
  Trophy,
  CurrencyCircleDollar,
  SignIn,
  ChatCircleDots,
  Heart,
} from "@phosphor-icons/react";

const DONATE_URL = "https://buy.stripe.com/28EaEX2AIbKz6Cl8E66EU00";

const BASE_TABS = [
  { to: "/", label: "Home", icon: HouseSimple },
  { to: "/forums", label: "Forum", icon: ChatsCircle },
  { to: "/tcg", label: "Cards", icon: CreditCard },
];
const MORE_TAB = { to: "/more", label: "More", icon: ListIcon };
const SPOTLIGHT_TAB = { to: "/feed", label: "Spotlight", icon: Images };
const JOIN_TAB = { to: "/join", label: "Join", icon: SignIn };

export default function Layout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMember = !!user && (user.role === "admin" || user.is_member);

  const tabs = [
    ...BASE_TABS,
    user ? SPOTLIGHT_TAB : JOIN_TAB,
    MORE_TAB,
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[var(--bg)] border-b-2 border-black">
        <div className="max-w-md mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0" data-testid="brand-link">
            <Logo size={38} className="tilt-2 shadow-[3px_3px_0_#111]" />
            <div className="leading-tight min-w-0">
              <div className="font-black text-base tracking-tight truncate">RINTAKI</div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted-fg)] truncate">Anime Club Society</div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            {/* Points/cash pills ONLY for members */}
            {isMember && (
              <>
                <button
                  onClick={() => navigate("/points")}
                  className="flex items-center gap-1 bg-[var(--secondary)] border-2 border-black rounded-full px-2.5 py-1 shadow-[3px_3px_0_#111]"
                  data-testid="points-pill"
                >
                  <Trophy size={12} weight="fill" />
                  <span className="font-black text-xs">{user.points ?? 0}</span>
                </button>
                <button
                  onClick={() => navigate("/points")}
                  className="flex items-center gap-1 bg-[var(--accent)] border-2 border-black rounded-full px-2.5 py-1 shadow-[3px_3px_0_#111]"
                  data-testid="cash-pill"
                >
                  <CurrencyCircleDollar size={12} weight="fill" />
                  <span className="font-black text-xs">{user.anime_cash ?? 0}</span>
                </button>
              </>
            )}

            {/* Notifications + DM + profile for any logged-in user */}
            {user && (
              <>
                <button
                  onClick={() => navigate("/notifications")}
                  className="w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center brutal-btn"
                  data-testid="notif-btn"
                  aria-label="Notifications"
                >
                  <Bell size={15} weight="bold" />
                </button>
                {isMember && (
                  <button
                    onClick={() => navigate("/messages")}
                    className="w-9 h-9 bg-[var(--secondary)] border-2 border-black rounded-full flex items-center justify-center brutal-btn"
                    data-testid="dm-btn"
                    aria-label="Direct messages"
                    title="Messages"
                  >
                    <ChatCircleDots size={15} weight="bold" />
                  </button>
                )}
                <button
                  onClick={() => navigate("/profile")}
                  className="w-9 h-9 bg-[var(--accent)] border-2 border-black rounded-full flex items-center justify-center brutal-btn font-black overflow-hidden"
                  data-testid="profile-btn"
                  aria-label="Profile"
                >
                  {user.picture ? <img src={user.picture} className="w-full h-full object-cover" alt="" /> : <span className="text-sm">{user.name?.[0]?.toUpperCase() || "U"}</span>}
                </button>
              </>
            )}

            {/* Anonymous: donate + sign in CTAs */}
            {!user && (
              <>
                <a href={DONATE_URL} target="_blank" rel="noreferrer" data-testid="donate-cta-top"
                   className="flex items-center gap-1 bg-[var(--primary)] text-white border-2 border-black rounded-full px-3 py-1.5 shadow-[3px_3px_0_#111] font-black text-xs uppercase tracking-widest">
                  <Heart size={12} weight="fill" /> Donate
                </a>
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-1 bg-black text-white border-2 border-black rounded-full px-3 py-1.5 shadow-[3px_3px_0_#111] font-black text-xs uppercase tracking-widest"
                  data-testid="login-cta-top"
                >
                  <SignIn size={12} weight="bold" /> Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5">{children}</main>

      {/* Bottom tab bar — always visible (public or logged-in) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black z-40" data-testid="bottom-nav">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={`tab-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  isActive ? "text-[var(--primary)]" : "text-black"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? "bg-[var(--primary)] text-white" : ""}`}>
                    <Icon size={20} weight={isActive ? "fill" : "bold"} />
                  </div>
                  <span className="mt-0.5">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
