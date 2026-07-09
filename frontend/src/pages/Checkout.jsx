import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Pencil, MapPin, FileText } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import ProfileFields, { DOC_TYPES } from "@/components/ProfileFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
              <div className="border-t pt-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCOP(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Envío gratis en compras superiores a {formatCOP(150000)}.
                </p>
              </div>
              <Button
                className="mt-2 w-full"
                size="lg"
                disabled={paying || editing}
                onClick={pay}
                data-testid="checkout-pay-button"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {paying ? "Procesando..." : "Pagar con Wompi"}
              </Button>
              {editing && (
                <p className="text-center text-xs text-muted-foreground">
                  Guarda tus datos para continuar al pago.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
