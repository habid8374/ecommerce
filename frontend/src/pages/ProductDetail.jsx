import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, ArrowLeft, Minus, Plus, PackageSearch, BadgeCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCOP, formatDate } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { Stars } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="#f1f1f1"/><text x="50%" y="50%" fill="#bbb" font-family="sans-serif" font-size="24" text-anchor="middle" dy=".3em">Sin imagen</text></svg>'
  );

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
  });
  // Reviews are stored by the product's real id (the URL uses the slug), so
  // query them with product.id once the product has loaded.
  const { data: reviews } = useQuery({
    queryKey: ["product-reviews", product?.id],
    queryFn: async () => (await api.get(`/products/${product.id}/reviews`)).data,
    enabled: !!product?.id,
  });
  const { data: pub } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });
  const googleReviewUrl = pub?.company?.google_review_url || "";

  if (isLoading) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Producto no encontrado.</p>
        <Button asChild variant="link">
          <Link to="/">Volver al catálogo</Link>
        </Button>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;
  const summary = reviews?.summary || { avg: 0, count: 0, distribution: {} };
  const reviewItems = reviews?.items || [];

  // SEO: structured data so Google can show ⭐ stars in the results.
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.images?.[0] || undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "COP",
      availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };
  if (summary.count > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: summary.avg,
      reviewCount: summary.count,
    };
    ld.review = reviewItems.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.customer_name },
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.comment || undefined,
    }));
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-muted">
          <img
            src={product.images?.[0] || PLACEHOLDER}
            alt={product.name}
            onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
            className="aspect-square w-full object-cover"
          />
        </div>

        <div>
          <Badge variant="secondary" className="mb-3 capitalize">
            {product.category}
          </Badge>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.rating_count > 0 && (
            <a href="#resenas" className="mt-2 inline-flex items-center gap-2 text-sm">
              <Stars value={product.rating_avg} size={16} />
              <span className="font-medium">{product.rating_avg.toFixed(1)}</span>
              <span className="text-muted-foreground">({product.rating_count} reseñas)</span>
            </a>
          )}
          <p className="mt-4 text-3xl font-bold">{formatCOP(product.price)}</p>
          <p className="mt-4 whitespace-pre-line text-muted-foreground">
            {product.description || "Sin descripción."}
          </p>

          <div className="mt-6">
            {outOfStock ? (
              <p className="font-medium text-destructive">Producto agotado</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {product.stock} unidades disponibles
              </p>
            )}
          </div>

          {!outOfStock && (
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-md border">
                <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-medium" data-testid="detail-qty">
                  {qty}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="lg"
                className="flex-1"
                data-testid="detail-add-to-cart"
                onClick={() => {
                  addItem(product, qty);
                  toast.success("Agregado al carrito", { description: product.name });
                }}
              >
                <ShoppingCart className="mr-2 h-5 w-5" /> Agregar al carrito
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <PackageSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p>
              Crea tu cuenta o inicia sesión para comprar y{" "}
              <span className="font-medium text-foreground">
                seguir el proceso de tu pedido o servicio
              </span>{" "}
              (DTF, sublimación, corte de vinilo, gran formato…) en cada etapa
              hasta la entrega.
            </p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section id="resenas" className="mt-14 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Opiniones de clientes</h2>
          {googleReviewUrl && (
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#4285F4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3b78e0]"
            >
              <Star className="h-4 w-4" fill="#fff" /> Reséñanos en Google
            </a>
          )}
        </div>
        {summary.count === 0 ? (
          <p className="mt-3 text-muted-foreground">
            Aún no hay reseñas. Compra este producto y cuéntanos qué te pareció; tu opinión ayuda a otros clientes.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-6 rounded-xl border p-5 sm:flex-row sm:items-center">
              <div className="text-center">
                <div className="text-4xl font-bold">{summary.avg.toFixed(1)}</div>
                <Stars value={summary.avg} size={18} />
                <div className="mt-1 text-xs text-muted-foreground">{summary.count} reseñas</div>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((s) => {
                  const n = summary.distribution[s] || 0;
                  const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-muted-foreground">{s}★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[#f5b301]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-muted-foreground">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {reviewItems.map((r) => (
                <div key={r.id} className="border-b pb-5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.customer_name}</span>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" /> Compra verificada
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="mt-1"><Stars value={r.rating} size={15} /></div>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  {r.photos?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.photos.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" className="h-20 w-20 overflow-hidden rounded-lg border">
                          <img src={src} alt="Foto de reseña" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {r.admin_reply && (
                    <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                      <p className="text-xs font-semibold text-muted-foreground">Respuesta de la tienda</p>
                      <p className="mt-0.5">{r.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape "<" so user text (e.g. a review with "</script>") can't break
          // out of the JSON-LD block (stored XSS defense).
          __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
