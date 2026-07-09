import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Tag } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCategories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await api.get("/admin/categories")).data,
  });

  const create = useMutation({
    mutationFn: (n) => api.post("/admin/categories", { name: n }),
    onSuccess: () => {
      toast.success("Categoría creada");
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.success("Categoría eliminada");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Categorías</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Crea las categorías de tus productos y servicios. También se crean
        automáticamente al asignarlas a un producto.
      </p>

      <Card className="mb-6">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate(name.trim());
            }}
            className="flex gap-2"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: DTF, Sublimación, Vinilo..."
              data-testid="category-name-input"
            />
            <Button type="submit" disabled={create.isPending} data-testid="category-create-button">
              <Plus className="mr-2 h-4 w-4" /> Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Aún no hay categorías.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4">
                  <span className="flex items-center gap-2 font-medium capitalize">
                    <Tag className="h-4 w-4 text-muted-foreground" /> {c.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la categoría "${c.name}"?`)) remove.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
