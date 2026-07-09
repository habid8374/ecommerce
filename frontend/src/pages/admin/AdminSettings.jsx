import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, CreditCard, Mail, Building2, Truck } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Field({ label, ...props }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get("/admin/settings")).data,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) {
    return (
      <div className="max-w-3xl space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  const set = (path) => (value) =>
    setForm((f) => {
      const next = structuredClone(f);
      let node = next;
      const keys = path.split(".");
      keys.slice(0, -1).forEach((k) => (node = node[k]));
      node[keys[keys.length - 1]] = value;
      return next;
    });

  const inp = (path) => (e) => set(path)(e.target.value);

  const save = async () => {
    setSaving(true);
    try {
      const { _effective, ...payload } = form;
      await api.put("/admin/settings", payload);
      toast.success("Configuración guardada");
    } catch (err) {
      toast.error(apiError(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const w = form.wompi;
  const activeBlock = w.environment === "production" ? "production" : "test";

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ajustes del sistema</h1>
        <Button onClick={save} disabled={saving} data-testid="settings-save">
          <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      {/* Wompi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Pasarela de pagos (Wompi)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Ambiente activo</Label>
            <Select value={w.environment} onValueChange={set("wompi.environment")}>
              <SelectTrigger className="w-full sm:w-64" data-testid="wompi-env-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Pruebas (sandbox)</SelectItem>
                <SelectItem value="production">Producción (cobros reales)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se usarán las credenciales del ambiente seleccionado.
              {form._effective && (
                <> Estado: <b>{form._effective.payments_mode}</b>.</>
              )}
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <p className="text-sm font-semibold">
              Credenciales {activeBlock === "production" ? "de PRODUCCIÓN" : "de PRUEBA"}
            </p>
            <Field label="Llave pública" value={w[activeBlock].public_key} onChange={inp(`wompi.${activeBlock}.public_key`)} placeholder={activeBlock === "test" ? "pub_test_..." : "pub_prod_..."} />
            <Field label="Llave privada" type="password" value={w[activeBlock].private_key} onChange={inp(`wompi.${activeBlock}.private_key`)} placeholder={activeBlock === "test" ? "prv_test_..." : "prv_prod_..."} />
            <Field label="Secreto de integridad" type="password" value={w[activeBlock].integrity_secret} onChange={inp(`wompi.${activeBlock}.integrity_secret`)} />
            <Field label="Secreto de eventos (webhook)" type="password" value={w[activeBlock].events_secret} onChange={inp(`wompi.${activeBlock}.events_secret`)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Puedes guardar las credenciales de ambos ambientes y solo cambiar el
            "Ambiente activo" para alternar entre pruebas y producción.
          </p>
        </CardContent>
      </Card>

      {/* Brevo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Correos (Brevo)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch checked={form.brevo.enabled} onCheckedChange={set("brevo.enabled")} />
            <Label>Enviar correos de notificación</Label>
          </div>
          <Field label="API Key de Brevo" type="password" value={form.brevo.api_key} onChange={inp("brevo.api_key")} placeholder="xkeysib-..." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del remitente" value={form.brevo.sender_name} onChange={inp("brevo.sender_name")} />
            <Field label="Correo del remitente" type="email" value={form.brevo.sender_email} onChange={inp("brevo.sender_email")} placeholder="ventas@tudominio.com" />
          </div>
          <p className="text-xs text-muted-foreground">
            El correo remitente debe estar verificado en tu cuenta de Brevo.
          </p>
        </CardContent>
      </Card>

      {/* Company */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Datos de la empresa (facturación)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social / Nombre" value={form.company.name} onChange={inp("company.name")} />
          <Field label="NIT" value={form.company.nit} onChange={inp("company.nit")} />
          <Field label="Dirección" value={form.company.address} onChange={inp("company.address")} />
          <Field label="Ciudad" value={form.company.city} onChange={inp("company.city")} />
          <Field label="Teléfono" value={form.company.phone} onChange={inp("company.phone")} />
          <Field label="Correo" type="email" value={form.company.email} onChange={inp("company.email")} />
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Envíos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Costo de envío (COP)" type="number" value={form.shipping.cost} onChange={(e) => set("shipping.cost")(Number(e.target.value))} />
          <Field label="Envío gratis desde (COP)" type="number" value={form.shipping.free_over} onChange={(e) => set("shipping.free_over")(Number(e.target.value))} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
