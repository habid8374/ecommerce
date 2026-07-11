import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X, Star } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { StarInput } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Downscale + compress a picked image to a small JPEG data URI.
async function fileToDataUrl(file, max = 1000, quality = 0.72) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Write-a-review dialog for a purchased product.
 * Props: open, onClose, product {id,name}, orderId, googleUrl, onSubmitted
 */
export default function ReviewDialog({ open, onClose, product, orderId, googleUrl, onSubmitted }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState([]);
  const [done, setDone] = useState(false);

  const reset = () => {
    setRating(0);
    setComment("");
    setPhotos([]);
    setDone(false);
  };

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - photos.length);
    for (const f of files) {
      try {
        const url = await fileToDataUrl(f);
        setPhotos((p) => (p.length < 4 ? [...p, url] : p));
      } catch {
        toast.error("No se pudo procesar una imagen");
      }
    }
    e.target.value = "";
  };

  const submit = useMutation({
    mutationFn: () =>
      api.post("/reviews", {
        product_id: product.id,
        order_id: orderId,
        rating,
        comment,
        photos,
      }),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      onSubmitted?.();
    },
    onError: (err) => toast.error(apiError(err, "No se pudo enviar la reseña")),
  });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        {done ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Star className="h-7 w-7 text-emerald-600" fill="#10b981" />
            </div>
            <DialogTitle className="text-lg">¡Gracias por tu opinión!</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu reseña se publicará luego de una breve revisión.
            </p>
            {googleUrl && (
              <a
                href={googleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4285F4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b78e0]"
              >
                <Star className="h-4 w-4" fill="#fff" /> Déjanos también una reseña en Google
              </a>
            )}
            <div className="mt-5">
              <Button variant="outline" onClick={close}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Califica: {product?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-1">
                <StarInput value={rating} onChange={setRating} />
                <span className="text-xs text-muted-foreground">
                  {["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"][rating] || "Toca una estrella"}
                </span>
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Cuéntanos qué te pareció el producto, la calidad, el estampado…"
                rows={4}
                data-testid="review-comment"
              />
              <div>
                <div className="flex flex-wrap gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-label="Quitar foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 4 && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-accent">
                      <ImagePlus className="h-5 w-5" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
                    </label>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Agrega hasta 4 fotos de tu producto (opcional).</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button
                onClick={() => submit.mutate()}
                disabled={rating === 0 || submit.isPending}
                data-testid="review-submit"
              >
                {submit.isPending ? "Enviando..." : "Publicar reseña"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
