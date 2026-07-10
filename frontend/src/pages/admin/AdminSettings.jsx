import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, CreditCard, Mail, Building2, Truck, Plus, Trash2, FileText } from "lucide-react";
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
  const [testing, setTesting] = useState(false);
  const [factusRanges, setFactusRanges] = useState(null);

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

      {/* Factus (electronic invoicing) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Facturación electrónica (Factus / DIAN)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.factus?.enabled} onCheckedChange={set("factus.enabled")} />
              <Label>Habilitar facturación electrónica (Factus)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.factus?.auto_emit} onCheckedChange={set("factus.auto_emit")} />
              <Label>Emitir automáticamente al aprobarse el pago</Label>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL base de Factus" value={form.factus?.base_url || ""} onChange={inp("factus.base_url")} placeholder="https://api-sandbox.factus.com.co" />
            <Field label="Rango numeración FACTURA (ej: 389)" type="number" value={form.factus?.numbering_range_id || 0} onChange={(e) => set("factus.numbering_range_id")(Number(e.target.value))} />
            <Field label="Rango numeración NOTA CRÉDITO (ej: 390)" type="number" value={form.factus?.numbering_range_id_credit || 0} onChange={(e) => set("factus.numbering_range_id_credit")(Number(e.target.value))} />
            <Field label="Rango numeración NOTA DÉBITO (ej: 391)" type="number" value={form.factus?.numbering_range_id_debit || 0} onChange={(e) => set("factus.numbering_range_id_debit")(Number(e.target.value))} />
            <Field label="Email (usuario Factus)" value={form.factus?.email || ""} onChange={inp("factus.email")} />
            <Field label="Contraseña" type="password" value={form.factus?.password || ""} onChange={inp("factus.password")} />
            <Field label="Client ID" value={form.factus?.client_id || ""} onChange={inp("factus.client_id")} />
            <Field label="Client Secret" type="password" value={form.factus?.client_secret || ""} onChange={inp("factus.client_secret")} />
          </div>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Catálogos DIAN (avanzado)</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="IVA por defecto (%)" type="number" value={form.factus?.default_iva || 0} onChange={(e) => set("factus.default_iva")(Number(e.target.value))} />
              <Field label="Municipio (municipality_id)" type="number" value={form.factus?.municipality_id || 0} onChange={(e) => set("factus.municipality_id")(Number(e.target.value))} />
              <Field label="Forma de pago (payment_form)" value={form.factus?.payment_form || ""} onChange={inp("factus.payment_form")} />
              <Field label="Método de pago (payment_method_code)" value={form.factus?.payment_method_code || ""} onChange={inp("factus.payment_method_code")} />
              <Field label="Tributo del cliente (customer_tribute_id)" type="number" value={form.factus?.customer_tribute_id || 0} onChange={(e) => set("factus.customer_tribute_id")(Number(e.target.value))} />
              <Field label="Unidad de medida (unit_measure_id)" type="number" value={form.factus?.unit_measure_id || 0} onChange={(e) => set("factus.unit_measure_id")(Number(e.target.value))} />
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                try {
                  await api.put("/admin/settings", (() => { const { _effective, ...p } = form; return p; })());
                  const { data } = await api.post("/admin/settings/factus/test");
                  if (data.ok) {
                    toast.success(data.message || "Conexión exitosa");
                    setFactusRanges(data.numbering_ranges || []);
                  } else {
                    toast.error(data.error || "Error de conexión");
                    setFactusRanges(null);
                  }
                } catch (err) {
                  toast.error(apiError(err, "No se pudo probar la conexión"));
                } finally {
                  setTesting(false);
                }
              }}
              data-testid="factus-test"
            >
              {testing ? "Probando..." : "Probar conexión con Factus"}
            </Button>
            <span className="text-xs text-muted-foreground">Guarda y valida las credenciales.</span>
          </div>

          {factusRanges && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="mb-2 font-medium">Rangos de numeración disponibles</p>
              {factusRanges.length === 0 ? (
                <p className="text-muted-foreground">
                  No se encontraron rangos. Créalos en tu panel de Factus.
                </p>
              ) : (
                <div className="space-y-1">
                  {factusRanges.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        set("factus.numbering_range_id")(r.id);
                        toast.success(`Rango ${r.id} seleccionado`);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-accent"
                    >
                      <span>
                        <b>ID {r.id}</b> · {r.document} {r.prefix ? `(${r.prefix})` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {form.factus?.numbering_range_id === r.id ? "✓ seleccionado" : "usar"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Al aprobarse el pago se emite la factura y se envía al correo del cliente.
            El listado y las notas crédito/débito están en el módulo <b>Facturación</b>.
          </p>
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Envíos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold">Transportadora (nacional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Costo transportadora (COP) — 0 = por cobrar" type="number" value={form.shipping.carrier_cost} onChange={(e) => set("shipping.carrier_cost")(Number(e.target.value))} />
              <Field label="Envío gratis desde (COP)" type="number" value={form.shipping.free_over} onChange={(e) => set("shipping.free_over")(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Domicilio local (zonas y valor)</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => {
                    const next = structuredClone(f);
                    next.shipping.local_zones = [...(next.shipping.local_zones || []), { name: "", price: 0 }];
                    return next;
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Agregar zona
              </Button>
            </div>
            <div className="space-y-2">
              {(form.shipping.local_zones || []).map((z, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Zona (ej: Barranquilla)"
                    value={z.name}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = structuredClone(f);
                        next.shipping.local_zones[i].name = e.target.value;
                        return next;
                      })
                    }
                  />
                  <Input
                    className="w-36"
                    type="number"
                    placeholder="Valor"
                    value={z.price}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = structuredClone(f);
                        next.shipping.local_zones[i].price = Number(e.target.value);
                        return next;
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setForm((f) => {
                        const next = structuredClone(f);
                        next.shipping.local_zones.splice(i, 1);
                        return next;
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              El cliente elegirá "Domicilio local" y su zona; se cobrará el valor de esa zona.
            </p>
          </div>
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
