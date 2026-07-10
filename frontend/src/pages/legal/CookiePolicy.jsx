import LegalLayout, { Section } from "@/components/LegalLayout";

export default function CookiePolicy() {
  return (
    <LegalLayout title="Política de cookies" updated="2026">
      <p>
        Esta política explica cómo GRAFIBLESS utiliza cookies y tecnologías
        similares cuando navegas por nuestro sitio.
      </p>

      <Section title="1. ¿Qué son las cookies?">
        <p>
          Las cookies son pequeños archivos que se guardan en tu dispositivo cuando
          visitas un sitio web. Permiten recordar tus preferencias y mantener tu
          sesión activa, entre otras funciones.
        </p>
      </Section>

      <Section title="2. Cookies que utilizamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Necesarias:</b> imprescindibles para el funcionamiento del sitio,
            como mantener tu sesión iniciada y el contenido de tu carrito.
          </li>
          <li>
            <b>De preferencias:</b> recuerdan ajustes como tu última búsqueda o
            configuración de visualización.
          </li>
          <li>
            <b>De terceros:</b> algunos servicios que usamos (por ejemplo, la
            pasarela de pagos) pueden establecer sus propias cookies al procesar una
            transacción.
          </li>
        </ul>
      </Section>

      <Section title="3. Gestión de cookies">
        <p>
          Puedes configurar o eliminar las cookies desde los ajustes de tu
          navegador. Ten en cuenta que desactivar las cookies necesarias puede
          afectar el funcionamiento del sitio, como el proceso de compra.
        </p>
      </Section>

      <Section title="4. Cambios">
        <p>
          Podemos actualizar esta política de cookies; la versión vigente estará
          siempre disponible en esta página.
        </p>
      </Section>
    </LegalLayout>
  );
}
