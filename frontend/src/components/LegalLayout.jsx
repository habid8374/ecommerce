import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Shared shell for the legal pages (privacy, cookies, terms). */
export default function LegalLayout({ title, updated, children }) {
  const { data: pub } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api.get("/settings/public")).data,
  });
  const company = pub?.company || {};
  const name = company.name || "GRAFIBLESS";

  return (
    <div className="mx-auto max-w-3xl py-4">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {name}
        {company.nit ? ` · NIT ${company.nit}` : ""}
        {updated ? ` · Última actualización: ${updated}` : ""}
      </p>
      <div className="prose-legal mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
      <p className="mt-8 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        Este documento es de carácter informativo y puede requerir ajustes según
        la normativa vigente y tu operación. Ante dudas legales, consulta a un
        profesional.
      </p>
    </div>
  );
}

/** Small helpers for consistent section styling. */
export function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
