import LegalLayout, { Section } from "@/components/LegalLayout";

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Política de privacidad" updated="2026">
      <p>
        En GRAFIBLESS valoramos tu privacidad. Esta política explica qué datos
        personales recopilamos, con qué finalidad y cuáles son tus derechos, en
        cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia
        sobre protección de datos personales (Habeas Data).
      </p>

      <Section title="1. Responsable del tratamiento">
        <p>
          El responsable del tratamiento de tus datos es GRAFIBLESS. Puedes
          contactarnos a través de los canales publicados en el sitio para ejercer
          tus derechos o resolver inquietudes sobre tus datos.
        </p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Datos de identificación: nombres, apellidos, tipo y número de documento.</li>
          <li>Datos de contacto: correo electrónico, teléfono y dirección.</li>
          <li>Datos de la compra: productos, valores, historial de pedidos y estados.</li>
          <li>Datos requeridos para la factura electrónica ante la DIAN.</li>
        </ul>
      </Section>

      <Section title="3. Finalidad del tratamiento">
        <ul className="list-disc space-y-1 pl-5">
          <li>Gestionar tu registro, pedidos, pagos y entregas.</li>
          <li>Emitir la factura electrónica y cumplir obligaciones legales y contables.</li>
          <li>Enviarte notificaciones sobre el estado de tu compra.</li>
          <li>Informarte novedades, promociones o campañas, si lo autorizas.</li>
          <li>Atender solicitudes de soporte y mejorar nuestros servicios.</li>
        </ul>
      </Section>

      <Section title="4. Pagos y proveedores">
        <p>
          Los pagos se procesan a través de la pasarela Wompi; GRAFIBLESS no
          almacena los datos completos de tu tarjeta. La factura electrónica se
          genera con un proveedor tecnológico autorizado por la DIAN (Factus). El
          envío de correos transaccionales puede realizarse mediante un proveedor
          de correo (Brevo). Estos terceros tratan los datos estrictamente para la
          prestación del servicio.
        </p>
      </Section>

      <Section title="5. Tus derechos">
        <p>
          Como titular puedes conocer, actualizar, rectificar y suprimir tus datos,
          así como revocar la autorización otorgada, salvo cuando exista un deber
          legal o contractual de conservarlos. Para ejercerlos, escríbenos por los
          canales de contacto del sitio.
        </p>
      </Section>

      <Section title="6. Conservación y seguridad">
        <p>
          Conservamos tus datos por el tiempo necesario para cumplir las finalidades
          descritas y las obligaciones legales (por ejemplo, las contables y
          tributarias). Aplicamos medidas técnicas y organizativas razonables para
          proteger la información contra acceso o uso no autorizado.
        </p>
      </Section>

      <Section title="7. Cambios">
        <p>
          Podemos actualizar esta política; publicaremos la versión vigente en esta
          misma página con su fecha de actualización.
        </p>
      </Section>
    </LegalLayout>
  );
}
