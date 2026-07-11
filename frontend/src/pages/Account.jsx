import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, Mail, Lock, Trash2 } from "lucide-react";
import { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import ProfileFields from "@/components/ProfileFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function Account() {
  const { user, updateProfile, changeEmail, changePassword, deleteAccount } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(pickProfile(user));
  const [savingProfile, setSavingProfile] = useState(false);
  const [email, setEmail] = useState({ email: user?.email || "", password: "" });
  const [pass, setPass] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState("");

  const onField = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(profile);
      toast.success("Datos actualizados");
    } catch (err) {
      toast.error(apiError(err, "No se pudieron guardar los datos"));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    setBusy("email");
    try {
      await changeEmail(email.email, email.password);
      toast.success("Correo actualizado");
      setEmail((s) => ({ ...s, password: "" }));
    } catch (err) {
      toast.error(apiError(err, "No se pudo cambiar el correo"));
    } finally {
      setBusy("");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pass.new_password !== pass.confirm) {
      toast.error("La nueva contraseña no coincide");
      return;
    }
    if (pass.new_password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setBusy("pass");
    try {
      await changePassword(pass.current_password, pass.new_password);
      toast.success("Contraseña actualizada");
      setPass({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(apiError(err, "No se pudo cambiar la contraseña"));
    } finally {
      setBusy("");
    }
  };

  const removeAccount = async () => {
    const ok = await confirm({
      title: "Eliminar mi cuenta",
      description:
        "Esta acción es permanente. Se eliminará tu cuenta y tus reseñas. Tus pedidos ya realizados se conservan por temas contables. ¿Deseas continuar?",
      confirmText: "Eliminar mi cuenta",
      destructive: true,
    });
    if (!ok) return;
    const pwd = window.prompt("Confirma tu contraseña para eliminar la cuenta:");
    if (!pwd) return;
    setBusy("delete");
    try {
      await deleteAccount(pwd);
      toast.success("Tu cuenta fue eliminada");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(apiError(err, "No se pudo eliminar la cuenta"));
    } finally {
      setBusy("");
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos personales y de envío</CardTitle>
          <p className="text-sm text-muted-foreground">Se usan para tu factura y para el envío de tus pedidos.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-6">
            <ProfileFields values={profile} onChange={onField} />
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Mail className="h-5 w-5" /> Correo electrónico</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Nuevo correo</Label>
              <Input id="email" type="email" required value={email.email} onChange={(e) => setEmail((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-pass">Contraseña actual (para confirmar)</Label>
              <Input id="email-pass" type="password" required value={email.password} onChange={(e) => setEmail((s) => ({ ...s, password: e.target.value }))} />
            </div>
            <Button type="submit" variant="outline" disabled={busy === "email"}>
              {busy === "email" ? "Guardando..." : "Actualizar correo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5" /> Contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Contraseña actual</Label>
              <Input id="cur" type="password" required value={pass.current_password} onChange={(e) => setPass((s) => ({ ...s, current_password: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new">Nueva contraseña</Label>
                <Input id="new" type="password" required value={pass.new_password} onChange={(e) => setPass((s) => ({ ...s, new_password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfm">Confirmar</Label>
                <Input id="cfm" type="password" required value={pass.confirm} onChange={(e) => setPass((s) => ({ ...s, confirm: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" variant="outline" disabled={busy === "pass"}>
              {busy === "pass" ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive"><Trash2 className="h-5 w-5" /> Eliminar cuenta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Elimina tu cuenta de forma permanente. Tus pedidos ya realizados se conservan por temas contables.
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={removeAccount} disabled={busy === "delete"}>
            {busy === "delete" ? "Eliminando..." : "Eliminar mi cuenta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
