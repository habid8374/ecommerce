import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { FileText, ExternalLink, FileMinus, FilePlus, Code, Printer, RefreshCw, Trash2, Unlock } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";
import { formatCOP, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_LABEL = {
  invoice: { label: "Factura", className: "bg-blue-100 text-blue-800 border-blue-200" },
  credit_note: { label: "Nota crédito", className: "bg-amber-100 text-amber-800 border-amber-200" },
  debit_note: { label: "Nota débito", className: "bg-violet-100 text-violet-800 border-violet-200" },
};

export default function AdminInvoices() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [note, setNote] = useState(null); // { invoice, kind, reason }
  const [detail, setDetail] = useState(null); // invoice record to inspect

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => (await api.get("/admin/invoices")).data,
    refetchInterval: 20000,
  });

  const createNote = useMutation({
    mutationFn: () =>
      api.post(`/admin/invoices/${note.invoice.id}/note`, { kind: note.kind, reason: note.reason }),
    onSuccess: (res) => {
      if (res.data.status === "emitida") {
        toast.success(note.kind === "credit" ? "Nota crédito emitida" : "Nota débito emitida");
      } else {
        toast.error("La nota tuvo un error — revisa el detalle");
        setDetail(res.data);
      }
      setNote(null);
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo emitir la nota")),
  });

  const unblock = useMutation({
    mutationFn: () => api.post("/admin/invoices/unblock-factus"),
    onSuccess: (res) => {
      const n = res.data.deleted?.length ?? 0;
      if (n > 0) {
        toast.success(`${n} factura(s) pendiente(s) eliminada(s) — la cola quedó libre. Reintenta emitir.`);
      } else {
        toast.message("No se borró ninguna. Mira el diagnóstico para saber por qué.");
        // Reuse the diagnostics dialog to show what Factus returned.
        setDetail({
          error: `Revisadas: ${res.data.checked ?? 0} facturas (filtro status 0: ${res.data.used_filter ? "sí" : "no"})`,
          error_detail: JSON.stringify(res.data, null, 2),
          request_payload: "",
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo desbloquear la cola")),
  });

  const sync = useMutation({
    mutationFn: () => api.post("/admin/invoices/sync"),
    onSuccess: (res) => {
      const n = res.data.imported ?? 0;
      toast.success(
        n > 0
          ? `${n} factura(s) importada(s) desde Factus`
          : "Todo está sincronizado — no hay facturas nuevas en Factus"
      );
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo sincronizar con Factus")),
  });

  const retry = useMutation({
    mutationFn: (orderId) => api.post(`/admin/orders/${orderId}/invoice`),
    onSuccess: (res) => {
      if (res.data.status === "emitida") {
        toast.success(`Factura ${res.data.number || ""} emitida`);
      } else {
        toast.error("Sigue con error — revisa el detalle");
        setDetail(res.data);
      }
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo reintentar")),
  });

  const removeOne = useMutation({
    mutationFn: (id) => api.delete(`/admin/invoices/${id}`),
    onSuccess: () => {
      toast.success("Documento eliminado del sistema");
      setDetail(null);
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo eliminar")),
  });

  const removeImported = useMutation({
    mutationFn: () => api.delete("/admin/invoices/imported"),
    onSuccess: (res) => {
      toast.success(`${res.data.deleted ?? 0} factura(s) importada(s) eliminada(s)`);
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudieron eliminar")),
  });

  const hasImported = invoices.some((i) => i.imported);

  const askRemoveOne = async (inv) => {
    if (
      await confirm({
        title: "Eliminar documento",
        description: `¿Eliminar ${inv.number || "este documento"} del sistema? No afecta el documento en la DIAN, solo se quita de este listado.`,
        confirmText: "Eliminar",
        destructive: true,
      })
    )
      removeOne.mutate(inv.id);
  };

  const askRemoveImported = async () => {
    if (
      await confirm({
        title: "Eliminar facturas importadas",
        description: "Se quitarán del sistema todas las facturas traídas con 'Sincronizar con Factus' (las que no emitiste tú). No afecta la DIAN.",
        confirmText: "Eliminar importadas",
        destructive: true,
      })
    )
      removeImported.mutate();
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Facturación electrónica</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasImported && (
            <Button variant="outline" size="sm" onClick={askRemoveImported} disabled={removeImported.isPending} className="text-destructive hover:text-destructive" data-testid="delete-imported">
              <Trash2 className="mr-2 h-4 w-4" />
              {removeImported.isPending ? "Eliminando..." : "Eliminar importadas"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => unblock.mutate()} disabled={unblock.isPending} title="Elimina facturas pendientes (status 0) que bloquean la numeración" data-testid="unblock-factus">
            <Unlock className={`mr-2 h-4 w-4 ${unblock.isPending ? "animate-pulse" : ""}`} />
            {unblock.isPending ? "Desbloqueando..." : "Desbloquear cola"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending} data-testid="sync-factus">
            <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Sincronizando..." : "Sincronizar con Factus"}
          </Button>
        </div>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Facturas emitidas y notas crédito/débito. La emisión se configura en Ajustes → Facturación electrónica.
        ¿No ves facturas ya enviadas a la DIAN? Usa <b>Sincronizar con Factus</b> para traerlas e imprimirlas.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Aún no hay documentos emitidos. Al aprobarse un pago (con Factus configurado) aparecerán aquí.
        </p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => {
                  const t = TYPE_LABEL[inv.type] || { label: inv.type, className: "" };
                  return (
                    <tr key={inv.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${t.className}`}>
                          {t.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{inv.number || "—"}</td>
                      <td className="px-4 py-3">
                        <p className="truncate">{inv.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{inv.doc_number}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCOP(inv.total)}</td>
                      <td className="px-4 py-3">
                        {inv.status === "emitida" ? (
                          <span className="text-emerald-600">Emitida</span>
                        ) : (
                          <button className="text-red-600 underline" onClick={() => setDetail(inv)} title={inv.error}>
                            Error
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "emitida" && (
                            <Button asChild variant="ghost" size="icon" title="Representación gráfica (imprimir)">
                              <Link to={`/invoice/${inv.id}/print`} target="_blank">
                                <Printer className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {inv.status !== "emitida" && inv.order_id && (
                            <Button variant="ghost" size="sm" onClick={() => retry.mutate(inv.order_id)} disabled={retry.isPending} title="Reintentar emisión">
                              <RefreshCw className={`mr-1 h-4 w-4 ${retry.isPending ? "animate-spin" : ""}`} /> Reintentar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Ver JSON (envío / respuesta)" onClick={() => setDetail(inv)}>
                            <Code className="h-4 w-4" />
                          </Button>
                          {inv.public_url && (
                            <Button asChild variant="ghost" size="icon" title="Ver PDF">
                              <a href={inv.public_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {inv.type === "invoice" && inv.status === "emitida" && !inv.imported && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setNote({ invoice: inv, kind: "credit", reason: "" })} title="Nota crédito">
                                <FileMinus className="mr-1 h-4 w-4" /> Crédito
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setNote({ invoice: inv, kind: "debit", reason: "" })} title="Nota débito">
                                <FilePlus className="mr-1 h-4 w-4" /> Débito
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" title="Eliminar del sistema" onClick={() => askRemoveOne(inv)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Diagnóstico del documento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {detail.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                    <p className="font-medium">Error {detail.status_code ? `(HTTP ${detail.status_code})` : ""}</p>
                    <p>{detail.error}</p>
                  </div>
                )}
                <div>
                  <p className="mb-1 font-medium">Respuesta de Factus</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
                    {detail.error_detail || "(sin datos)"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium">Datos enviados (payload)</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
                    {detail.request_payload || "(sin datos)"}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!note} onOpenChange={(o) => !o && setNote(null)}>
        <DialogContent>
          {note && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {note.kind === "credit" ? "Nota crédito" : "Nota débito"} — Factura {note.invoice.number}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo</label>
                <Textarea
                  value={note.reason}
                  onChange={(e) => setNote((n) => ({ ...n, reason: e.target.value }))}
                  placeholder={note.kind === "credit" ? "Ej: devolución, anulación..." : "Ej: cargo adicional, ajuste..."}
                  data-testid="note-reason"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNote(null)}>Cancelar</Button>
                <Button onClick={() => createNote.mutate()} disabled={createNote.isPending} data-testid="note-emit">
                  {createNote.isPending ? "Emitiendo..." : "Emitir nota"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
