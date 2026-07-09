import { ClipboardCheck, CreditCard, PackageOpen, Truck, PackageCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Order lifecycle, in order. `payment_status` isn't a stage here — the stages
// track fulfillment from creation to delivery.
const STAGES = [
  { key: "pending", label: "Pedido creado", icon: ClipboardCheck },
  { key: "paid", label: "Pago confirmado", icon: CreditCard },
  { key: "processing", label: "En preparación", icon: PackageOpen },
  { key: "shipped", label: "Enviado", icon: Truck },
  { key: "delivered", label: "Entregado", icon: PackageCheck },
];

const INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

export default function OrderTracker({ status }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <XCircle className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">Pedido cancelado</p>
          <p className="text-sm text-red-600/80">Este pedido fue cancelado.</p>
        </div>
      </div>
    );
  }

  const current = INDEX[status] ?? 0;

  return (
    <div className="flex items-start justify-between">
      {STAGES.map((stage, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="relative flex flex-1 flex-col items-center">
            {/* connector to previous step */}
            {i > 0 && (
              <span
                className={cn(
                  "absolute right-1/2 top-5 -z-0 h-1 w-full",
                  i <= current ? "bg-primary" : "bg-muted"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted bg-background text-muted-foreground",
                isCurrent && "ring-4 ring-primary/20"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span
              className={cn(
                "mt-2 max-w-[80px] text-center text-xs leading-tight",
                done ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
