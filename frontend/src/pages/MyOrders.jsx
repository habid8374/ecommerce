import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Trash2, Star } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";
import { formatCOP, formatDate, ORDER_STATUS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ReviewDialog from "@/components/ReviewDialog";

export default function MyOrders() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [review, setReview] = useState(null); // { product, orderId }
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await api.get("/orders/mine")).data,
    refetchInterval: 15000, // live status updates
  });
  const { data: reviewed = [] } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => (await api.get("/reviews/mine")).data,
  });
  const { data: pub } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });
  const googleUrl = pub?.company?.google_review_url || "";
  const isReviewed = (orderId, productId) => reviewed.includes(`${orderId}:${productId}`);

  const deleteOrder = useMutation({
    mutationFn: (id) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      toast.success("Pedido eliminado");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-20 text-center">
        <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Aún no tienes pedidos</h2>
        <Button asChild className="mt-4">
          <Link to="/">Explorar productos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Mis pedidos</h1>
      <div className="space-y-4">
        {orders.map((order) => {
          const status = ORDER_STATUS[order.status];
          return (
            <Card key={order.id}>
              <CardContent className="p-4">
               <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">#{order.id.slice(0, 8)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status?.className}`}>
                      {status?.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.items.reduce((n, i) => n + i.quantity, 0)} artículo(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCOP(order.total)}</p>
                  <div className="mt-1 flex items-center justify-end gap-3">
                    {order.payment_status !== "approved" && (
                      <button
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                        disabled={deleteOrder.isPending}
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "Eliminar pedido",
                              description: "¿Eliminar este pedido no pagado? Esta acción no se puede deshacer.",
                              confirmText: "Eliminar",
                              destructive: true,
                            })
                          )
                            deleteOrder.mutate(order.id);
                        }}
                        data-testid="my-order-delete"
                      >
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </button>
                    )}
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <Link to={`/order-confirmation/${order.id}`}>Ver seguimiento</Link>
                    </Button>
                  </div>
                </div>
               </div>

               {order.payment_status === "approved" && (
                 <div className="mt-4 border-t pt-3">
                   <p className="mb-2 text-xs font-medium text-muted-foreground">Califica tus productos</p>
                   <div className="flex flex-wrap gap-2">
                     {order.items.map((it) =>
                       isReviewed(order.id, it.product_id) ? (
                         <span key={it.product_id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                           <Star className="h-3.5 w-3.5" fill="#f5b301" stroke="#f5b301" /> {it.name}
                         </span>
                       ) : (
                         <Button
                           key={it.product_id}
                           variant="outline"
                           size="sm"
                           className="h-8"
                           onClick={() => setReview({ product: { id: it.product_id, name: it.name }, orderId: order.id })}
                           data-testid="rate-product"
                         >
                           <Star className="mr-1 h-4 w-4" /> {it.name}
                         </Button>
                       )
                     )}
                   </div>
                 </div>
               )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReviewDialog
        open={!!review}
        onClose={() => setReview(null)}
        product={review?.product}
        orderId={review?.orderId}
        googleUrl={googleUrl}
      />
    </div>
  );
}
