import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const TYPE_TITLE = {
  invoice: "FACTURA ELECTRONICA DE VENTA",
  credit_note: "NOTA CREDITO ELECTRONICA",
  debit_note: "NOTA DEBITO ELECTRONICA",
};

function safeParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export default function InvoiceTicket() {
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

  if (!data) return <div className="p-10 text-center text-muted-foreground">Cargando tiquete...</div>;

  const inv = data.invoice;
  const order = data.order || {};
  const company = settings?.company || {};
  const fd = safeParse(inv.factus_data);
  const bill = fd?.data?.bill || fd?.data || fd || {};
  const dataLevel = fd?.data || {};
  const links = dataLevel.links || bill.links || {};
  const range = dataLevel.numbering_range || {};
  const totals = dataLevel.totals || {};

  const items = order.items?.length ? order.items : inv.items || [];
  const subtotal = order.subtotal ?? items.reduce((s, it) => s + (it.subtotal || 0), 0);
  const shippingCost = order.shipping_cost ?? 0;
  const taxAmount = Number(totals.tax_amount ?? 0) || 0;
  const totalAmount = totals.total ? Number(totals.total) : inv.total || order.total || 0;

  const number = inv.number || bill.number || "";
  const cufe = inv.cufe || bill.cufe || dataLevel.cufe || "";
  const qrContent = links.qr || bill.qr || dataLevel.qr || inv.qr || links.public_url || "";
  const qrImg = qrContent
    ? /^data:/.test(qrContent) || /\.(png|jpe?g|svg)(\?|$)/i.test(qrContent)
      ? qrContent
      : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`
    : "";

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print { display:none !important }
          /* No forzamos tamaño de página: en impresora láser (carta) la tirilla
             sale como una columna de 80mm centrada, sin estirarse; en térmica
             de 80mm ocupa el rollo. */
          @page { margin: 6mm }
          body { background: #fff }
          .ticket { margin: 0 auto !important }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[320px] items-center justify-between px-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Button size="sm" onClick={() => window.print()} data-testid="print-ticket">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <div className="ticket mx-auto w-[80mm] max-w-[80mm] bg-white px-3 py-4 font-mono text-[11px] leading-tight text-black shadow-sm print:shadow-none">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm font-extrabold tracking-wide">{company.name || "GRAFIBLESS"}</p>
          {company.nit && <p>NIT: {company.nit}</p>}
          {company.address && <p>{company.address}{company.city ? `, ${company.city}` : ""}</p>}
          {company.phone && <p>Tel: {company.phone}</p>}
          {company.email && <p>{company.email}</p>}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="text-center">
          <p className="font-bold">{TYPE_TITLE[inv.type] || "DOCUMENTO"}</p>
          <p className="font-bold">{number || "—"}</p>
          <p>{formatDate(inv.created_at)}</p>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Customer */}
        <div>
          <p><b>Cliente:</b> {inv.customer_name || order.customer_name}</p>
          {inv.doc_number && <p><b>Doc:</b> {order.doc_type} {inv.doc_number}</p>}
          {(inv.customer_email || order.customer_email) && <p>{inv.customer_email || order.customer_email}</p>}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Items */}
        <table className="w-full">
          <tbody>
            {items.map((it, i) => (
              <tr key={it.product_id || i}>
                <td className="align-top">
                  {it.name}
                  <br />
                  <span className="text-[10px]">{it.quantity} x {formatCOP(it.price)}</span>
                </td>
                <td className="whitespace-nowrap pl-1 text-right align-top">{formatCOP(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Totals */}
        <table className="w-full">
          <tbody>
            <tr><td>Subtotal</td><td className="text-right">{formatCOP(subtotal)}</td></tr>
            <tr><td>Envio</td><td className="text-right">{shippingCost === 0 ? "-" : formatCOP(shippingCost)}</td></tr>
            <tr><td>Base gravable</td><td className="text-right">{formatCOP(subtotal + shippingCost)}</td></tr>
            <tr><td>IVA</td><td className="text-right">{formatCOP(taxAmount)}</td></tr>
            <tr className="text-sm font-bold"><td>TOTAL</td><td className="text-right">{formatCOP(totalAmount)}</td></tr>
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black" />

        {/* DIAN */}
        <div className="text-center">
          {qrImg ? (
            <img src={qrImg} alt="QR DIAN" className="mx-auto h-28 w-28" />
          ) : (
            <p className="text-[10px]">QR no disponible</p>
          )}
          <p className="mt-1 text-[9px] font-bold">CUFE</p>
          <p className="break-all text-[8px] leading-tight">{cufe || "—"}</p>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="text-center text-[9px] leading-tight">
          {range.resolution_number && (
            <p>
              Resolucion DIAN {range.resolution_number}
              {range.prefix ? ` · ${range.prefix} ${range.from}-${range.to}` : ""}
            </p>
          )}
          <p className="mt-1">Representacion grafica · Proveedor: Factus</p>
          <p className="mt-1 font-bold">¡Gracias por tu compra!</p>
        </div>
      </div>
    </div>
  );
}
