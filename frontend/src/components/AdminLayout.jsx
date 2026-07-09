import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingBag, Users, Store } from "lucide-react";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/products", label: "Productos", icon: Package },
  { to: "/admin/customers", label: "Clientes", icon: Users },
];

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 flex-col border-r bg-background p-4 md:flex">
        <Link to="/admin" className="mb-6 px-2 pt-1">
          <Logo size={26} />
        </Link>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Panel de administración
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/"
          className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Store className="h-4 w-4" /> Ver tienda
        </Link>
      </aside>

      {/* Mobile top nav */}
      <div className="flex flex-1 flex-col">
        <div className="flex gap-1 overflow-x-auto border-b bg-background p-2 md:hidden">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </div>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
