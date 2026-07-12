import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { formatCOP, formatDate, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default function OrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: order } = useQuery({
    queryKey: ["order-print", id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });

  if (!order) {
    return <div className="p-10 text-center text-muted-foreground">Cargando orden...</div>;
  }

  const company = settings?.company || {};
  const addr = order.shipping_address || {};
  const status = ORDER_STATUS[order.status];

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:min-h-0 print:bg-white print:py-0">
      <style>{`@media print { html, body { height:auto !important } .no-print { display: none !important; } @page { margin: 14mm; } }`}</style>

      {/* Toolbar (hidden when printing) */}
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Button onClick={() => window.print()} data-testid="print-order">
          <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
        </Button>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-[820px] bg-white p-5 shadow-sm sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo_grafibless.jpg" alt="GRAFIBLESS" className="h-11 w-auto rounded-lg" />
            <div>
              <p className="text-xl font-extrabold tracking-tight">
                GRAFI<span className="text-primary">BLESS</span>
              </p>
              <p className="text-xs text-muted-foreground">Impresión DTF & Estampados</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right print:text-right">
            {company.name && <p className="font-medium text-foreground">{company.name}</p>}
            {company.nit && <p>NIT: {company.nit}</p>}
            {company.address && <p>{company.address}</p>}
            {(company.city || company.phone) && <p>{[company.city, company.phone].filter(Boolean).join(" · ")}</p>}
            {company.email && <p>{company.email}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orden de compra</h1>
            <p className="text-sm text-muted-foreground">Comprobante de venta</p>
          </div>
          <div className="text-sm sm:text-right print:text-right">
            <p><span className="text-muted-foreground">N°:</span> <span className="font-mono font-semibold">#{order.id.slice(0, 8)}</span></p>
            <p><span className="text-muted-foreground">Fecha:</span> {formatDate(order.created_at)}</p>
            <p>
              <span className="text-muted-foreground">Pago:</span>{" "}
              <span className={order.payment_status === "approved" ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                {PAYMENT_STATUS[order.payment_status] || order.payment_status}
              </span>
            </p>
            <p><span className="text-muted-foreground">Estado:</span> {status?.label}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mt-6 rounded-lg border p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
          <p className="font-medium">{order.customer_name || addr.full_name}</p>
          {(order.doc_type || order.doc_number) && (
            <p className="text-muted-foreground">{order.doc_type} {order.doc_number}</p>
          )}
          <p className="text-muted-foreground">{order.customer_email} · {addr.phone}</p>
          <p className="text-muted-foreground">
            {addr.address}, {addr.city} {addr.region} {addr.postal_code ? `· ${addr.postal_code}` : ""}
          </p>
          {addr.notes && <p className="italic text-muted-foreground">{addr.notes}</p>}
          <p className="mt-2 text-muted-foreground">
            <span className="font-medium text-foreground">Envío:</span>{" "}
            {order.shipping_method === "local"
              ? `Domicilio local — ${order.shipping_zone || ""}`
              : "Transportadora (nacional)"}
            {order.carrier_name ? ` · ${order.carrier_name}` : ""}
            {order.tracking_number ? ` · Guía: ${order.tracking_number}` : ""}
          </p>
        </div>

        {/* Items */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Descripción</th>
              <th className="py-2 text-center">Cant.</th>
              <th className="py-2 text-right">Precio</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.product_id} className="border-b">
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{formatCOP(it.price)}</td>
                <td className="py-2 text-right">{formatCOP(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCOP(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Envío</span>
              <span>
                {order.shipping_cod && order.shipping_due > 0
                  ? `Contraentrega (${formatCOP(order.shipping_due)})`
                  : order.shipping_cost === 0
                  ? "Gratis"
                  : formatCOP(order.shipping_cost)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Total</span>
              <span>{formatCOP(order.total)}</span>
            </div>
            {order.shipping_cod && order.shipping_due > 0 && (
              <p className="text-xs text-muted-foreground">
                * El transporte ({formatCOP(order.shipping_due)}) se paga contraentrega al recibir.
              </p>
            )}
          </div>
        </div>

        <p className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
          Gracias por tu compra en GRAFIBLESS · Este documento es un comprobante de venta.
        </p>
      </div>
    </div>
  );
}
