import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const NEON = "#2f6bff";

function Hero() {
  const videoRef = useRef(null);

  // Robust autoplay across devices (esp. iPhone): force `muted` as a property
  // (React doesn't always reflect the attribute), call play(), and fall back to
  // starting on the first user interaction if the browser blocks autoplay.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute("muted", "");
    const tryPlay = () => {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    tryPlay();
    const onInteract = () => {
      tryPlay();
      document.removeEventListener("touchend", onInteract);
      document.removeEventListener("click", onInteract);
    };
    document.addEventListener("touchend", onInteract, { once: true });
    document.addEventListener("click", onInteract, { once: true });
    return () => {
      document.removeEventListener("touchend", onInteract);
      document.removeEventListener("click", onInteract);
    };
  }, []);

  return (
    <section className="relative mb-8 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black text-white">
      {/* Background video 16:9 — the section matches the video ratio so it shows
          in full, edge to edge, with no cropping or black bars. */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        webkit-playsinline="true"
        preload="auto"
        aria-hidden="true"
      />

      {/* Logo — bottom right corner (large on desktop to cover the video's
          decorative sparkle / mark). */}
      <img
        src="/logo_grafibless.jpg"
        alt="GRAFIBLESS"
        className="absolute bottom-4 right-4 h-16 w-auto rounded-lg shadow-xl sm:bottom-6 sm:right-6 sm:h-28 lg:h-32"
      />

      {/* Bottom neon line */}
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: NEON, boxShadow: `0 0 18px 2px ${NEON}` }} />
    </section>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const category = params.get("category") || "";

  const setCategory = (c) => {
    const next = new URLSearchParams(params);
    if (c) next.set("category", c);
    else next.delete("category");
    setParams(next);
  };

  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete("search");
    setParams(next);
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, category],
    queryFn: async () =>
      (
        await api.get("/products", {
          params: { search: search || undefined, category: category || undefined, page_size: 30 },
        })
      ).data,
  });

  const products = data?.items || [];
  const filtering = Boolean(search || category);

  return (
    <div>
      {!filtering && <Hero />}

      {/* Category chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={category === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategory("")}
        >
          Todos
        </Button>
        {categories.map((c) => (
          <Button
            key={c}
            variant={category === c ? "default" : "outline"}
            size="sm"
            className="capitalize"
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {/* Active search banner */}
      {search && (
        <div className="mb-4 flex items-center gap-3">
          <p className="text-lg">
            Resultados para <span className="font-semibold">“{search}”</span>
          </p>
          <Button variant="ghost" size="sm" onClick={clearSearch} className="gap-1">
            <X className="h-4 w-4" /> Limpiar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No se encontraron productos{search ? ` para “${search}”` : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
