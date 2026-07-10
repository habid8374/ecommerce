import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import ProfileFields, { EMPTY_PROFILE } from "@/components/ProfileFields";
import { REGISTER } from "@/constants/testIds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [account, setAccount] = useState({ email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const onProfile = (key, value) => setProfile((p) => ({ ...p, [key]: value }));
  const onAccount = (key) => (e) => setAccount((a) => ({ ...a, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (account.password !== account.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (account.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register({ ...profile, email: account.email, password: account.password });
      toast.success("Cuenta creada. ¡Bienvenido!");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(apiError(err, "No se pudo crear la cuenta"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="mb-6 flex justify-center">
        <img src="/logo_grafibless.jpg" alt="GRAFIBLESS" className="h-16 w-auto rounded-xl" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Completa tus datos una sola vez. Los usaremos para tu factura y para
            el envío, así tu compra es más rápida.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <ProfileFields values={profile} onChange={onProfile} />

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Datos de acceso
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">Correo *</Label>
                  <Input id="email" type="email" required value={account.email} onChange={onAccount("email")} data-testid={REGISTER.emailInput} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input id="password" type="password" required value={account.password} onChange={onAccount("password")} data-testid={REGISTER.passwordInput} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar contraseña *</Label>
                  <Input id="confirm" type="password" required value={account.confirm} onChange={onAccount("confirm")} data-testid={REGISTER.passwordConfirmInput} />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading} data-testid={REGISTER.submitButton}>
              {loading ? "Creando..." : "Crear cuenta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-medium text-foreground underline" data-testid={REGISTER.loginLink}>
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
