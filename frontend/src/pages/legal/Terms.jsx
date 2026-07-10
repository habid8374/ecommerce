import LegalLayout, { Section } from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Términos y condiciones" updated="2026">
      <p>
        Estos términos regulan el uso del sitio y la compra de productos y
        servicios de GRAFIBLESS. Al registrarte o realizar un pedido aceptas estas
        condiciones.
      </p>

      <Section title="1. Productos y servicios">
        <p>
          Ofrecemos productos personalizados e impresión de gran formato (DTF,
          sublimación, corte de vinilo, entre otros). Las imágenes y descripciones
          son referenciales; los acabados pueden variar levemente según el material
          y el proceso de personalización.
        </p>
      </Section>

      <Section title="2. Precios y pagos">
        <p>
          Los precios se expresan en pesos colombianos (COP) e incluyen los
          impuestos aplicables cuando corresponda. El pago se realiza a través de la
          pasarela Wompi. El pedido se confirma una vez aprobado el pago.
        </p>
      </Section>

      <Section title="3. Facturación electrónica">
        <p>
          Al aprobarse el pago se emite la factura electrónica de venta conforme a
          la normativa de la DIAN y se remite al correo registrado. Es tu
          responsabilidad suministrar datos correctos para la facturación.
        </p>
      </Section>

      <Section title="4. Envíos y entregas">
        <p>
          Realizamos envíos por transportadora a nivel nacional y domicilio local
          en el área definida. Los tiempos y costos dependen del destino y del
          método elegido. Cuando aplique el pago contraentrega del transporte, el
          valor del envío se cancela al recibir el pedido.
        </p>
      </Section>

      <Section title="5. Productos personalizados">
        <p>
          Por tratarse de artículos hechos a la medida, las solicitudes de cambio o
          devolución sobre productos personalizados solo se atienden en caso de
          defecto de fabricación o error atribuible a GRAFIBLESS. Revisa cuidadosamente
          el arte, tallas y especificaciones antes de confirmar tu compra.
        </p>
      </Section>

      <Section title="6. Responsabilidad">
        <p>
          Nos esforzamos por mantener la información del sitio actualizada y exacta.
          No garantizamos disponibilidad ininterrumpida del servicio y no seremos
          responsables por fallas ajenas a nuestro control razonable.
        </p>
      </Section>

      <Section title="7. Propiedad intelectual y contenido del cliente">
        <p>
          El contenido del sitio pertenece a GRAFIBLESS. Al enviarnos artes o
          diseños para personalización, declaras contar con los derechos necesarios
          sobre ese material y autorizas su uso para elaborar tu pedido.
        </p>
      </Section>

      <Section title="8. Cambios y ley aplicable">
        <p>
          Podemos actualizar estos términos; la versión vigente se publicará en esta
          página. Estas condiciones se rigen por las leyes de la República de
          Colombia.
        </p>
      </Section>
    </LegalLayout>
  );
}
