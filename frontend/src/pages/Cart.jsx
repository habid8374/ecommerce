import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Cart() {
  const { items, setQuantity, removeItem, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Tu carrito está vacío</h2>
        <Button asChild className="mt-4">
          <Link to="/">Explorar productos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Carrito</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <Card key={item.product_id} data-testid="cart-item">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{formatCOP(item.price)}</p>
                  <div className="mt-2 flex items-center rounded-md border w-fit">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(item.product_id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCOP(item.price * item.quantity)}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-2 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Resumen</h2>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCOP(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                El costo de envío se calcula en el checkout.
              </p>
              <Button
                className="w-full"
                size="lg"
                data-testid="cart-checkout-button"
                onClick={() => navigate(user ? "/checkout" : "/login?redirect=/checkout")}
              >
                {user ? "Continuar al pago" : "Regístrate o inicia sesión para comprar"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
