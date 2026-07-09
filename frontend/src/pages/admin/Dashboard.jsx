import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  Receipt,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const BLUE = "#1e5eff";
const PALETTE = ["#1e5eff", "#4f7cff", "#8aa8ff", "#0f2f99", "#2e6bff", "#6b8cff", "#b3c5ff", "#0a1f66"];

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-3 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const shortCOP = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
};

function ChartCard({ title, icon: Icon, children, empty, emptyText }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
    refetchInterval: 15000,
  });
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => (await api.get("/admin/analytics?days=30")).data,
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const sales = (analytics?.sales_series || []).map((s) => ({
    ...s,
    label: s.date.slice(5), // MM-DD
  }));
  const top = analytics?.top_products || [];
  const low = analytics?.low_rotation || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Ingresos totales" value={formatCOP(stats.revenue)} accent="bg-emerald-100 text-emerald-700" />
        <Stat icon={TrendingUp} label="Ventas (30 días)" value={formatCOP(analytics?.period_revenue || 0)} accent="bg-blue-100 text-blue-700" />
        <Stat icon={Receipt} label="Ticket promedio" value={formatCOP(analytics?.avg_ticket || 0)} accent="bg-indigo-100 text-indigo-700" />
        <Stat icon={ShoppingBag} label="Pedidos totales" value={stats.orders_total} accent="bg-violet-100 text-violet-700" />
        <Stat icon={Clock} label="Pendientes" value={stats.orders_pending} accent="bg-amber-100 text-amber-700" />
        <Stat icon={Users} label="Clientes" value={stats.customers_total} accent="bg-cyan-100 text-cyan-700" />
        <Stat icon={Package} label="Productos" value={stats.products_total} accent="bg-purple-100 text-purple-700" />
        <Stat icon={AlertTriangle} label="Bajo stock (≤5)" value={stats.low_stock} accent="bg-red-100 text-red-700" />
      </div>

      {/* Sales over time */}
      <ChartCard
        title="Ventas de los últimos 30 días"
        icon={TrendingUp}
        empty={sales.length === 0}
        emptyText="Aún no hay ventas pagadas en el período."
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sales} margin={{ left: -10, right: 10, top: 10 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={shortCOP} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={50} />
              <Tooltip formatter={(v, n) => (n === "revenue" ? formatCOP(v) : v)} labelFormatter={(l) => `Día ${l}`} />
              <Area type="monotone" dataKey="revenue" name="Ingresos" stroke={BLUE} strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Best sellers */}
        <ChartCard
          title="Productos / servicios más vendidos"
          icon={TrendingUp}
          empty={top.length === 0}
          emptyText="Aún no hay ventas."
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => `${v} uds`} />
                <Bar dataKey="qty" name="Unidades" radius={[0, 6, 6, 0]}>
                  {top.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Low rotation */}
        <ChartCard
          title="Baja rotación (menos vendidos)"
          icon={AlertTriangle}
          empty={low.length === 0}
          emptyText="No hay productos."
        >
          <div className="divide-y">
            {low.map((p) => (
              <div key={p.name} className="flex items-center justify-between py-2.5 text-sm">
                <span className="truncate pr-2">{p.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={p.qty === 0 ? "font-medium text-red-600" : "text-muted-foreground"}>
                    {p.qty} vendidos
                  </span>
                  <span className="text-xs text-muted-foreground">stock {p.stock}</span>
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recent_orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aún no hay pedidos.</p>
          ) : (
            <div className="divide-y">
              {stats.recent_orders.map((o) => {
                const status = ORDER_STATUS[o.status];
                return (
                  <Link key={o.id} to="/admin/orders" className="flex items-center justify-between py-3 hover:bg-accent/40">
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
