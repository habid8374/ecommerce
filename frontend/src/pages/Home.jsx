import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Printer, Shirt, Scissors, PenTool } from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SERVICES = [
  { icon: Printer, label: "Impresión DTF gran formato" },
  { icon: Shirt, label: "Estampados & prendas personalizadas" },
  { icon: Scissors, label: "Sublimación y corte de vinilo" },
  { icon: PenTool, label: "Diseño gráfico" },
];

function Hero() {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-black via-neutral-900 to-primary/80 px-8 py-12 text-white">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/80">
        Impresión DTF & Estampados
      </p>
      <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
        Calidad que se ve,<br />durabilidad que se siente.
      </h1>
      <p className="mt-3 max-w-xl text-white/80 md:text-lg">
        Personalizados, impresión de gran formato DTF, sublimación y corte de
        vinilo. Cotiza, paga en línea y sigue tu pedido o servicio en cada etapa.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        {SERVICES.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"
          >
            <Icon className="h-4 w-4" /> {label}
          </span>
        ))}
      </div>
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
