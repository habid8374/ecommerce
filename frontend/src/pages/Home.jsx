import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Printer, Shirt, Stamp, PenTool } from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const NEON = "#2f6bff";

const SERVICES = [
  { icon: Printer, label: "IMPRESIÓN DTF" },
  { icon: Stamp, label: "ESTAMPADOS PERSONALIZADOS" },
  { icon: Shirt, label: "PRENDAS PERSONALIZADAS" },
  { icon: PenTool, label: "DISEÑO GRÁFICO" },
];

function Hero() {
  return (
    <section className="relative mb-8 flex min-h-[440px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-black p-6 text-white sm:min-h-[500px] sm:p-8 lg:min-h-[560px] lg:p-10">
      {/* Background video (muted/looping) */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        src="/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      {/* Overlay: darker on the left/bottom for text; center-right stays clear so
          the video is visible. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(4,8,18,0.88) 0%, rgba(4,8,18,0.45) 45%, rgba(4,8,18,0.12) 100%), linear-gradient(0deg, rgba(4,8,18,0.85), transparent 55%)" }}
      />

      {/* Top — logo in the corner */}
      <div className="relative flex items-center justify-between gap-4">
        <img src="/logo_grafibless.jpg" alt="GRAFIBLESS" className="h-12 w-auto rounded-lg shadow-lg sm:h-16" />
        <p className="hidden text-xs font-semibold uppercase tracking-[0.25em] text-white/80 sm:block">
          Impresión DTF &amp; Estampados
        </p>
      </div>

      {/* Middle — headline */}
      <h1 className="relative max-w-xl text-3xl font-black leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:text-5xl">
        CALIDAD QUE{" "}
        <span style={{ color: NEON }} className="drop-shadow-[0_0_12px_rgba(47,107,255,0.8)]">SE VE,</span>
        <br />
        DURABILIDAD<br />QUE SE SIENTE.
      </h1>

      {/* Bottom — service chips */}
      <div className="relative flex flex-wrap gap-2">
        {SERVICES.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm sm:text-xs"
          >
            <Icon className="h-4 w-4" style={{ color: NEON }} /> {label}
          </span>
        ))}
      </div>

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
