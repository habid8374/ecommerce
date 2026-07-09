import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FIELDS = [
  { key: "full_name", label: "Nombre completo", required: true },
  { key: "phone", label: "Teléfono", required: true },
  { key: "address", label: "Dirección", required: true, full: true },
  { key: "city", label: "Ciudad", required: true },
  { key: "region", label: "Departamento", required: false },
];

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    region: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  if (items.length === 0) return <Navigate to="/cart" replace />;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create the order (server recomputes prices & validates stock).
      const { data: order } = await api.post("/orders", {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_address: form,
      });

      // 2. Request a payment intent.
      const { data: intent } = await api.post(`/payments/orders/${order.id}/intent`);

      if (intent.enabled && intent.checkout_url) {
        // Real Wompi checkout — hand off to the gateway.
        clear();
        window.location.href = intent.checkout_url;
        return;
      }

      // Simulated mode: approve immediately (dev/demo).
      if (intent.simulate) {
        await api.post(`/payments/orders/${order.id}/simulate`);
      }
      clear();
      toast.success("Pedido creado");
      navigate(`/order-confirmation/${order.id}`, { replace: true });
    } catch (err) {
      toast.error(apiError(err, "No se pudo procesar el pedido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Finalizar compra</h1>
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos de envío</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className={`space-y-2 ${f.full ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={f.key}>
                    {f.label}
                    {f.required && " *"}
                  </Label>
                  <Input
                    id={f.key}
                    required={f.required}
                    value={form[f.key]}
                    onChange={update(f.key)}
                    data-testid={`checkout-${f.key}`}
                  />
                </div>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea id="notes" value={form.notes} onChange={update("notes")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Tu pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((i) => (
                <div key={i.product_id} className="flex justify-between text-sm">
                  <span className="truncate pr-2">
                    {i.quantity} × {i.name}
                  </span>
                  <span className="shrink-0">{formatCOP(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="border-t pt-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCOP(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Envío gratis en compras superiores a {formatCOP(150000)}.
                </p>
              </div>
              <Button
                type="submit"
                className="mt-2 w-full"
                size="lg"
                disabled={loading}
                data-testid="checkout-pay-button"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {loading ? "Procesando..." : "Pagar con Wompi"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
