import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Download, ArrowDownUp, History, Plus, Percent } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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

const MOVE_LABEL = {
  purchase: { label: "Entrada", className: "text-emerald-600" },
  sale: { label: "Venta", className: "text-blue-600" },
  adjustment: { label: "Ajuste", className: "text-amber-600" },
  return: { label: "Devolución", className: "text-violet-600" },
};

function Stat({ label, value, tone = "" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminInventory() {
  const qc = useQueryClient();
  const [move, setMove] = useState(null); // { product, kind, quantity, reason, unit_cost }
  const [kardex, setKardex] = useState(null); // product for history
  const [taxCat, setTaxCat] = useState(null); // { category, tax_rate }
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await api.get("/admin/inventory")).data,
    refetchInterval: 30000,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["inventory-movements", kardex?.id],
    queryFn: async () => (await api.get(`/admin/inventory/movements?product_id=${kardex.id}`)).data,
    enabled: !!kardex,
  });

  const applyMove = useMutation({
    mutationFn: () =>
      api.post(`/admin/inventory/${move.product.id}/movement`, {
        kind: move.kind,
        quantity: Number(move.quantity) || 0,
        reason: move.reason,
        unit_cost: move.unit_cost === "" || move.unit_cost == null ? null : Number(move.unit_cost),
      }),
    onSuccess: () => {
      toast.success("Movimiento registrado");
      setMove(null);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo registrar")),
  });

  const applyTax = useMutation({
    mutationFn: () =>
      api.post("/admin/inventory/apply-tax", {
        category: taxCat.category,
        tax_rate: Number(taxCat.tax_rate) || 0,
      }),
    onSuccess: (res) => {
      toast.success(`IVA ${res.data.tax_rate}% aplicado a ${res.data.updated} producto(s)`);
      setTaxCat(null);
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo aplicar el IVA")),
  });

  const exportXlsx = async () => {
    try {
      const res = await api.get("/admin/inventory/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventario_grafibless.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiError(err, "No se pudo exportar"));
    }
  };

  const s = data?.summary || {};
  const items = (data?.items || []).filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.sku || "").toLowerCase().includes(q.toLowerCase()) ||
      (r.barcode || "").toLowerCase().includes(q.toLowerCase()) ||
      (r.category || "").toLowerCase().includes(q.toLowerCase())
  );
  const categories = [...new Set((data?.items || []).map((r) => r.category).filter(Boolean))];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Inventario</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setTaxCat({ category: categories[0] || "", tax_rate: 19 })}>
            <Percent className="mr-2 h-4 w-4" /> IVA por categoría
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <Download className="mr-2 h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Referencias" value={s.skus ?? 0} />
            <Stat label="Unidades" value={s.units ?? 0} />
            <Stat label="Valor (costo)" value={formatCOP(s.cost_value || 0)} />
            <Stat label="Valor (venta)" value={formatCOP(s.retail_value || 0)} />
            <Stat label="Stock bajo" value={s.low_count ?? 0} tone={s.low_count ? "text-amber-600" : ""} />
            <Stat label="Agotados" value={s.out_count ?? 0} tone={s.out_count ? "text-red-600" : ""} />
          </div>

          <div className="mb-3">
            <Input placeholder="Buscar por nombre, SKU, código de barras o categoría..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Costo</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-center">IVA</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.sku ? `${r.sku} · ` : ""}{r.category}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {r.is_service ? "—" : r.stock}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCOP(r.cost)}</td>
                      <td className="px-4 py-3 text-right">{r.is_service ? "—" : formatCOP(r.cost_value)}</td>
                      <td className="px-4 py-3 text-center">{r.tax_rate}%</td>
                      <td className="px-4 py-3">
                        {r.is_service ? (
                          <span className="text-muted-foreground">Servicio</span>
                        ) : r.out ? (
                          <span className="text-red-600">Agotado</span>
                        ) : r.low ? (
                          <span className="text-amber-600">Bajo</span>
                        ) : (
                          <span className="text-emerald-600">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setMove({ product: r, kind: "in", quantity: "", reason: "", unit_cost: r.cost || "" })} title="Registrar movimiento">
                            <ArrowDownUp className="mr-1 h-4 w-4" /> Movimiento
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setKardex(r)} title="Historial (kardex)">
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile: stacked cards (avoids horizontal overflow) */}
          <div className="space-y-3 md:hidden">
            {items.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.sku ? `${r.sku} · ` : ""}{r.category}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium">
                      {r.is_service ? (
                        <span className="text-muted-foreground">Servicio</span>
                      ) : r.out ? (
                        <span className="text-red-600">Agotado</span>
                      ) : r.low ? (
                        <span className="text-amber-600">Bajo</span>
                      ) : (
                        <span className="text-emerald-600">OK</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <p className="font-semibold">{r.is_service ? "—" : r.stock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">IVA</p>
                      <p>{r.tax_rate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Costo</p>
                      <p>{formatCOP(r.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p>{r.is_service ? "—" : formatCOP(r.cost_value)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setMove({ product: r, kind: "in", quantity: "", reason: "", unit_cost: r.cost || "" })} title="Registrar movimiento">
                      <ArrowDownUp className="mr-1 h-4 w-4" /> Movimiento
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setKardex(r)} title="Historial (kardex)">
                      <History className="mr-1 h-4 w-4" /> Kardex
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Movement dialog */}
      <Dialog open={!!move} onOpenChange={(o) => !o && setMove(null)}>
        <DialogContent>
          {move && (
            <>
              <DialogHeader>
                <DialogTitle>Movimiento — {move.product.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={move.kind} onValueChange={(v) => setMove((m) => ({ ...m, kind: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Entrada (compra / reposición)</SelectItem>
                      <SelectItem value="out">Salida (merma / uso)</SelectItem>
                      <SelectItem value="set">Ajuste (fijar conteo físico)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{move.kind === "set" ? "Nuevo stock" : "Cantidad"}</Label>
                    <Input type="number" value={move.quantity} onChange={(e) => setMove((m) => ({ ...m, quantity: e.target.value }))} data-testid="move-qty" />
                  </div>
                  <div className="space-y-2">
                    <Label>Costo unit. (opcional)</Label>
                    <Input type="number" value={move.unit_cost} onChange={(e) => setMove((m) => ({ ...m, unit_cost: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea value={move.reason} onChange={(e) => setMove((m) => ({ ...m, reason: e.target.value }))} placeholder="Ej: compra a proveedor, conteo físico, merma..." />
                </div>
                <p className="text-xs text-muted-foreground">Stock actual: <b>{move.product.stock}</b></p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMove(null)}>Cancelar</Button>
                <Button onClick={() => applyMove.mutate()} disabled={applyMove.isPending} data-testid="move-save">
                  {applyMove.isPending ? "Guardando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Kardex dialog */}
      <Dialog open={!!kardex} onOpenChange={(o) => !o && setKardex(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {kardex && (
            <>
              <DialogHeader>
                <DialogTitle>Kardex — {kardex.name}</DialogTitle>
              </DialogHeader>
              {movements.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Sin movimientos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">Fecha</th>
                        <th className="py-2">Tipo</th>
                        <th className="py-2 text-right">Cambio</th>
                        <th className="py-2 text-right">Saldo</th>
                        <th className="py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {movements.map((m) => {
                        const t = MOVE_LABEL[m.type] || { label: m.type, className: "" };
                        return (
                          <tr key={m.id}>
                            <td className="py-2 text-muted-foreground">{formatDate(m.created_at)}</td>
                            <td className={`py-2 font-medium ${t.className}`}>{t.label}</td>
                            <td className={`py-2 text-right font-mono ${m.change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {m.change >= 0 ? "+" : ""}{m.change}
                            </td>
                            <td className="py-2 text-right font-semibold">{m.new_stock}</td>
                            <td className="py-2 text-muted-foreground">{m.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Tax by category dialog */}
      <Dialog open={!!taxCat} onOpenChange={(o) => !o && setTaxCat(null)}>
        <DialogContent>
          {taxCat && (
            <>
              <DialogHeader>
                <DialogTitle>Aplicar IVA por categoría</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={taxCat.category} onValueChange={(v) => setTaxCat((t) => ({ ...t, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Elige categoría" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>IVA %</Label>
                  <Input type="number" value={taxCat.tax_rate} onChange={(e) => setTaxCat((t) => ({ ...t, tax_rate: e.target.value }))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se asignará este IVA a todos los productos de la categoría. Puedes ajustarlo por producto luego.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTaxCat(null)}>Cancelar</Button>
                <Button onClick={() => applyTax.mutate()} disabled={applyTax.isPending || !taxCat.category}>
                  {applyTax.isPending ? "Aplicando..." : "Aplicar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
