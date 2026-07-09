import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const STATUSES = Object.keys(ORDER_STATUS);

export default function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: async () =>
      (
        await api.get("/admin/orders", {
          params: { status: filter === "all" ? undefined : filter, page_size: 100 },
        })
      ).data,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: (res) => {
      toast.success("Estado actualizado");
      setSelected(res.data);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const orders = data?.items || [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48" data-testid="orders-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No hay pedidos.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {orders.map((o) => {
                const status = ORDER_STATUS[o.status];
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-accent/40"
                    data-testid="admin-order-row"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">#{o.id.slice(0, 8)}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {o.shipping_address?.full_name || o.customer_email}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status?.className}`}>
                        {status?.label}
                      </span>
                      <span className="w-28 text-right font-semibold">{formatCOP(o.total)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Pedido #{selected.id.slice(0, 8)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="font-medium">{selected.shipping_address?.full_name}</p>
                  <p className="text-muted-foreground">{selected.customer_email}</p>
                  <p className="text-muted-foreground">{selected.shipping_address?.phone}</p>
                  <p className="mt-1 text-muted-foreground">
                    {selected.shipping_address?.address}, {selected.shipping_address?.city}{" "}
                    {selected.shipping_address?.region}
                  </p>
                  {selected.shipping_address?.notes && (
                    <p className="mt-1 italic text-muted-foreground">
                      “{selected.shipping_address.notes}”
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {selected.items.map((it) => (
                    <div key={it.product_id} className="flex justify-between text-sm">
                      <span className="truncate pr-2">
                        {it.quantity} × {it.name}
                      </span>
                      <span>{formatCOP(it.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total</span>
                    <span>{formatCOP(selected.total)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pago</span>
                  <span className="font-medium">
                    {PAYMENT_STATUS[selected.payment_status] || selected.payment_status}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Actualizar estado</label>
                  <Select
                    value={selected.status}
                    onValueChange={(status) => mutation.mutate({ id: selected.id, status })}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger data-testid="order-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ORDER_STATUS[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
