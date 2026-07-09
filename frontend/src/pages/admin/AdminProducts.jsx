import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatCOP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMPTY = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "",
  images: "",
  active: true,
};

const NEW_CATEGORY = "__new__";

function toForm(product) {
  if (!product) return { ...EMPTY };
  return { ...product, images: (product.images || []).join(", ") };
}

export default function AdminProducts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [newCat, setNewCat] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () =>
      (await api.get("/products", { params: { include_inactive: true, page_size: 100 } })).data,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  const save = useMutation({
    mutationFn: (payload) => {
      const body = {
        ...payload,
        price: Number(payload.price),
        stock: Number(payload.stock),
        images: payload.images
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return editing
        ? api.put(`/admin/products/${editing.id}`, body)
        : api.post("/admin/products", body);
    },
    onSuccess: () => {
      toast.success(editing ? "Producto actualizado" : "Producto creado");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setOpen(false);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/products/${id}`),
    onSuccess: () => {
      toast.success("Producto eliminado");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setNewCat(false);
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm(toForm(p));
    setNewCat(false);
    setOpen(true);
  };
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const products = data?.items || [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Button onClick={openNew} data-testid="product-new-button">
          <Plus className="mr-2 h-4 w-4" /> Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-4 p-4" data-testid="admin-product-row">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{p.name}</p>
                      {!p.active && <Badge variant="outline">Inactivo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{p.category}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-semibold">{formatCOP(p.price)}</p>
                    <p className={`text-sm ${p.stock <= 5 ? "text-amber-600" : "text-muted-foreground"}`}>
                      Stock: {p.stock}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar "${p.name}"?`)) remove.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <p className="py-16 text-center text-muted-foreground">
                  No hay productos. Crea el primero.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <form
            id="product-form"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" required value={form.name} onChange={update("name")} data-testid="product-name-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" value={form.description} onChange={update("description")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (COP) *</Label>
                <Input id="price" type="number" min="0" required value={form.price} onChange={update("price")} data-testid="product-price-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock *</Label>
                <Input id="stock" type="number" min="0" required value={form.stock} onChange={update("stock")} data-testid="product-stock-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              {newCat ? (
                <div className="flex gap-2">
                  <Input
                    value={form.category}
                    onChange={update("category")}
                    placeholder="Nombre de la nueva categoría"
                    autoFocus
                    data-testid="product-new-category-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewCat(false);
                      setForm((f) => ({ ...f, category: "" }));
                    }}
                  >
                    Elegir existente
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.category || undefined}
                  onValueChange={(v) => {
                    if (v === NEW_CATEGORY) {
                      setNewCat(true);
                      setForm((f) => ({ ...f, category: "" }));
                    } else {
                      setForm((f) => ({ ...f, category: v }));
                    }
                  }}
                >
                  <SelectTrigger data-testid="product-category-select">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_CATEGORY}>➕ Nueva categoría…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="images">Imágenes (URLs separadas por coma)</Label>
              <Textarea id="images" value={form.images} onChange={update("images")} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
              />
              <Label htmlFor="active">Activo (visible en la tienda)</Label>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="product-form" disabled={save.isPending} data-testid="product-save-button">
              {save.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
