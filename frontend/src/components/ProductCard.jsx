import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { Stars } from "@/components/StarRating";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#f1f1f1"/><text x="50%" y="50%" fill="#bbb" font-family="sans-serif" font-size="20" text-anchor="middle" dy=".3em">Sin imagen</text></svg>'
  );

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const outOfStock = product.stock <= 0;

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md" data-testid="product-card">
      <Link to={`/product/${product.slug || product.id}`} className="block">
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={product.images?.[0] || PLACEHOLDER}
            alt={product.name}
            onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      </Link>
      <CardContent className="flex-1 p-4">
        <Badge variant="secondary" className="mb-2 capitalize">
          {product.category}
        </Badge>
        <Link to={`/product/${product.slug || product.id}`}>
          <h3 className="line-clamp-2 font-medium leading-tight hover:underline">
            {product.name}
          </h3>
        </Link>
        {product.rating_count > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Stars value={product.rating_avg} size={13} />
            <span>({product.rating_count})</span>
          </div>
        )}
        <p className="mt-2 text-lg font-bold">{formatCOP(product.price)}</p>
        {outOfStock ? (
          <p className="mt-1 text-sm text-destructive">Agotado</p>
        ) : (
          product.stock <= 5 && (
            <p className="mt-1 text-sm text-amber-600">Últimas {product.stock} unidades</p>
          )
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          disabled={outOfStock}
          data-testid="product-add-to-cart"
          onClick={() => {
            addItem(product);
            toast.success("Agregado al carrito", { description: product.name });
          }}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          {outOfStock ? "Agotado" : "Agregar"}
        </Button>
      </CardFooter>
    </Card>
  );
}
