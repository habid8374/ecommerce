import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DollarSign, ShoppingBag, Clock, Users, Package, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-3 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
    refetchInterval: 15000, // live dashboard
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={DollarSign} label="Ingresos" value={formatCOP(data.revenue)} accent="bg-emerald-100 text-emerald-700" />
        <Stat icon={ShoppingBag} label="Pedidos totales" value={data.orders_total} accent="bg-blue-100 text-blue-700" />
        <Stat icon={Clock} label="Pedidos pendientes" value={data.orders_pending} accent="bg-amber-100 text-amber-700" />
        <Stat icon={Users} label="Clientes" value={data.customers_total} accent="bg-indigo-100 text-indigo-700" />
        <Stat icon={Package} label="Productos" value={data.products_total} accent="bg-purple-100 text-purple-700" />
        <Stat icon={AlertTriangle} label="Bajo stock (≤5)" value={data.low_stock} accent="bg-red-100 text-red-700" />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Pedidos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aún no hay pedidos.</p>
          ) : (
            <div className="divide-y">
              {data.recent_orders.map((o) => {
                const status = ORDER_STATUS[o.status];
                return (
                  <Link
                    key={o.id}
                    to="/admin/orders"
                    className="flex items-center justify-between py-3 hover:bg-accent/40"
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">#{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status?.className}`}>
                        {status?.label}
                      </span>
                      <span className="font-semibold">{formatCOP(o.total)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
