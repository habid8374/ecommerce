import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Pencil, MapPin, FileText, Truck, Home } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import ProfileFields, { DOC_TYPES } from "@/components/ProfileFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REQUIRED = ["first_name", "last_name", "doc_number", "phone", "address", "city", "region"];

function isComplete(u) {
  return u && REQUIRED.every((k) => (u[k] || "").toString().trim());
}

function pickProfile(u) {
  return {
    first_name: u?.first_name || "",
    last_name: u?.last_name || "",
    doc_type: u?.doc_type || "CC",
    doc_number: u?.doc_number || "",
    phone: u?.phone || "",
    address: u?.address || "",
    city: u?.city || "",
    region: u?.region || "",
    postal_code: u?.postal_code || "",
    address_notes: u?.address_notes || "",
  };
}

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(!isComplete(user));
  const [form, setForm] = useState(pickProfile(user));
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState("carrier");
  const [zone, setZone] = useState("");
  const [cod, setCod] = useState(false);

  const { data: pub } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });
  const ship = pub?.shipping || {};
  const zones = ship.local_zones || [];

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  // Carrier rate by the customer's city (falls back to the flat cost).
  const carrierMatch = (ship.carrier_zones || []).find((z) => norm(z.name) === norm(user?.city));
  const carrierBase = carrierMatch ? carrierMatch.price : ship.carrier_cost || 0;
  const carrierFree = (ship.free_over || 0) && subtotal >= (ship.free_over || 0);
  const codAllowed = method === "carrier" && ship.carrier_cod && !carrierFree && carrierBase > 0;

  let shippingCost = 0;
  if (method === "local") {
    shippingCost = zones.find((z) => z.name === zone)?.price ?? 0;
  } else if (carrierFree) {
    shippingCost = 0;
  } else if (cod && ship.carrier_cod) {
    shippingCost = 0; // paid on delivery (contraentrega)
  } else {
    shippingCost = carrierBase;
  }
  const total = subtotal + shippingCost;
  const canPay = !editing && (method === "carrier" || (method === "local" && zone));

  if (items.length === 0) return <Navigate to="/cart" replace />;

  const onField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Datos guardados");
      setEditing(false);
    } catch (err) {
      toast.error(apiError(err, "No se pudieron guardar los datos"));
    } finally {
      setSaving(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const { data: order } = await api.post("/orders", {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        shipping_method: method,
        shipping_zone: method === "local" ? zone : "",
        shipping_cod: method === "carrier" ? cod : false,
      });
      const { data: intent } = await api.post(`/payments/orders/${order.id}/intent`);

      if (intent.enabled && intent.checkout_url) {
        clear();
        window.location.href = intent.checkout_url; // → Wompi
        return;
      }
      if (intent.simulate) {
        await api.post(`/payments/orders/${order.id}/simulate`);
      }
      clear();
      toast.success("Pedido creado");
      navigate(`/order-confirmation/${order.id}`, { replace: true });
    } catch (err) {
      toast.error(apiError(err, "No se pudo procesar el pedido"));
    } finally {
      setPaying(false);
    }
  };

  const docLabel = DOC_TYPES.find((d) => d.value === (user?.doc_type || "CC"))?.value;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Finalizar compra</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Completa tus datos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Los guardamos en tu perfil: la próxima compra será directa.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveProfile} className="space-y-6">
                  <ProfileFields values={form} onChange={onField} />
                  <Button type="submit" disabled={saving} data-testid="checkout-save-profile">
                    {saving ? "Guardando..." : "Guardar y continuar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Datos de envío y factura</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-muted-foreground">
                      {docLabel} {user.doc_number} · {user.phone}
                    </p>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p>{user.address}</p>
                    <p className="text-muted-foreground">
                      {user.city}, {user.region}
                      {user.postal_code ? ` · ${user.postal_code}` : ""}
                    </p>
                    {user.address_notes && (
                      <p className="italic text-muted-foreground">{user.address_notes}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Tu pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((i) => (
                <div key={i.product_id} className="flex justify-between text-sm">
                  <span className="truncate pr-2">
                    {i.quantity} × {i.name}
                  </span>
                  <span className="shrink-0">{formatCOP(i.price * i.quantity)}</span>
                </div>
              ))}
              {/* Shipping method */}
              <div className="border-t pt-3">
                <p className="mb-2 text-sm font-medium">Método de envío</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod("carrier")}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs",
                      method === "carrier" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                    )}
                    data-testid="ship-carrier"
                  >
                    <Truck className="h-5 w-5" /> Transportadora
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("local")}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs",
                      method === "local" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                    )}
                    data-testid="ship-local"
                  >
                    <Home className="h-5 w-5" /> Domicilio local
                  </button>
                </div>
                {method === "local" && (
                  <div className="mt-2">
                    <Select value={zone} onValueChange={setZone}>
                      <SelectTrigger data-testid="ship-zone">
                        <SelectValue placeholder="Elige tu zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((z) => (
                          <SelectItem key={z.name} value={z.name}>
                            {z.name} — {formatCOP(z.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {method === "carrier" && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Envío nacional por transportadora
                      {user?.city ? ` a ${user.city}` : ""}. Te compartiremos la guía cuando despachemos.
                    </p>
                    {codAllowed && (
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={cod}
                          onChange={(e) => setCod(e.target.checked)}
                          data-testid="ship-cod"
                        />
                        <span>
                          <span className="font-medium">Pagar el transporte contraentrega</span> — pagas{" "}
                          {formatCOP(carrierBase)} del envío al recibir el producto (no se cobra ahora).
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCOP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Envío</span>
                  <span>
                    {method === "carrier" && cod && carrierBase > 0
                      ? `Contraentrega (${formatCOP(carrierBase)})`
                      : shippingCost === 0
                      ? method === "carrier"
                        ? "Por cobrar / gratis"
                        : "Gratis"
                      : formatCOP(shippingCost)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatCOP(total)}</span>
                </div>
              </div>

              <Button
                className="mt-2 w-full"
                size="lg"
                disabled={paying || !canPay}
                onClick={pay}
                data-testid="checkout-pay-button"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {paying ? "Procesando..." : "Pagar con Wompi"}
              </Button>
              {editing ? (
                <p className="text-center text-xs text-muted-foreground">
                  Guarda tus datos para continuar al pago.
                </p>
              ) : method === "local" && !zone ? (
                <p className="text-center text-xs text-muted-foreground">
                  Selecciona tu zona de domicilio.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
