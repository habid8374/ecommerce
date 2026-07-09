import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCustomers() {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => (await api.get("/admin/customers")).data,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Clientes</h1>
      {customers.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aún no hay clientes registrados.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden grid-cols-12 gap-4 border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground sm:grid">
              <span className="col-span-4">Cliente</span>
              <span className="col-span-3">Registro</span>
              <span className="col-span-2 text-center">Pedidos</span>
              <span className="col-span-3 text-right">Total gastado</span>
            </div>
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.id} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-12 sm:items-center sm:gap-4">
                  <div className="sm:col-span-4">
                    <p className="font-medium">{c.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.email}</p>
                  </div>
                  <p className="text-sm text-muted-foreground sm:col-span-3">
                    {formatDate(c.created_at)}
                  </p>
                  <p className="text-sm sm:col-span-2 sm:text-center">
                    <span className="sm:hidden text-muted-foreground">Pedidos: </span>
                    {c.orders_count}
                  </p>
                  <p className="font-semibold sm:col-span-3 sm:text-right">
                    {formatCOP(c.total_spent)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
