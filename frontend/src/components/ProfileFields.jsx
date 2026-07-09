import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const DOC_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía (CC)" },
  { value: "CE", label: "Cédula de extranjería (CE)" },
  { value: "NIT", label: "NIT (empresa)" },
  { value: "PP", label: "Pasaporte (PP)" },
  { value: "TI", label: "Tarjeta de identidad (TI)" },
];

export const EMPTY_PROFILE = {
  first_name: "",
  last_name: "",
  doc_type: "CC",
  doc_number: "",
  phone: "",
  address: "",
  city: "",
  region: "",
  postal_code: "",
  address_notes: "",
};

/**
 * Renders the full customer profile fields (personal + document + address).
 * `values` is the profile object, `onChange(key, value)` updates it.
 */
export default function ProfileFields({ values, onChange }) {
  const field = (key) => (e) => onChange(key, e.target.value);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Datos personales
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">Nombres *</Label>
            <Input id="first_name" required value={values.first_name} onChange={field("first_name")} data-testid="profile-first-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Apellidos *</Label>
            <Input id="last_name" required value={values.last_name} onChange={field("last_name")} data-testid="profile-last-name" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de documento *</Label>
            <Select value={values.doc_type} onValueChange={(v) => onChange("doc_type", v)}>
              <SelectTrigger data-testid="profile-doc-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc_number">N° de documento *</Label>
            <Input id="doc_number" required value={values.doc_number} onChange={field("doc_number")} data-testid="profile-doc-number" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
            <Input id="phone" type="tel" required value={values.phone} onChange={field("phone")} placeholder="3001234567" data-testid="profile-phone" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dirección de entrega
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Dirección *</Label>
            <Input id="address" required value={values.address} onChange={field("address")} placeholder="Calle 1 # 2-3" data-testid="profile-address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad *</Label>
            <Input id="city" required value={values.city} onChange={field("city")} data-testid="profile-city" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Departamento *</Label>
            <Input id="region" required value={values.region} onChange={field("region")} data-testid="profile-region" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Código postal</Label>
            <Input id="postal_code" value={values.postal_code} onChange={field("postal_code")} data-testid="profile-postal" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_notes">Nota adicional de la dirección</Label>
            <Textarea id="address_notes" value={values.address_notes} onChange={field("address_notes")} placeholder="Apto, torre, referencia..." />
          </div>
        </div>
      </div>
    </div>
  );
}
