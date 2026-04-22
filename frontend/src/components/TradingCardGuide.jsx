import React, { useState } from "react";
import { Card } from "@/components/ui-brutal";
import { Trophy, Info, CaretDown, CaretUp } from "@phosphor-icons/react";

const CARD_TYPES = [
  { name: "Common",             desc: "Common cards have a dot/circle in the upper-right corner and a colored background.",               img: "https://rintaki.org/wp-content/uploads/2026/04/FC260210-218x300.png" },
  { name: "Rare",               desc: "Rare cards have a star in the upper-right corner and a scene background.",                         img: "https://rintaki.org/wp-content/uploads/2026/04/FC260118-218x300.png" },
  { name: "Super Rare",         desc: "Super Rare cards have a diamond in the upper-right corner, scene background, and a gloss effect.", img: "https://rintaki.org/wp-content/uploads/2026/04/FC260230-218x300.png" },
  { name: "Ultra Rare",         desc: "Ultra Rare cards have two diamonds in the upper-right corner, scene background, holographic.",     img: "https://rintaki.org/wp-content/uploads/2026/04/FC260134-218x300.png" },
  { name: "Ultra Rare Special", desc: "Ultra Rare Special cards have two diamonds, scene background, and a glitter-hologram effect.",     img: "https://rintaki.org/wp-content/uploads/2026/04/FC260140-218x300.png" },
];

export default function TradingCardGuide() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("member");

  return (
    <Card className="p-0 overflow-hidden" data-testid="trading-card-guide">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="guide-toggle"
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-10 h-10 bg-[var(--primary)] text-white border-2 border-black rounded-full flex items-center justify-center shrink-0">
          <Info size={18} weight="fill" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-black text-[var(--primary)]">Guide</div>
          <div className="font-black text-base leading-tight">How trading works</div>
          {!open && <div className="text-xs text-[var(--muted-fg)] line-clamp-1 mt-0.5">Tap to read about cards, trades & prizes.</div>}
        </div>
        {open ? <CaretUp size={18} weight="bold" /> : <CaretDown size={18} weight="bold" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t-2 border-black pt-4 pop-in">
          <p className="text-sm text-[var(--muted-fg)]">
            Every trading card collection features our mascot, <b>Rinaka</b>, plus a special guest. Each collection has a different card count,
            is available in the shop, and a new one drops every 2–3 months. Common cards have the most copies in circulation; Ultra Rare &amp; Ultra
            Rare Special have the fewest. We also give away free cards at conventions — sometimes from special editions where you can win more cash
            for collecting the whole set.
          </p>

          <div className="flex gap-2 mt-4">
            <button onClick={() => setTab("non-member")} data-testid="guide-tab-non-member"
                    className={`flex-1 border-2 border-black rounded-full py-2 font-bold text-xs uppercase tracking-widest ${tab === "non-member" ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
              Non-Member
            </button>
            <button onClick={() => setTab("member")} data-testid="guide-tab-member"
                    className={`flex-1 border-2 border-black rounded-full py-2 font-bold text-xs uppercase tracking-widest ${tab === "member" ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
              Member
            </button>
          </div>

          <div className="mt-3 text-sm leading-relaxed">
            {tab === "non-member" ? (
              <p>
                If you're not a member and you'd like to participate, just register — you'll get access to the forum so you can trade with other
                people. Registering doesn't make you a club member (use the <b>Sign Up</b> button on the website for that).{" "}
                <b>As a non-member you can trade-in extra cards and receive $1.00 USD per card, regardless of type.</b>
              </p>
            ) : (
              <>
                <p>
                  As a member, just start collecting any release. You'll have access to the forum, and you can also trade in person at meetings.
                  Members also earn <b>Anime Cash</b> when trading in extras, <i>and</i> can earn <b>real cash</b> too.
                </p>
                <p className="mt-2">Every card you trade-in earns <b>$1.00 USD</b>. For Anime Cash, you earn:</p>
                <ul className="mt-2 space-y-1 text-xs font-bold">
                  <li className="flex justify-between border-b-2 border-black/10 pb-1"><span>Common</span><span>$1.00 AC</span></li>
                  <li className="flex justify-between border-b-2 border-black/10 pb-1"><span>Rare</span><span>$2.00 AC</span></li>
                  <li className="flex justify-between border-b-2 border-black/10 pb-1"><span>Super Rare</span><span>$3.00 AC</span></li>
                  <li className="flex justify-between border-b-2 border-black/10 pb-1"><span>Ultra Rare</span><span>$4.00 AC</span></li>
                  <li className="flex justify-between"><span>Ultra Rare Special</span><span>$5.00 AC</span></li>
                </ul>
              </>
            )}
          </div>

          <div className="mt-5 p-4 bg-[var(--secondary)] border-2 border-black rounded-xl shadow-[3px_3px_0_#111]">
            <div className="flex items-start gap-3">
              <Trophy size={28} weight="fill" />
              <div>
                <div className="font-black text-base leading-tight">Get cash for a full set</div>
                <p className="text-sm mt-1">
                  When you collect every card in one collection, submit proof and receive <b>$25 – $100</b> depending on the set.
                </p>
              </div>
            </div>
          </div>

          <details className="mt-4">
            <summary className="font-black text-sm cursor-pointer uppercase tracking-widest">Card types &amp; rarities</summary>
            <div className="mt-3 space-y-3">
              {CARD_TYPES.map((c) => (
                <div key={c.name} className="flex gap-3 items-start" data-testid={`card-type-${c.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <img src={c.img} alt={c.name} className="w-14 h-20 object-cover rounded-md border-2 border-black shrink-0" />
                  <div>
                    <div className="font-black text-sm">{c.name}</div>
                    <p className="text-xs text-[var(--muted-fg)] leading-snug">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </Card>
  );
}
