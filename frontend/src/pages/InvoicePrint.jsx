import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const TYPE_TITLE = {
  invoice: "Factura Electrónica de Venta",
  credit_note: "Nota Crédito Electrónica",
  debit_note: "Nota Débito Electrónica",
};

function safeParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["invoice-print", id],
    queryFn: async () => (await api.get(`/admin/invoices/${id}`)).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });

  if (!data) return <div className="p-10 text-center text-muted-foreground">Cargando documento...</div>;

  const inv = data.invoice;
  const order = data.order || {};
  const company = settings?.company || {};
  const addr = order.shipping_address || {};
  const fd = safeParse(inv.factus_data);
  const bill = (fd?.data?.bill) || fd?.data || fd || {};

  const number = inv.number || bill.number || "";
  const cufe = inv.cufe || bill.cufe || bill.cude || "";
  const qr = inv.qr || bill.qr || bill.qr_image || inv.public_url || "";
  const qrImg = qr
    ? qr.startsWith("data:") || /\.(png|jpg|jpeg|svg)$/i.test(qr) || qr.includes("qr")
      ? qr
      : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qr)}`
    : "";

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display:none !important } @page { margin: 12mm } }`}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Button onClick={() => window.print()} data-testid="print-invoice">
          <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      <div className="mx-auto max-w-[820px] bg-white p-10 text-[13px] shadow-sm print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-black p-2"><LogoMark size={34} /></span>
            <div>
              <p className="text-lg font-extrabold tracking-tight">
                GRAFI<span className="text-primary">BLESS</span>
              </p>
              <p className="text-xs text-muted-foreground">{company.name || "GRAFIBLESS"}</p>
              {company.nit && <p className="text-xs text-muted-foreground">NIT: {company.nit}</p>}
              {company.address && <p className="text-xs text-muted-foreground">{company.address}{company.city ? `, ${company.city}` : ""}</p>}
              {(company.phone || company.email) && (
                <p className="text-xs text-muted-foreground">{[company.phone, company.email].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border p-3 text-right">
            <p className="text-sm font-bold uppercase">{TYPE_TITLE[inv.type] || "Documento"}</p>
            <p className="font-mono text-lg font-bold">{number || "—"}</p>
            <p className="text-xs text-muted-foreground">Fecha: {formatDate(inv.created_at)}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Adquiriente</p>
            <p className="font-medium">{inv.customer_name || addr.full_name}</p>
            <p className="text-muted-foreground">{order.doc_type} {inv.doc_number}</p>
            <p className="text-muted-foreground">{inv.customer_email || order.customer_email}</p>
            <p className="text-muted-foreground">{addr.phone}</p>
            <p className="text-muted-foreground">{addr.address}{addr.city ? `, ${addr.city}` : ""} {addr.region}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Datos DIAN</p>
            {cufe ? (
              <p className="break-all text-xs"><b>CUFE:</b> {cufe}</p>
            ) : (
              <p className="text-xs text-muted-foreground">CUFE pendiente</p>
            )}
            {inv.reason && <p className="mt-1 text-xs"><b>Motivo:</b> {inv.reason}</p>}
            {inv.public_url && (
              <p className="mt-1 text-xs">
                <a href={inv.public_url} target="_blank" rel="noreferrer" className="text-primary underline">
                  Validar en Factus/DIAN
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Items */}
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Descripción</th>
              <th className="py-2 text-center">Cant.</th>
              <th className="py-2 text-right">V. Unit.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it) => (
              <tr key={it.product_id} className="border-b">
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{formatCOP(it.price)}</td>
                <td className="py-2 text-right">{formatCOP(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + QR */}
        <div className="mt-4 flex items-start justify-between gap-6">
          <div className="flex flex-col items-center">
            {qrImg ? (
              <img src={qrImg} alt="QR DIAN" className="h-36 w-36" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded border text-center text-[10px] text-muted-foreground">
                QR disponible al emitir
              </div>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">Código QR - DIAN</p>
          </div>
          <div className="w-56 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCOP(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Envío</span><span>{order.shipping_cost === 0 ? "—" : formatCOP(order.shipping_cost)}</span></div>
            <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCOP(inv.total || order.total)}</span></div>
          </div>
        </div>

        <p className="mt-8 border-t pt-3 text-center text-[10px] text-muted-foreground">
          Representación gráfica de la {TYPE_TITLE[inv.type] || "documento"}. Generada por GRAFIBLESS · Proveedor tecnológico: Factus.
        </p>
      </div>
    </div>
  );
}
