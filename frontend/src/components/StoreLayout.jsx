import { useState } from "react";
import { Link, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Package,
  LogOut,
  LayoutDashboard,
  Search,
  User,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import Logo from "@/components/Logo";
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

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 bg-black text-white shadow-md">
        {/* Main bar */}
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center" aria-label="GRAFIBLESS - Inicio">
            <Logo size={30} />
          </Link>

          <SearchBar className="mx-2 hidden max-w-2xl flex-1 md:flex" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Single admin entry point: a shortcut for guests/customers.
                Admins reach the panel from their account menu ("Panel admin"). */}
            {!isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
                className="hidden gap-2 text-white hover:bg-white/10 hover:text-white sm:inline-flex"
                data-testid="nav-admin-button"
              >
                <ShieldCheck className="h-4 w-4" /> Admin
              </Button>
            )}

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
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Panel admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
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

      <footer className="mt-auto border-t border-white/10 bg-black py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center">
          <Logo size={28} />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
            <Link to="/" className="hover:text-white">Inicio</Link>
            <Link to="/orders" className="hover:text-white">Mis pedidos</Link>
            {!isAdmin && (
              <button onClick={() => navigate("/login")} className="hover:text-white">
                Admin
              </button>
            )}
          </div>
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} GRAFIBLESS · Pagos seguros con Wompi
          </p>
        </div>
      </footer>
    </div>
  );
}
