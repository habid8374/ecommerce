import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Store,
  Tag,
  Settings,
  Menu,
  FileText,
  Boxes,
  Star,
} from "lucide-react";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DASHBOARD = { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard };
const SYSTEM = { to: "/admin/settings", label: "Ajustes", icon: Settings };

const GROUPS = [
  {
    id: "ventas",
    label: "Ventas",
    icon: ShoppingBag,
    items: [
      { to: "/admin/orders", label: "Pedidos", icon: ShoppingBag },
      { to: "/admin/invoices", label: "Facturación", icon: FileText },
      { to: "/admin/reviews", label: "Reseñas", icon: Star },
      { to: "/admin/customers", label: "Clientes", icon: Users },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: Package,
    items: [
      { to: "/admin/products", label: "Productos", icon: Package },
      { to: "/admin/categories", label: "Categorías", icon: Tag },
      { to: "/admin/inventory", label: "Inventario", icon: Boxes },
    ],
  },
];

function linkClass({ isActive }) {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  );
}

function NavContent({ onNavigate }) {
  const location = useLocation();
  // Open the accordion group that contains the active route.
  const activeGroups = GROUPS.filter((g) =>
    g.items.some((it) => location.pathname.startsWith(it.to))
  ).map((g) => g.id);

  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="mb-6 block px-2 pt-1" onClick={onNavigate}>
        <Logo size={26} />
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        <NavLink to={DASHBOARD.to} end={DASHBOARD.end} className={linkClass} onClick={onNavigate}>
          <DASHBOARD.icon className="h-4 w-4" /> {DASHBOARD.label}
        </NavLink>

        <Accordion type="multiple" defaultValue={activeGroups} className="w-full">
          {GROUPS.map((g) => (
            <AccordionItem key={g.id} value={g.id} className="border-none">
              <AccordionTrigger className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground hover:no-underline">
                <span className="flex items-center gap-3">
                  <g.icon className="h-4 w-4" /> {g.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pl-3">
                <div className="mt-1 flex flex-col gap-1 border-l pl-3">
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} className={linkClass} onClick={onNavigate}>
                      <it.icon className="h-4 w-4" /> {it.label}
                    </NavLink>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <NavLink to={SYSTEM.to} className={linkClass} onClick={onNavigate}>
          <SYSTEM.icon className="h-4 w-4" /> {SYSTEM.label}
        </NavLink>
      </nav>

      <Link
        to="/"
        onClick={onNavigate}
        className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Store className="h-4 w-4" /> Ver tienda
      </Link>
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background p-4 md:block">
        <NavContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with animated drawer */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir menú" data-testid="admin-menu-toggle">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <NavContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo size={24} />
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
