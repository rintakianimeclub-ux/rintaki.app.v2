import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, Sticker } from "@/components/ui-brutal";
import {
  UserCircle, Trophy, Buildings, Airplane, ShoppingBag, DiscordLogo,
  Gift, Confetti, Article, ShieldStar, CaretRight, CurrencyCircleDollar, HouseLine, CreditCard,
} from "@phosphor-icons/react";

// Color rotation: red (primary) → white → gold (accent)
const PALETTE = ["bg-[var(--primary)] text-white", "bg-white", "bg-[var(--accent)]"];

const TILES = [
  { to: "/dashboard/profile",          label: "Profile",             icon: UserCircle,  desc: "From your rintaki.org account" },
  { to: "/dashboard/trips",            label: "Trips & conventions", icon: Airplane,    desc: "Members-only travel" },
  { to: "/dashboard/points-guide",     label: "Points guide",        icon: Trophy,      desc: "How to earn & spend" },
  { to: "/dashboard/anime-cash-guide", label: "Anime Cash guide",    icon: CurrencyCircleDollar, desc: "How Anime Cash works" },
  { to: "/dashboard/library-guide",    label: "Library guide",       icon: Buildings,   desc: "Borrow & return rules" },
  { to: "/dashboard/giveaways?type=anime_item", label: "Anime Give Away",      icon: Gift, desc: "Monthly anime prizes" },
  { to: "/dashboard/giveaways?type=gift_card",  label: "Gift Card Give Away",  icon: Gift, desc: "Monthly gift cards" },
  { to: "/dashboard/catalog",          label: "Catalog",             icon: CreditCard,  desc: "Members-only products" },
  { to: "/dashboard/contests",         label: "Contests",            icon: Confetti,    desc: "Members-only" },
  { to: "/dashboard/discord",          label: "Discord",             icon: DiscordLogo, desc: "Private server" },
  { to: "/dashboard/submit-article",   label: "Article Submission",  icon: Article,     desc: "Blog / magazine" },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Sticker color="accent"><ShieldStar size={12} weight="fill" /> Members only</Sticker>
        </div>
        <h1 className="font-black text-3xl mt-2">Hi {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-[var(--muted-fg)] text-sm">Your members-only hub.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[var(--primary)] text-white p-3">
          <Trophy size={18} weight="fill" />
          <div className="font-black text-3xl mt-1">{user?.points ?? 0}</div>
          <div className="text-xs uppercase tracking-widest">Points</div>
        </Card>
        <Card className="bg-[var(--accent)] p-3">
          <CurrencyCircleDollar size={18} weight="fill" />
          <div className="font-black text-3xl mt-1">{user?.anime_cash ?? 0}</div>
          <div className="text-xs uppercase tracking-widest">Anime Cash</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t, i) => (
          <Link key={t.to} to={t.to} data-testid={`dash-${t.label.toLowerCase().replace(/\s/g, '-')}`}>
            <Card className={`${PALETTE[i % PALETTE.length]} p-3 h-full`}>
              <t.icon size={22} weight="fill" />
              <div className="font-black mt-1 leading-tight">{t.label}</div>
              <div className="text-[11px] opacity-80">{t.desc}</div>
            </Card>
          </Link>
        ))}
      </div>

      <a href="https://www.rintaki.org" target="_blank" rel="noreferrer" data-testid="website-full">
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white border-2 border-black rounded-full flex items-center justify-center"><HouseLine size={18} weight="fill" /></div>
          <div className="flex-1">
            <div className="font-black">Full website</div>
            <div className="text-xs text-[var(--muted-fg)]">Shop, fundraiser, archive</div>
          </div>
          <CaretRight size={18} weight="bold" />
        </Card>
      </a>
    </div>
  );
}
