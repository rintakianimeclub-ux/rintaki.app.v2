import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  HouseSimple,
  ChatsCircle,
  CreditCard,
  Images,
  List as ListIcon,
  Bell,
  Trophy,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";

const TABS = [
  { to: "/", label: "Home", icon: HouseSimple },
  { to: "/forums", label: "Forum", icon: ChatsCircle },
  { to: "/tcg", label: "Cards", icon: CreditCard },
  { to: "/feed", label: "Feed", icon: Images },
  { to: "/more", label: "More", icon: ListIcon },
];

export default function Layout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      {/* Mobile-first top bar */}
      <header className="sticky top-0 z-30 bg-[var(--bg)] border-b-2 border-black">
        <div className="max-w-md mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0" data-testid="brand-link">
            <div className="w-9 h-9 shrink-0 bg-[var(--primary)] border-2 border-black rounded-full flex items-center justify-center text-white font-black tilt-2">
              R
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-black text-base tracking-tight truncate">RINTAKI</div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted-fg)] truncate">Anime Club</div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            {user && (
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
                <button
                  onClick={() => navigate("/notifications")}
                  className="w-9 h-9 bg-white border-2 border-black rounded-full flex items-center justify-center brutal-btn"
                  data-testid="notif-btn"
                  aria-label="Notifications"
                >
                  <Bell size={15} weight="bold" />
                </button>
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
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5">{children}</main>

      {/* Bottom tab bar */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black z-40" data-testid="bottom-nav">
          <div className="max-w-md mx-auto grid grid-cols-5">
            {TABS.map(({ to, label, icon: Icon }) => (
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
      )}
    </div>
  );
}
