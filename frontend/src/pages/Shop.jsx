import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, Button, Input, EmptyState, Sticker } from "@/components/ui-brutal";
import {
  ShoppingBag, MagnifyingGlass, ArrowSquareOut, X, ShoppingCart,
} from "@phosphor-icons/react";

function decodeEntities(s = "") {
  const d = document.createElement("textarea");
  d.innerHTML = s;
  return d.value;
}
function stripHtml(s = "") {
  const d = document.createElement("div");
  d.innerHTML = s;
  return (d.textContent || d.innerText || "").replace(/\s+/g, " ").trim();
}

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/shop/categories").then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    api.get("/shop/products", { params: { page, per_page: 20, search: debounced || undefined, category: category || undefined } })
      .then(({ data }) => setProducts(data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [page, debounced, category]);

  useEffect(() => { setPage(1); }, [debounced, category]);

  const activeCat = useMemo(() => categories.find((c) => c.id === category), [categories, category]);

  return (
    <div className="space-y-5">
      <div>
        <Sticker color="primary" className="tilt-1">★ Shop</Sticker>
        <h1 className="font-black text-3xl mt-2">Club Shop</h1>
        <p className="text-[var(--muted-fg)] text-sm mt-1">
          Merch, trading cards, magazines & more — powered by rintaki.org.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass size={16} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-fg)]" />
        <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
               data-testid="shop-search" className="pl-9" />
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategory(null)} data-testid="cat-all"
                  className={`sticker ${!category ? "bg-black text-white" : "bg-white"}`}>All</button>
          {categories.slice(0, 12).map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} data-testid={`cat-${c.id}`}
                    className={`sticker ${category === c.id ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
              {decodeEntities(c.name)} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-sm text-[var(--muted-fg)]">Loading products…</div>
      ) : products.length === 0 ? (
        <EmptyState title="No products found" body={debounced ? `Nothing matched "${debounced}"` : "Check back later."} icon={ShoppingBag} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <button key={p.id} onClick={() => setDetail(p)} data-testid={`product-${p.id}`}
                    className="text-left">
              <Card className="p-0 overflow-hidden h-full flex flex-col">
                <div className="aspect-square border-b-2 border-black bg-black overflow-hidden">
                  {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="p-2 flex-1 flex flex-col">
                  {p.on_sale && (
                    <div className="inline-flex w-fit text-[9px] font-black uppercase tracking-widest bg-[var(--primary)] text-white border-2 border-black rounded-full px-1.5 py-0.5 mb-1">
                      On sale
                    </div>
                  )}
                  <h3 className="font-black text-sm leading-tight line-clamp-2">{decodeEntities(p.name)}</h3>
                  <div className="font-black text-lg mt-1">{p.price}</div>
                  {!p.in_stock && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-fg)] mt-auto">
                      Out of stock
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {products.length >= 20 && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="dark" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="shop-prev">
            ← Prev
          </Button>
          <div className="text-xs font-black uppercase tracking-widest">Page {page}</div>
          <Button variant="dark" onClick={() => setPage((p) => p + 1)} data-testid="shop-next">Next →</Button>
        </div>
      )}

      {activeCat && (
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-fg)] text-center">
          Filtered: {decodeEntities(activeCat.name)} · <button onClick={() => setCategory(null)} className="underline">Clear</button>
        </div>
      )}

      {detail && <ProductDetail product={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ProductDetail({ product, onClose }) {
  const [full, setFull] = useState(product);
  useEffect(() => {
    api.get(`/shop/products/${product.id}`)
      .then(({ data }) => setFull(data.product || product))
      .catch(() => {});
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white border-2 border-black rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-[6px_6px_0_#111] max-h-[92vh] flex flex-col" data-testid="product-detail">
        <div className="flex items-center justify-between p-3 border-b-2 border-black sticky top-0 bg-white z-10">
          <div className="font-black text-sm uppercase tracking-widest line-clamp-1">{decodeEntities(full.name)}</div>
          <button onClick={onClose} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center" data-testid="product-close">
            <X size={14} weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {full.image && (
            <div className="aspect-square bg-black border-b-2 border-black overflow-hidden">
              <img src={full.image} alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="p-4 space-y-3">
            <h2 className="font-black text-xl leading-tight">{decodeEntities(full.name)}</h2>
            <div className="flex items-center gap-2">
              <div className="font-black text-2xl">{full.price}</div>
              {full.on_sale && <Sticker color="primary">On sale</Sticker>}
              {full.in_stock === false && <Sticker color="secondary">Out of stock</Sticker>}
            </div>
            {full.short_description && (
              <p className="text-sm">{stripHtml(full.short_description)}</p>
            )}
            {full.description && (
              <div className="text-sm text-[var(--muted-fg)] leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: full.description }} />
            )}
            {full.categories?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {full.categories.map((c) => (
                  <span key={c.id} className="sticker bg-white text-[10px]">{decodeEntities(c.name)}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-3 border-t-2 border-black bg-white">
          <a href={full.add_to_cart_url} target="_blank" rel="noreferrer" data-testid="product-buy-btn">
            <Button variant="primary" className="w-full" disabled={full.in_stock === false}>
              <ShoppingCart size={16} weight="fill" />
              {full.in_stock === false ? "Out of stock" : `Add to cart — ${full.price}`}
              <ArrowSquareOut size={12} weight="bold" />
            </Button>
          </a>
          <p className="text-[10px] text-center text-[var(--muted-fg)] font-bold uppercase tracking-widest mt-2">
            Secure checkout on rintaki.org
          </p>
        </div>
      </div>
    </div>
  );
}
