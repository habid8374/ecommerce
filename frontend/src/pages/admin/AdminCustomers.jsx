import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, Eye } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminCustomers() {
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => (await api.get("/admin/customers")).data,
  });

  const { data: detail } = useQuery({
    queryKey: ["customer-detail", openId],
    queryFn: async () => (await api.get(`/admin/customers/${openId}`)).data,
    enabled: !!openId,
  });

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get("/admin/customers/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clientes_grafibless_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    } catch (err) {
      toast.error(apiError(err, "No se pudo exportar"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button onClick={exportExcel} disabled={exporting || customers.length === 0} data-testid="customers-export-button">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {exporting ? "Exportando..." : "Exportar a Excel"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aún no hay clientes registrados.</p>
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Ciudad</th>
                    <th className="px-4 py-3">Registro</th>
                    <th className="px-4 py-3 text-center">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total gastado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{c.city || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-center">{c.orders_count}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCOP(c.total_spent)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setOpenId(c.id)} data-testid="customer-view">
                          <Eye className="mr-1 h-4 w-4" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile: stacked cards (avoids horizontal overflow) */}
          <div className="space-y-3 md:hidden">
            {customers.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{c.email}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setOpenId(c.id)} data-testid="customer-view">
                      <Eye className="mr-1 h-4 w-4" /> Ver
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p>{c.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ciudad</p>
                      <p className="capitalize">{c.city || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                      <p>{c.orders_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total gastado</p>
                      <p className="font-semibold">{formatCOP(c.total_spent)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Registro: {formatDate(c.created_at)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.user.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-muted-foreground">{detail.user.doc_type} {detail.user.doc_number}</p>
                  <p className="text-muted-foreground">{detail.user.email}</p>
                  <p className="text-muted-foreground">{detail.user.phone}</p>
                  <p className="mt-1 text-muted-foreground">
                    {detail.user.address}, {detail.user.city} {detail.user.region}
                    {detail.user.postal_code ? ` · ${detail.user.postal_code}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Registrado: {formatDate(detail.user.created_at)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{detail.stats.orders_count}</p>
                    <p className="text-xs text-muted-foreground">Pedidos</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{detail.stats.paid_count}</p>
                    <p className="text-xs text-muted-foreground">Pagados</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{formatCOP(detail.stats.total_spent)}</p>
                    <p className="text-xs text-muted-foreground">Gastado</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-medium">Historial de pedidos</p>
                  {detail.orders.length === 0 ? (
                    <p className="text-muted-foreground">Sin pedidos.</p>
                  ) : (
                    <div className="divide-y">
                      {detail.orders.map((o) => {
                        const st = ORDER_STATUS[o.status];
                        return (
                          <div key={o.id} className="flex items-center justify-between py-2">
                            <div>
                              <span className="font-mono text-xs">#{o.id.slice(0, 8)}</span>
                              <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-xs ${st?.className}`}>
                                {st?.label}
                              </span>
                              <span className="font-semibold">{formatCOP(o.total)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 py-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
