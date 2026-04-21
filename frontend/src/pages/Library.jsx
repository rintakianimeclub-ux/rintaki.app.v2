import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Button } from "@/components/ui-brutal";
import { Buildings, ArrowSquareOut, BookOpen } from "@phosphor-icons/react";

export default function Library() {
  const [url, setUrl] = useState("");
  useEffect(() => { api.get("/links").then(({ data }) => setUrl(data.library || "")); }, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-3xl flex items-center gap-2"><Buildings size={28} weight="fill" className="text-[var(--primary)]" /> Library</h1>
        <p className="text-[var(--muted-fg)] text-sm">Our manga & book collection lives on Libib.</p>
      </div>

      <Card className="relative overflow-hidden p-0">
        <div className="bg-[var(--primary)] text-white p-5 grain">
          <BookOpen size={36} weight="fill" />
          <h2 className="font-black text-2xl mt-3">Rintaki Anime Club Library</h2>
          <p className="text-sm opacity-90 mt-1">Browse, search, and check out the club's full collection.</p>
        </div>
        <div className="p-4">
          <a href={url || "https://www.libib.com/u/rintakianimeclub"} target="_blank" rel="noreferrer" data-testid="library-open-btn">
            <Button variant="primary" className="w-full justify-between">
              Open Libib
              <ArrowSquareOut size={16} weight="bold" />
            </Button>
          </a>
          <p className="text-xs text-[var(--muted-fg)] mt-3">
            Tip: check the Library Guide inside Members Dashboard for borrowing rules and how to earn points by returning on time.
          </p>
        </div>
      </Card>
    </div>
  );
}
