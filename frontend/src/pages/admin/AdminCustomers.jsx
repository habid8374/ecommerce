import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCustomers() {
  const [exporting, setExporting] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => (await api.get("/admin/customers")).data,
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
        <Card>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
