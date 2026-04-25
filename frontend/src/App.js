import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Forums from "@/pages/Forums";
import ForumThread from "@/pages/ForumThread";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import { TicketSuccess, MyTickets } from "@/pages/Tickets";
import PointsHistory from "@/pages/PointsHistory";
import Newsletters from "@/pages/Newsletters";
import Videos from "@/pages/Videos";
import Messages from "@/pages/Messages";
import Members from "@/pages/Members";
import Notifications from "@/pages/Notifications";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import More from "@/pages/More";
import Feed from "@/pages/Feed";
import Magazines from "@/pages/Magazines";
import Library from "@/pages/Library";
import EventsGallery from "@/pages/EventsGallery";
import TCGHome from "@/pages/TCGHome";
import TCGCollection from "@/pages/TCGCollection";
import TCGClaim from "@/pages/TCGClaim";
import TCGTradeIn from "@/pages/TCGTradeIn";
import TCGTrade from "@/pages/TCGTrade";
import Dashboard from "@/pages/Dashboard";
import DashboardProfile from "@/pages/DashboardProfile";
import { PointsGuide, LibraryGuide, AnimeCashGuide } from "@/pages/Guides";
import { Trips, Giveaways, Contests, SubmitArticle, MembersShop, MembersDiscord } from "@/pages/DashboardSubs";
import Join from "@/pages/Join";
import Shop from "@/pages/Shop";

function Public({ children }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-14 h-14 border-2 border-black rounded-full bg-[var(--primary)] animate-pulse" />
      </div>
    );
  }
  return <Layout>{children}</Layout>;
}

function MemberOnly({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && !user.is_member) return <Navigate to="/join" replace />;
  return children;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-14 h-14 border-2 border-black rounded-full bg-[var(--primary)] animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Layout>{children}</Layout>;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function RouterShell() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<Public><Home /></Public>} />
      <Route path="/forums" element={<Public><Forums /></Public>} />
      <Route path="/forums/:id" element={<Public><ForumThread /></Public>} />
      <Route path="/events" element={<Public><Events /></Public>} />
      <Route path="/events/:id" element={<Public><EventDetail /></Public>} />
      <Route path="/tickets" element={<Protected><MyTickets /></Protected>} />
      <Route path="/tickets/success" element={<Protected><TicketSuccess /></Protected>} />
      <Route path="/points" element={<Navigate to="/points/history" replace />} />
      <Route path="/points/history" element={<Protected><MemberOnly><PointsHistory kind="points" /></MemberOnly></Protected>} />
      <Route path="/anime-cash/history" element={<Protected><MemberOnly><PointsHistory kind="anime_cash" /></MemberOnly></Protected>} />
      <Route path="/newsletters" element={<Public><Newsletters /></Public>} />
      <Route path="/videos" element={<Public><Videos /></Public>} />
      <Route path="/messages" element={<Protected><MemberOnly><Messages /></MemberOnly></Protected>} />
      <Route path="/messages/:userId" element={<Protected><MemberOnly><Messages /></MemberOnly></Protected>} />
      <Route path="/members" element={<Protected><MemberOnly><Members /></MemberOnly></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/u/:userId" element={<Public><Profile /></Public>} />

      <Route path="/more" element={<Public><More /></Public>} />
      <Route path="/feed" element={<Protected><Feed /></Protected>} />
      <Route path="/magazines" element={<Public><Magazines /></Public>} />
      <Route path="/library" element={<Public><Library /></Public>} />
      <Route path="/events-gallery" element={<Public><EventsGallery /></Public>} />
      <Route path="/join" element={<Public><Join /></Public>} />
      <Route path="/shop" element={<Public><Shop /></Public>} />

      <Route path="/tcg" element={<Public><TCGHome /></Public>} />
      <Route path="/tcg/collections/:id" element={<Public><TCGCollection /></Public>} />
      <Route path="/tcg/claim" element={<Protected><MemberOnly><TCGClaim /></MemberOnly></Protected>} />
      <Route path="/tcg/tradein" element={<Protected><MemberOnly><TCGTradeIn /></MemberOnly></Protected>} />
      <Route path="/tcg/trade" element={<Protected><MemberOnly><TCGTrade /></MemberOnly></Protected>} />

      <Route path="/dashboard" element={<Protected><MemberOnly><Dashboard /></MemberOnly></Protected>} />
      <Route path="/dashboard/profile" element={<Protected><MemberOnly><DashboardProfile /></MemberOnly></Protected>} />
      <Route path="/dashboard/points-guide" element={<Protected><MemberOnly><PointsGuide /></MemberOnly></Protected>} />
      <Route path="/dashboard/anime-cash-guide" element={<Protected><MemberOnly><AnimeCashGuide /></MemberOnly></Protected>} />
      <Route path="/dashboard/library-guide" element={<Protected><MemberOnly><LibraryGuide /></MemberOnly></Protected>} />
      <Route path="/dashboard/trips" element={<Protected><MemberOnly><Trips /></MemberOnly></Protected>} />
      <Route path="/dashboard/shop" element={<Protected><MemberOnly><MembersShop /></MemberOnly></Protected>} />
      <Route path="/dashboard/catalog" element={<Protected><MemberOnly><MembersShop /></MemberOnly></Protected>} />
      <Route path="/dashboard/discord" element={<Protected><MemberOnly><MembersDiscord /></MemberOnly></Protected>} />
      <Route path="/dashboard/giveaways" element={<Protected><MemberOnly><Giveaways /></MemberOnly></Protected>} />
      <Route path="/dashboard/contests" element={<Protected><MemberOnly><Contests /></MemberOnly></Protected>} />
      <Route path="/dashboard/submit-article" element={<Protected><MemberOnly><SubmitArticle /></MemberOnly></Protected>} />

      <Route path="/admin" element={<Protected><AdminOnly><Admin /></AdminOnly></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  // In installed-PWA standalone mode (iOS home-screen, Android TWA), a plain
  // <a target="_blank"> is silently swallowed by the OS. This global click handler
  // intercepts any external link with target=_blank and re-opens it via
  // window.open — which works in both browser AND standalone PWA mode.
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.("a[target='_blank']");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(href)) return;        // skip internal/anchor links
      if (e.defaultPrevented) return;                  // let per-handler code win
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // preserve power-user shortcuts
      e.preventDefault();
      const win = window.open(href, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = href;
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // PWA service-worker registration. Our SW uses safe strategies (network-first for
  // navigation & API, stale-while-revalidate for static) so it works in BOTH dev and
  // production without breaking Webpack hot-reload. Registering always also means PWA
  // audit tools (Lighthouse, PWABuilder) see an active SW on the preview URL.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/service-worker.js").catch((err) => {
        // Non-fatal — app still works without the SW
        console.warn("SW registration failed:", err);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return (
    <BrowserRouter>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ""}>
        <AuthProvider>
          <RouterShell />
        </AuthProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  );
}

export default App;
