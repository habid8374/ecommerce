import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, ExternalLink, FileMinus, FilePlus } from "lucide-react";
import { api, apiError } from "@/lib/api";
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
  const [note, setNote] = useState(null); // { invoice, kind, reason }

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => (await api.get("/admin/invoices")).data,
    refetchInterval: 20000,
  });

  const createNote = useMutation({
    mutationFn: () =>
      api.post(`/admin/invoices/${note.invoice.id}/note`, { kind: note.kind, reason: note.reason }),
    onSuccess: () => {
      toast.success(note.kind === "credit" ? "Nota crédito emitida" : "Nota débito emitida");
      setNote(null);
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (err) => toast.error(apiError(err, "No se pudo emitir la nota")),
  });

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Facturación electrónica</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Facturas emitidas y notas crédito/débito. La emisión se configura en Ajustes → Facturación electrónica.
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
                          <span className="text-red-600" title={inv.error}>Error</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {inv.public_url && (
                            <Button asChild variant="ghost" size="icon" title="Ver PDF">
                              <a href={inv.public_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {inv.type === "invoice" && inv.status === "emitida" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setNote({ invoice: inv, kind: "credit", reason: "" })} title="Nota crédito">
                                <FileMinus className="mr-1 h-4 w-4" /> Crédito
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setNote({ invoice: inv, kind: "debit", reason: "" })} title="Nota débito">
                                <FilePlus className="mr-1 h-4 w-4" /> Débito
                              </Button>
                            </>
                          )}
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
