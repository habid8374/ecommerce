import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", term, category],
    queryFn: async () =>
      (
        await api.get("/products", {
          params: { search: term || undefined, category: category || undefined, page_size: 24 },
        })
      ).data,
  });

  const products = data?.items || [];

  return (
    <div>
      <section className="mb-8 rounded-xl bg-gradient-to-r from-primary to-primary/80 p-8 text-primary-foreground">
        <h1 className="text-3xl font-bold md:text-4xl">Todo lo que buscas, en un solo lugar</h1>
        <p className="mt-2 max-w-lg text-primary-foreground/90">
          Explora nuestro catálogo y recibe tu pedido en la puerta de tu casa.
        </p>
      </section>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(search);
          }}
          className="flex w-full max-w-md gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="pl-9"
              data-testid="catalog-search-input"
            />
          </div>
          <Button type="submit">Buscar</Button>
        </form>

        <div className="flex flex-wrap gap-2">
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
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No se encontraron productos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
