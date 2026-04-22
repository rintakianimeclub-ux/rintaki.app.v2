import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui-brutal";
import { ArrowLeft, Trophy, Buildings, CurrencyCircleDollar } from "@phosphor-icons/react";

export function PointsGuide() {
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Trophy size={26} weight="fill" className="text-[var(--primary)]" /> Points guide</h1>
      </div>
      <Card>
        <h3 className="font-black text-lg">What are Points?</h3>
        <p className="text-sm mt-1">Points are your reputation currency inside the club. Earn them by participating; use them in the members shop.</p>
      </Card>
      <Card>
        <h3 className="font-black text-lg">How to earn</h3>
        <ul className="text-sm mt-2 space-y-1">
          <li className="flex justify-between"><span>Welcome bonus</span><b>+10</b></li>
          <li className="flex justify-between"><span>Daily login</span><b>+5</b></li>
          <li className="flex justify-between"><span>New forum thread</span><b>+5</b></li>
          <li className="flex justify-between"><span>Reply</span><b>+2</b></li>
          <li className="flex justify-between"><span>Thread like received</span><b>+1</b></li>
          <li className="flex justify-between"><span>Spotlight photo (approved)</span><b>+1</b></li>
          <li className="flex justify-between"><span>Spotlight video (approved, ≤15s)</span><b>+2</b></li>
          <li className="flex justify-between"><span>Approved blog article</span><b>+25</b></li>
          <li className="flex justify-between"><span>Approved magazine article</span><b>+50</b></li>
          <li className="flex justify-between"><span>Theme set completion</span><b>+50 pts + 100 Anime Cash</b></li>
        </ul>
      </Card>
    </div>
  );
}

export function AnimeCashGuide() {
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><CurrencyCircleDollar size={26} weight="fill" className="text-[var(--primary)]" /> Anime Cash guide</h1>
        <p className="text-[var(--muted-fg)] text-sm">Your real-dollar store credit for the club shop.</p>
      </div>
      <Card>
        <h3 className="font-black text-lg">What is Anime Cash?</h3>
        <p className="text-sm mt-1">Anime Cash is store credit you can spend in the Catalog and at rintaki.org. Every $1 of Anime Cash = $1 off a purchase. Balances sync live with MyCred on rintaki.org.</p>
      </Card>
      <Card>
        <h3 className="font-black text-lg">How you earn it</h3>
        <ul className="text-sm mt-2 space-y-1">
          <li className="flex justify-between"><span>Regular membership</span><b>$5 / month</b></li>
          <li className="flex justify-between"><span>Premium membership</span><b>$10 / month</b></li>
          <li className="flex justify-between"><span>Theme set completion</span><b>+100</b></li>
          <li className="flex justify-between"><span>Giveaway / contest bonus</span><b>varies</b></li>
          <li className="flex justify-between"><span>Article of the month</span><b>+25</b></li>
        </ul>
      </Card>
      <Card>
        <h3 className="font-black text-lg">How to spend it</h3>
        <ul className="text-sm mt-2 space-y-1 list-disc pl-5">
          <li>Use it as a discount at checkout in the Catalog.</li>
          <li>Applies automatically at the rintaki.org WooCommerce checkout — no code needed.</li>
          <li>Stacks with regular coupon codes where allowed.</li>
          <li>Anime Cash does not expire as long as your membership stays active.</li>
        </ul>
      </Card>
      <Card className="bg-[var(--secondary)]">
        <p className="text-sm font-bold">
          💡 Tip: Anime Cash is separate from Points. Points = perks & raffle entries. Anime Cash = real discounts on merch.
        </p>
      </Card>
    </div>
  );
}

export function LibraryGuide() {
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ArrowLeft size={14} weight="bold" /> Back</Link>
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Buildings size={26} weight="fill" className="text-[var(--primary)]" /> Library guide</h1>
      </div>
      <Card>
        <h3 className="font-black text-lg">How borrowing works</h3>
        <ol className="list-decimal pl-5 text-sm mt-2 space-y-1">
          <li>Browse the catalog on Libib (see Library tab).</li>
          <li>Message an admin to reserve a title (DM inside the app).</li>
          <li>Pick up at the club / meetup and enjoy.</li>
          <li>Return by due date to earn +5 points per title.</li>
        </ol>
      </Card>
      <Card>
        <h3 className="font-black text-lg">Late returns</h3>
        <p className="text-sm mt-1">Late returns cost 3 points per week. Repeat late returns may limit future borrowing.</p>
      </Card>
    </div>
  );
}
