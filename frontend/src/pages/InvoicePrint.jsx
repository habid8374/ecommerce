import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
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

  // Line items: prefer the local order; fall back to the invoice's own items
  // (populated when the invoice was imported from Factus without a local order).
  const items = order.items?.length ? order.items : inv.items || [];
  const subtotal = order.subtotal ?? items.reduce((s, it) => s + (it.subtotal || 0), 0);
  const shippingCost = order.shipping_cost ?? 0;

  const dataLevel = fd?.data || {};
  const links = dataLevel.links || bill.links || {};
  const range = dataLevel.numbering_range || {};
  const totals = dataLevel.totals || {};
  const taxAmount = Number(totals.tax_amount ?? 0) || 0;
  const totalAmount = totals.total ? Number(totals.total) : (inv.total || order.total || 0);
  const number = inv.number || bill.number || "";
  const cufe = inv.cufe || bill.cufe || bill.cude || dataLevel.cufe || "";
  const publicUrl = inv.public_url || links.public_url || "";
  // Factus returns the QR at data.links.qr (a DIAN URL to encode) or as a
  // base64 image. Prefer a ready image; otherwise turn the URL into a QR image.
  const qrImage = bill.qr_image || dataLevel.qr_image || (inv.qr?.startsWith?.("data:") ? inv.qr : "");
  const qrContent = links.qr || bill.qr || dataLevel.qr || inv.qr || publicUrl || "";
  const qrImg = qrImage
    ? qrImage
    : qrContent
    ? /^data:/.test(qrContent) || /\.(png|jpe?g|svg)(\?|$)/i.test(qrContent)
      ? qrContent
      : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrContent)}`
    : "";

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:min-h-0 print:bg-white print:py-0">
      <style>{`@media print { html, body { height:auto !important } .no-print { display:none !important } @page { margin: 12mm } }`}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Button onClick={() => window.print()} data-testid="print-invoice">
          <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      <div className="mx-auto max-w-[820px] bg-white p-5 text-[13px] shadow-sm sm:p-10 print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo_grafibless.jpg" alt="GRAFIBLESS" className="h-11 w-auto rounded-lg" />
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
          <div className="shrink-0 rounded-lg border p-3 sm:text-right print:text-right">
            <p className="text-sm font-bold uppercase">{TYPE_TITLE[inv.type] || "Documento"}</p>
            <p className="font-mono text-lg font-bold">{number || "—"}</p>
            <p className="text-xs text-muted-foreground">Fecha: {formatDate(inv.created_at)}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mt-4">
          <div className="rounded-lg border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Adquiriente</p>
            <p className="font-medium">{inv.customer_name || addr.full_name}</p>
            <p className="text-muted-foreground">{order.doc_type} {inv.doc_number}</p>
            <p className="text-muted-foreground">{inv.customer_email || order.customer_email}</p>
            <p className="text-muted-foreground">{addr.phone}</p>
            <p className="text-muted-foreground">{addr.address}{addr.city ? `, ${addr.city}` : ""} {addr.region}</p>
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
            {items.map((it, i) => (
              <tr key={it.product_id || i} className="border-b">
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{formatCOP(it.price)}</td>
                <td className="py-2 text-right">{formatCOP(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* QR + CUFE (left) and Totals (right) */}
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {qrImg ? (
                <img src={qrImg} alt="QR DIAN" className="h-32 w-32" />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded border text-center text-[10px] text-muted-foreground">
                  QR no disponible
                </div>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">Código QR - DIAN</p>
            </div>
            <div className="max-w-[260px] text-xs">
              <p className="font-semibold uppercase text-muted-foreground">CUFE</p>
              <p className="break-all font-mono text-[10px] leading-relaxed">{cufe || "—"}</p>
              {inv.reason && <p className="mt-2"><b>Motivo:</b> {inv.reason}</p>}
              {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-primary underline">
                  Validar en DIAN
                </a>
              )}
            </div>
          </div>
          <div className="w-full shrink-0 space-y-1 sm:w-52 print:w-52">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCOP(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Envío</span><span>{shippingCost === 0 ? "—" : formatCOP(shippingCost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Base gravable</span><span>{formatCOP(subtotal + shippingCost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IVA</span><span>{formatCOP(taxAmount)}</span></div>
            <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCOP(totalAmount)}</span></div>
          </div>
        </div>

        <div className="mt-8 border-t pt-3 text-center text-[10px] text-muted-foreground">
          {range.resolution_number && (
            <p>
              Resolución DIAN No. {range.resolution_number}
              {range.start_date ? ` de ${range.start_date}` : ""} · Prefijo {range.prefix} del{" "}
              {range.from} al {range.to}
              {range.end_date ? ` · Vigencia hasta ${range.end_date}` : ""}
            </p>
          )}
          <p className="mt-1">
            Representación gráfica de la {TYPE_TITLE[inv.type] || "documento"}. Generada por GRAFIBLESS · Proveedor tecnológico: Factus.
          </p>
        </div>
      </div>
    </div>
  );
}
