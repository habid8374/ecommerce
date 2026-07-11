import { useState } from "react";
import { Link, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Package, LogOut, LayoutDashboard, Search, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import AxentiaLogo from "@/components/AxentiaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function SearchBar({ className = "" }) {
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get("search") || "");
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate(term.trim() ? `/?search=${encodeURIComponent(term.trim())}` : "/");
      }}
      className={`flex w-full items-stretch ${className}`}
    >
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar productos en GRAFIBLESS..."
        className="h-11 rounded-r-none border-0 bg-white text-black focus-visible:ring-0 focus-visible:ring-offset-0"
        data-testid="header-search-input"
      />
      <button
        type="submit"
        className="flex h-11 items-center rounded-r-md bg-primary px-4 text-primary-foreground transition-colors hover:bg-primary/90"
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </button>
    </form>
  );
}

export default function StoreLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    const name = (user?.name || "").split(" ")[0];
    logout();
    toast.success(name ? `¡Hasta pronto, ${name}!` : "¡Hasta pronto!", {
      description: "Cerraste sesión. Gracias por visitarnos, te esperamos de vuelta pronto. 👋",
    });
    navigate("/");
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  const { data: pub } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });
  // WhatsApp: normalize the configured number to an international wa.me link
  // (Colombia +57 when a 10-digit local number is entered).
  const waDigits = String(pub?.company?.whatsapp || "").replace(/\D/g, "");
  const waNumber = waDigits && !waDigits.startsWith("57") && waDigits.length === 10 ? `57${waDigits}` : waDigits;
  const companyName = pub?.company?.name || "GRAFIBLESS";
  const companyCity = pub?.company?.city || "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 bg-black text-white shadow-md">
        {/* Main bar */}
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center" aria-label="GRAFIBLESS - Inicio">
            <img src="/logo_grafibless.jpg" alt="GRAFIBLESS" className="h-10 w-auto" />
          </Link>

          <SearchBar className="mx-2 hidden max-w-2xl flex-1 md:flex" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Customers and admins log in through the same "Ingresar" button;
                admins are redirected to the panel automatically. The discreet
                admin link lives in the footer. */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-white hover:bg-white/10 hover:text-white"
                    data-testid="nav-user-menu"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    <Package className="mr-2 h-4 w-4" /> Mis pedidos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <User className="mr-2 h-4 w-4" /> Mi cuenta
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Panel admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
                className="gap-2 text-white hover:bg-white/10 hover:text-white"
                data-testid="nav-login-button"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Ingresar</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              asChild
              className="relative text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/cart" data-testid="nav-cart-button" aria-label="Carrito">
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                    {count}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="px-4 pb-3 md:hidden">
          <SearchBar />
        </div>

        {/* Secondary category bar */}
        <nav className="border-t border-white/10 bg-neutral-900">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 text-sm">
            <Link
              to="/"
              className="whitespace-nowrap rounded px-3 py-1 font-medium text-white/90 hover:bg-white/10"
            >
              Inicio
            </Link>
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c}
                to={`/?category=${encodeURIComponent(c)}`}
                className="whitespace-nowrap rounded px-3 py-1 capitalize text-white/70 hover:bg-white/10 hover:text-white"
              >
                {c}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="mt-auto bg-[#0e1a2c] text-white">
        {/* Top accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[#1f8f9e] via-[#22c197] to-transparent" />

        <div className="mx-auto max-w-7xl px-6 py-10">
          {/* Brand + quick links */}
          <div className="flex flex-col items-center gap-4 border-b border-white/10 pb-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <img src="/logo_grafibless.jpg" alt="GRAFIBLESS" className="h-11 w-auto rounded-md" />
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <Link to="/" className="hover:text-white">Inicio</Link>
              <Link to="/orders" className="hover:text-white">Mis pedidos</Link>
              <span className="text-white/40">Pagos seguros con Wompi</span>
            </div>
          </div>

          {/* Legal row */}
          <div className="mt-6 flex flex-col items-center gap-4 text-xs text-white/60 lg:flex-row lg:justify-between">
            <p className="order-2 text-center lg:order-1">
              © {new Date().getFullYear()} {companyName}
              {companyCity ? ` · ${companyCity}, Colombia.` : " · Colombia."}
            </p>
            <div className="order-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:order-2">
              <Link to="/privacidad" className="transition-colors hover:text-white">Política de privacidad</Link>
              <span className="text-white/25">·</span>
              <Link to="/cookies" className="transition-colors hover:text-white">Política de cookies</Link>
              <span className="text-white/25">·</span>
              <Link to="/terminos" className="transition-colors hover:text-white">Términos y condiciones</Link>
            </div>
            <p className="order-3 text-center lg:text-right">Hecho con dedicación en el Atlántico, Colombia.</p>
          </div>

          {/* Powered by Axentia */}
          <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-6">
            <span className="text-xs text-white/50">Powered by</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/95 p-0.5">
              <AxentiaLogo size={18} />
            </span>
            <span className="text-sm font-bold tracking-tight text-white">Axentia</span>
            {!isAdmin && (
              <button
                onClick={() => navigate("/login")}
                className="ml-3 text-[11px] text-white/30 transition-colors hover:text-white/70"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button (number configurable in Ajustes) */}
      {waNumber && (
        <a
          href={`https://wa.me/${waNumber}?text=Hola%20GRAFIBLESS%2C%20quiero%20informaci%C3%B3n`}
          target="_blank"
          rel="noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#1ebe5b]"
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
            <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.59 4.463 1.71 6.41L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.234 1.588h.005c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.332-6.635-3.752-9.056A12.72 12.72 0 0 0 16.004 3.2Zm0 23.2h-.004a10.6 10.6 0 0 1-5.4-1.48l-.388-.23-4.003 1.05 1.068-3.9-.253-.4a10.56 10.56 0 0 1-1.62-5.64c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.108 7.52 3.118a10.56 10.56 0 0 1 3.114 7.518c0 5.86-4.77 10.63-10.63 10.63Zm5.83-7.96c-.32-.16-1.89-.93-2.183-1.037-.293-.107-.507-.16-.72.16-.213.32-.826 1.037-1.013 1.25-.187.213-.373.24-.693.08-.32-.16-1.35-.498-2.57-1.586-.95-.847-1.59-1.893-1.777-2.213-.187-.32-.02-.493.14-.653.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.734-.986-2.374-.26-.624-.523-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.094-1.12 2.667 0 1.573 1.146 3.093 1.306 3.307.16.213 2.253 3.44 5.46 4.824.763.33 1.36.527 1.824.674.767.244 1.464.21 2.016.127.615-.092 1.89-.773 2.156-1.52.267-.747.267-1.387.187-1.52-.08-.133-.293-.213-.613-.373Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
