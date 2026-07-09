import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { LogoMark } from "@/components/Logo";
import { REGISTER } from "@/constants/testIds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      toast.success("Cuenta creada");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(apiError(err, "No se pudo crear la cuenta"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className="rounded-xl bg-black p-2">
          <LogoMark size={30} />
        </span>
        <span className="text-2xl font-extrabold tracking-tight">
          GRAFI<span className="text-primary">BLESS</span>
        </span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" required value={form.name} onChange={update("name")} data-testid={REGISTER.nameInput} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={form.email} onChange={update("email")} data-testid={REGISTER.emailInput} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono / WhatsApp</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={update("phone")} placeholder="3001234567" data-testid="register-phone-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={form.password} onChange={update("password")} data-testid={REGISTER.passwordInput} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input id="confirm" type="password" required value={form.confirm} onChange={update("confirm")} data-testid={REGISTER.passwordConfirmInput} />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid={REGISTER.submitButton}>
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
