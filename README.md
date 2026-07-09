# Tienda Ecommerce

Ecommerce full‑stack con panel de administración, estilo marketplace. Catálogo de
productos, carrito, checkout con **Wompi** y un panel admin para gestionar pedidos,
productos, clientes y métricas.

## Stack

- **Backend:** FastAPI + MongoDB (motor), JWT, integración Wompi.
- **Frontend:** React (CRA + CRACO), Tailwind + shadcn/ui, React Router, React Query.
- **Infra:** Docker + docker‑compose (Mongo + API + Nginx).

## Funcionalidades

**Tienda (clientes)**
- Registro / inicio de sesión (JWT).
- Catálogo con búsqueda y filtro por categoría.
- Detalle de producto y carrito persistente (localStorage).
- Checkout con datos de envío y pago vía Wompi.
- Historial de pedidos y seguimiento de estado.

**Panel admin** (`/admin`, requiere rol `admin`)
- Dashboard: ingresos, pedidos, clientes, productos, bajo stock.
- Pedidos: ver detalle y cambiar estado (pendiente → pagado → en preparación → enviado → entregado).
- Productos: CRUD completo (precio, stock, categoría, imágenes, activo/inactivo).
- Clientes: listado con número de pedidos y total gastado.

## Pagos con Wompi

El checkout genera un pedido en el servidor (que revalida precios y stock) y luego un
*intent* de pago:

- **Con llaves configuradas** → redirige al Web Checkout de Wompi con firma de integridad.
  El estado se confirma por **webhook firmado** (`/api/payments/wompi/webhook`) y/o
  consultando la transacción con la llave privada.
- **Sin llaves** → modo **simulado**: el pago se aprueba desde un endpoint de desarrollo,
  para poder probar todo el flujo end‑to‑end sin cobros reales.

Configura el webhook en el panel de Wompi apuntando a:
`https://TU_DOMINIO/api/payments/wompi/webhook`.

## Puesta en marcha con Docker (recomendado)

```bash
cp .env.example .env
# edita .env: define JWT_SECRET (obligatorio) y, si aplica, las llaves de Wompi
docker compose up --build
```

- Tienda: http://localhost:8080
- API: http://localhost:8080/api (proxy de Nginx al backend)
- Admin: http://localhost:8080/admin (usa `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

En el primer arranque se crea el usuario admin y un catálogo de demostración.

## Despliegue en producción

- **Railway + MongoDB Atlas** (recomendado, sin servidor): ver
  [`DEPLOY_RAILWAY.md`](./DEPLOY_RAILWAY.md).
- **VPS / self-hosted**: `docker compose up --build` detrás de un reverse proxy
  con HTTPS (Caddy/Nginx/Traefik).

## Desarrollo local (sin Docker)

**Backend** (requiere un MongoDB accesible):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ajusta MONGO_URL, JWT_SECRET, etc.
uvicorn server:app --reload --port 8001
```

**Frontend:**

```bash
cd frontend
cp .env.example .env    # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start              # http://localhost:3000
```

## Tests (backend)

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

Los tests usan una base Mongo en memoria (`mongomock-motor`), así que no requieren
un MongoDB real.

## Variables de entorno

Ver `.env.example` (raíz), `backend/.env.example` y `frontend/.env.example`.
Claves principales:

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | **Obligatoria.** Secreto para firmar los JWT. |
| `MONGO_URL` / `DB_NAME` | Conexión a MongoDB. |
| `CORS_ORIGINS` | Orígenes permitidos (coma‑separados). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin creado al arrancar. |
| `WOMPI_*` | Credenciales de Wompi (vacías = modo simulado). |
| `FRONTEND_URL` | URL pública del frontend (redirect de Wompi). |
| `SHIPPING_COST` / `FREE_SHIPPING_OVER` | Reglas de envío (COP). |

## Notas de seguridad para producción

- Define un `JWT_SECRET` largo y aleatorio.
- Restringe `CORS_ORIGINS` a tu dominio real (no `*`).
- Cambia `ADMIN_PASSWORD`.
- Usa las llaves de **producción** de Wompi y `WOMPI_BASE_URL=https://production.wompi.co/v1`.
- Sirve todo sobre HTTPS.
