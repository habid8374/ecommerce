import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { CheckCircle2, Trash2, Printer, FileText } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";
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
import { Input } from "@/components/ui/input";

const STATUSES = Object.keys(ORDER_STATUS);

export default function AdminOrders() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [ship, setShip] = useState({ carrier_name: "", tracking_number: "" });

  useEffect(() => {
    if (selected)
      setShip({
        carrier_name: selected.carrier_name || "",
        tracking_number: selected.tracking_number || "",
      });
  }, [selected]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: async () =>
      (
        await api.get("/admin/orders", {
          params: { status: filter === "all" ? undefined : filter, page_size: 100 },
        })
      ).data,
    refetchInterval: 12000, // live: new orders / payments appear automatically
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

  const confirmPayment = useMutation({
    mutationFn: (id) => api.patch(`/admin/orders/${id}/confirm-payment`),
    onSuccess: (res) => {
      toast.success("Pago verificado");
      setSelected(res.data);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const saveShipping = useMutation({
    mutationFn: () => api.patch(`/admin/orders/${selected.id}/shipping`, ship),
    onSuccess: (res) => {
      toast.success("Datos de envío guardados");
      setSelected(res.data);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteOrder = useMutation({
    mutationFn: (id) => api.delete(`/admin/orders/${id}`),
    onSuccess: () => {
      toast.success("Pedido eliminado");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const emitInvoice = useMutation({
    mutationFn: (id) => api.post(`/admin/orders/${id}/invoice`),
    onSuccess: (res) => {
      if (res.data.status === "emitida") {
        toast.success(`Factura ${res.data.number || ""} emitida`);
      } else {
        toast.error("La factura tuvo un error — mira el detalle en Facturación");
      }
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo emitir la factura")),
  });

  const orders = data?.items || [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo
          </span>
        </div>
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
                <DialogTitle className="flex items-center justify-between gap-2 pr-6">
                  <span>Pedido #{selected.id.slice(0, 8)}</span>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/order/${selected.id}/print`} target="_blank">
                      <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Link>
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="font-medium">
                    {selected.customer_name || selected.shipping_address?.full_name}
                  </p>
                  {(selected.doc_type || selected.doc_number) && (
                    <p className="text-muted-foreground">
                      {selected.doc_type} {selected.doc_number}
                    </p>
                  )}
                  <p className="text-muted-foreground">{selected.customer_email}</p>
                  <p className="text-muted-foreground">{selected.shipping_address?.phone}</p>
                  <p className="mt-1 text-muted-foreground">
                    {selected.shipping_address?.address}, {selected.shipping_address?.city}{" "}
                    {selected.shipping_address?.region}
                    {selected.shipping_address?.postal_code
                      ? ` · ${selected.shipping_address.postal_code}`
                      : ""}
                  </p>
                  {selected.shipping_address?.notes && (
                    <p className="mt-1 italic text-muted-foreground">
                      “{selected.shipping_address.notes}”
                    </p>
                  )}
                </div>

                {/* Shipping */}
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    Envío:{" "}
                    {selected.shipping_method === "local"
                      ? `Domicilio local — ${selected.shipping_zone || "—"}`
                      : "Transportadora (nacional)"}
                  </p>
                  {selected.shipping_method !== "local" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Transportadora (ej: Servientrega)"
                        value={ship.carrier_name}
                        onChange={(e) => setShip((s) => ({ ...s, carrier_name: e.target.value }))}
                        data-testid="order-carrier-name"
                      />
                      <Input
                        placeholder="Número de guía"
                        value={ship.tracking_number}
                        onChange={(e) => setShip((s) => ({ ...s, tracking_number: e.target.value }))}
                        data-testid="order-tracking-number"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saveShipping.isPending}
                        onClick={() => saveShipping.mutate()}
                        data-testid="order-save-shipping"
                      >
                        {saveShipping.isPending ? "Guardando..." : "Guardar transportadora y guía"}
                      </Button>
                    </div>
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

                <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span className="text-muted-foreground">Estado del pago</span>
                  <span
                    className={`font-semibold ${
                      selected.payment_status === "approved"
                        ? "text-emerald-600"
                        : selected.payment_status === "pending"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {PAYMENT_STATUS[selected.payment_status] || selected.payment_status}
                  </span>
                </div>

                {selected.payment_status !== "approved" ? (
                  <Button
                    variant="outline"
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    disabled={confirmPayment.isPending}
                    onClick={() => confirmPayment.mutate(selected.id)}
                    data-testid="order-confirm-payment"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {confirmPayment.isPending ? "Verificando..." : "Marcar pago como verificado"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={emitInvoice.isPending}
                    onClick={() => emitInvoice.mutate(selected.id)}
                    data-testid="order-emit-invoice"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {emitInvoice.isPending ? "Emitiendo..." : "Emitir factura electrónica"}
                  </Button>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Actualizar estado del pedido</label>
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

                <div className="border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteOrder.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Eliminar pedido",
                          description:
                            "¿Eliminar este pedido? Esta acción no se puede deshacer." +
                            (selected.payment_status === "approved"
                              ? " El stock será restaurado."
                              : ""),
                          confirmText: "Eliminar",
                          destructive: true,
                        })
                      )
                        deleteOrder.mutate(selected.id);
                    }}
                    data-testid="order-delete-button"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleteOrder.isPending ? "Eliminando..." : "Eliminar pedido"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
