const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value) {
  return COP.format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ORDER_STATUS = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  paid: { label: "Pagado", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  processing: { label: "En preparación", className: "bg-blue-100 text-blue-800 border-blue-200" },
  shipped: { label: "Enviado", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  delivered: { label: "Entregado", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" },
};

export const PAYMENT_STATUS = {
  pending: "Pendiente",
  approved: "Aprobado",
  declined: "Rechazado",
  error: "Error",
  voided: "Anulado",
};
