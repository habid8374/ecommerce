import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Check, EyeOff, Trash2, MessageSquare, BadgeCheck } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";
import { formatDate } from "@/lib/format";
import { Stars } from "@/components/StarRating";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { key: "pending", label: "Por aprobar" },
  { key: "approved", label: "Publicadas" },
  { key: "hidden", label: "Ocultas" },
  { key: "", label: "Todas" },
];

const STATUS = {
  pending: { label: "Por aprobar", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Publicada", className: "bg-emerald-100 text-emerald-700" },
  hidden: { label: "Oculta", className: "bg-neutral-200 text-neutral-600" },
};

export default function AdminReviews() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState("pending");
  const [replyFor, setReplyFor] = useState(null); // review id
  const [replyText, setReplyText] = useState("");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews", tab],
    queryFn: async () => (await api.get(`/admin/reviews${tab ? `?status=${tab}` : ""}`)).data,
    refetchInterval: 30000,
  });

  const moderate = useMutation({
    mutationFn: ({ id, ...patch }) => api.patch(`/admin/reviews/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      setReplyFor(null);
      setReplyText("");
    },
    onError: (err) => toast.error(apiError(err, "No se pudo actualizar")),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/reviews/${id}`),
    onSuccess: () => {
      toast.success("Reseña eliminada");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Reseñas</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : reviews.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No hay reseñas en esta vista.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const s = STATUS[r.status] || {};
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.product_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" /> Compra verificada
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Stars value={r.rating} size={15} />
                    <span className="text-muted-foreground">· {r.customer_name}</span>
                  </div>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  {r.photos?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.photos.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border">
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {r.admin_reply && (
                    <div className="mt-2 rounded-lg bg-muted/60 p-2 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground">Respuesta: </span>{r.admin_reply}
                    </div>
                  )}

                  {replyFor === r.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Escribe una respuesta pública…" rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => moderate.mutate({ id: r.id, admin_reply: replyText })} disabled={moderate.isPending}>Guardar respuesta</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReplyFor(null); setReplyText(""); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status !== "approved" && (
                        <Button size="sm" variant="outline" className="text-emerald-700" onClick={() => moderate.mutate({ id: r.id, status: "approved" })}>
                          <Check className="mr-1 h-4 w-4" /> Aprobar
                        </Button>
                      )}
                      {r.status !== "hidden" && (
                        <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, status: "hidden" })}>
                          <EyeOff className="mr-1 h-4 w-4" /> Ocultar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setReplyFor(r.id); setReplyText(r.admin_reply || ""); }}>
                        <MessageSquare className="mr-1 h-4 w-4" /> Responder
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          if (await confirm({ title: "Eliminar reseña", description: "¿Eliminar esta reseña de forma permanente?", confirmText: "Eliminar", destructive: true }))
                            remove.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
