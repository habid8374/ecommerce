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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const BLUE = "#1e5eff";
const PALETTE = ["#1e5eff", "#4f7cff", "#8aa8ff", "#0f2f99", "#2e6bff", "#6b8cff"];

const shortCOP = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
};

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className={`shrink-0 rounded-lg p-2 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-base font-bold tabular-nums sm:text-lg">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, empty, emptyText }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const sales = (analytics?.sales_series || []).map((s) => ({ ...s, label: s.date.slice(5) }));
  const top = (analytics?.top_products || []).slice(0, 6);
  const low = (analytics?.low_rotation || []).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo
        </span>
      </div>

      {/* KPIs — 2 cols on mobile, compact */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Ingresos" value={shortCOP(stats.revenue)} accent="bg-emerald-100 text-emerald-700" />
        <Kpi icon={TrendingUp} label="Ventas 30d" value={shortCOP(analytics?.period_revenue || 0)} accent="bg-blue-100 text-blue-700" />
        <Kpi icon={Receipt} label="Ticket prom." value={shortCOP(analytics?.avg_ticket || 0)} accent="bg-indigo-100 text-indigo-700" />
        <Kpi icon={ShoppingBag} label="Pedidos" value={stats.orders_total} accent="bg-violet-100 text-violet-700" />
        <Kpi icon={Clock} label="Pendientes" value={stats.orders_pending} accent="bg-amber-100 text-amber-700" />
        <Kpi icon={Users} label="Clientes" value={stats.customers_total} accent="bg-cyan-100 text-cyan-700" />
        <Kpi icon={Package} label="Productos" value={stats.products_total} accent="bg-purple-100 text-purple-700" />
        <Kpi icon={AlertTriangle} label="Bajo stock" value={stats.low_stock} accent="bg-red-100 text-red-700" />
      </div>

      {/* Sales trend */}
      <ChartCard title="Ventas · últimos 30 días" icon={TrendingUp} empty={sales.length === 0} emptyText="Aún no hay ventas pagadas.">
        <div className="h-52 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sales} margin={{ left: -16, right: 8, top: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tickFormatter={shortCOP} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip formatter={(v) => formatCOP(v)} labelFormatter={(l) => `Día ${l}`} />
              <Area type="monotone" dataKey="revenue" name="Ingresos" stroke={BLUE} strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {/* Best sellers */}
        <ChartCard title="Más vendidos" icon={TrendingUp} empty={top.length === 0} emptyText="Aún no hay ventas.">
          <div className="space-y-2.5">
            {top.map((p, i) => {
              const max = top[0]?.qty || 1;
              return (
                <div key={p.name} className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 font-medium text-muted-foreground">{p.qty} uds</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(p.qty / max) * 100}%`, background: PALETTE[i % PALETTE.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Low rotation */}
        <ChartCard title="Baja rotación" icon={AlertTriangle} empty={low.length === 0} emptyText="No hay productos.">
          <div className="divide-y">
            {low.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={p.qty === 0 ? "font-medium text-red-600" : "text-muted-foreground"}>{p.qty} vend.</span>
                  <span className="text-xs text-muted-foreground">stock {p.stock}</span>
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pedidos recientes</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {stats.recent_orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay pedidos.</p>
          ) : (
            <div className="divide-y">
              {stats.recent_orders.map((o) => {
                const status = ORDER_STATUS[o.status];
                return (
                  <Link key={o.id} to="/admin/orders" className="flex items-center justify-between gap-2 py-2.5 hover:bg-accent/40">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">#{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status?.className}`}>
                        {status?.label}
                      </span>
                      <span className="text-sm font-semibold">{formatCOP(o.total)}</span>
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
