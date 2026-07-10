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

/** Water-splash accent (stylized, evokes the storefront sign). */
function Splash({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g fill={NEON}>
        <path
          opacity="0.85"
          d="M60 30c-18 14-30 40-24 62 5 20 26 34 47 32 18-2 33-16 37-33 5-22-6-46-24-58-6 12-18 20-30 22 0-9-2-18-6-27z"
        />
        <circle cx="128" cy="52" r="9" opacity="0.8" />
        <circle cx="150" cy="80" r="6" opacity="0.7" />
        <circle cx="40" cy="120" r="7" opacity="0.7" />
        <circle cx="150" cy="120" r="10" opacity="0.6" />
        <circle cx="95" cy="160" r="6" opacity="0.6" />
        <circle cx="70" cy="150" r="4" opacity="0.7" />
        <circle cx="135" cy="150" r="4" opacity="0.7" />
      </g>
    </svg>
  );
}

function Hero() {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-white/10 bg-black text-white">
      {/* Ambient blue glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: "radial-gradient(120% 80% at 50% -10%, rgba(47,107,255,0.28), transparent 60%)" }}
      />
      {/* Top spotlights */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-16 sm:gap-24">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-white"
            style={{ boxShadow: "0 0 16px 6px rgba(255,255,255,0.55), 0 18px 40px 10px rgba(47,107,255,0.25)" }}
          />
        ))}
      </div>

      <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[0.95fr_1.25fr_0.9fr] lg:gap-4">
        {/* Left — tagline + splash */}
        <div className="relative order-2 lg:order-1">
          <Splash className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 opacity-30 blur-[1px] sm:h-48 sm:w-48" />
          <p className="relative text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            CALIDAD QUE{" "}
            <span style={{ color: NEON }} className="drop-shadow-[0_0_10px_rgba(47,107,255,0.7)]">
              SE VE,
            </span>
            <br />
            DURABILIDAD<br />QUE SE SIENTE.
          </p>
        </div>

        {/* Center — monogram + wordmark */}
        <div className="order-1 flex flex-col items-center border-white/10 text-center lg:order-2 lg:border-x lg:px-6">
          <div className="flex items-center justify-center leading-none">
            <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_22px_rgba(47,107,255,0.45)] sm:text-8xl">
              G
            </span>
            <span
              className="-ml-2 text-6xl font-black italic tracking-tighter sm:text-8xl"
              style={{ color: NEON, textShadow: "0 0 26px rgba(47,107,255,0.8)" }}
            >
              R
            </span>
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">
            <span className="text-white">GRAFI</span>
            <span style={{ color: NEON }} className="drop-shadow-[0_0_14px_rgba(47,107,255,0.7)]">BLESS</span>
          </h1>
          <div className="mt-3 flex w-full items-center justify-center gap-3">
            <span className="h-px flex-1 max-w-[60px]" style={{ background: `linear-gradient(90deg, transparent, ${NEON})` }} />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85 sm:text-sm">
              Impresión DTF &amp; Estampados
            </p>
            <span className="h-px flex-1 max-w-[60px]" style={{ background: `linear-gradient(90deg, ${NEON}, transparent)` }} />
          </div>
        </div>

        {/* Right — services */}
        <div className="order-3 space-y-4">
          {SERVICES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                style={{ borderColor: "rgba(47,107,255,0.5)", boxShadow: "0 0 14px rgba(47,107,255,0.25) inset" }}
              >
                <Icon className="h-4 w-4" style={{ color: NEON }} />
              </span>
              <span className="text-sm font-semibold uppercase tracking-wide text-white/90">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom neon line */}
      <div className="h-1 w-full" style={{ background: NEON, boxShadow: `0 0 18px 2px ${NEON}` }} />
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
