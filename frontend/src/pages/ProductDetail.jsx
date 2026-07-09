import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, ArrowLeft, Minus, Plus, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCOP } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="#f1f1f1"/><text x="50%" y="50%" fill="#bbb" font-family="sans-serif" font-size="24" text-anchor="middle" dy=".3em">Sin imagen</text></svg>'
  );

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
  });

  if (isLoading) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Producto no encontrado.</p>
        <Button asChild variant="link">
          <Link to="/">Volver al catálogo</Link>
        </Button>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-muted">
          <img
            src={product.images?.[0] || PLACEHOLDER}
            alt={product.name}
            onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
            className="aspect-square w-full object-cover"
          />
        </div>

        <div>
          <Badge variant="secondary" className="mb-3 capitalize">
            {product.category}
          </Badge>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-4 text-3xl font-bold">{formatCOP(product.price)}</p>
          <p className="mt-4 whitespace-pre-line text-muted-foreground">
            {product.description || "Sin descripción."}
          </p>

          <div className="mt-6">
            {outOfStock ? (
              <p className="font-medium text-destructive">Producto agotado</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {product.stock} unidades disponibles
              </p>
            )}
          </div>

          {!outOfStock && (
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-md border">
                <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-medium" data-testid="detail-qty">
                  {qty}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="lg"
                className="flex-1"
                data-testid="detail-add-to-cart"
                onClick={() => {
                  addItem(product, qty);
                  toast.success("Agregado al carrito", { description: product.name });
                }}
              >
                <ShoppingCart className="mr-2 h-5 w-5" /> Agregar al carrito
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <PackageSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p>
              Crea tu cuenta o inicia sesión para comprar y{" "}
              <span className="font-medium text-foreground">
                seguir el proceso de tu pedido o servicio
              </span>{" "}
              (DTF, sublimación, corte de vinilo, gran formato…) en cada etapa
              hasta la entrega.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
