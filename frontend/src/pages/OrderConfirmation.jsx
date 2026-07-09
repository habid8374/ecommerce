import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS } from "@/lib/format";
import OrderTracker from "@/components/OrderTracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderConfirmation() {
  const { id } = useParams();
  const [params] = useSearchParams();
  // Wompi appends ?id=<transaction_id> to the redirect URL after payment.
  const transactionId = params.get("id");

  // Try to reconcile against Wompi first (no-op in simulated mode); fall back
  // to a plain read if verification isn't available.
  const { data: order, isLoading } = useQuery({
    queryKey: ["order-confirm", id, transactionId],
    queryFn: async () => {
      try {
        const q = transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : "";
        return (await api.get(`/payments/orders/${id}/verify${q}`)).data;
      } catch {
        return (await api.get(`/orders/${id}`)).data;
      }
    },
    // Poll faster while awaiting payment, then keep a slower live refresh so the
    // customer sees status changes (en preparación → enviado → entregado).
    refetchInterval: (query) =>
      query.state.data?.payment_status === "pending" ? 4000 : 15000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Pedido no encontrado.</p>
        <Button asChild variant="link">
          <Link to="/">Volver</Link>
        </Button>
      </div>
    );
  }

  const approved = order.payment_status === "approved";
  const failed = ["declined", "error", "voided"].includes(order.payment_status);
  const Icon = approved ? CheckCircle2 : failed ? XCircle : Clock;
  const iconColor = approved ? "text-emerald-500" : failed ? "text-destructive" : "text-amber-500";
  const title = approved
    ? "¡Pago confirmado!"
    : failed
    ? "El pago no se completó"
    : "Pedido recibido";
  const message = approved
    ? "Gracias por tu compra. Estamos preparando tu pedido."
    : failed
    ? "Hubo un problema con tu pago. Puedes intentarlo nuevamente."
    : "Tu pago está pendiente de confirmación.";

  const status = ORDER_STATUS[order.status];

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card>
        <CardContent className="p-8 text-center">
          <Icon className={`mx-auto mb-4 h-16 w-16 ${iconColor}`} />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{message}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Pedido <span className="font-mono font-medium">#{order.id.slice(0, 8)}</span>
          </p>
        </CardContent>
      </Card>

      {/* Trazabilidad del pedido */}
      <Card className="mt-4">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-semibold">Seguimiento del pedido</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status?.className}`}>
              {status?.label}
            </span>
          </div>
          <OrderTracker status={order.status} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Última actualización: {formatDate(order.updated_at)}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pago</span>
            <span className="text-sm font-medium">{order.payment_status}</span>
          </div>
          {order.items.map((it) => (
            <div key={it.product_id} className="flex justify-between text-sm">
              <span className="truncate pr-2">
                {it.quantity} × {it.name}
              </span>
              <span>{formatCOP(it.subtotal)}</span>
            </div>
          ))}
          <div className="border-t pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCOP(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Envío</span>
              <span>{order.shipping_cost === 0 ? "Gratis" : formatCOP(order.shipping_cost)}</span>
            </div>
            <div className="mt-1 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatCOP(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link to="/orders">Mis pedidos</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link to="/">Seguir comprando</Link>
        </Button>
      </div>
    </div>
  );
}
