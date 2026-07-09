# Desplegar GRAFIBLESS en Railway

Guía paso a paso para poner la tienda en producción con **Railway** (frontend +
backend) y **MongoDB Atlas** (base de datos gratis). Tiempo estimado: ~20 min.

En Railway crearás **2 servicios** desde este mismo repo:

| Servicio | Carpeta raíz | Dockerfile | Qué es |
|---|---|---|---|
| `backend`  | `/backend`  | `Dockerfile` (por defecto) | API FastAPI |
| `frontend` | `/frontend` | `Dockerfile.railway` | Tienda React (estática) |

> Nota: el `docker-compose.yml` del repo sigue sirviendo para VPS/local. Railway
> usa el modelo de "cada servicio con su dominio", por eso el frontend usa un
> Dockerfile distinto (`Dockerfile.railway`).

---

## 1. Base de datos — MongoDB Atlas (gratis)

1. Crea una cuenta en <https://www.mongodb.com/cloud/atlas/register>.
2. Crea un clúster **M0 (Free)**.
3. En **Database Access** → crea un usuario y contraseña (guárdalos).
4. En **Network Access** → **Add IP Address** → `0.0.0.0/0` (permite conexión
   desde Railway).
5. En **Connect → Drivers**, copia la cadena de conexión. Se ve así:
   ```
   mongodb+srv://USUARIO:CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Esta es tu `MONGO_URL`.

---

## 2. Crear el proyecto en Railway

1. Entra a <https://railway.app> e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo →** elige `habid8374/ecommerce`.
3. Railway creará un primer servicio. Lo configuramos como **backend**.

---

## 3. Servicio `backend`

En el servicio, ve a **Settings**:

- **Root Directory:** `backend`
- **Build:** Dockerfile (se detecta solo).

En **Variables**, agrega:

| Variable | Valor |
|---|---|
| `MONGO_URL` | la cadena de Atlas del paso 1 |
| `DB_NAME` | `ecommerce` |
| `JWT_SECRET` | un secreto largo aleatorio (ver abajo) |
| `ADMIN_EMAIL` | tu correo de admin |
| `ADMIN_PASSWORD` | una contraseña fuerte |
| `CORS_ORIGINS` | `*` (lo ajustamos en el paso 5) |
| `WOMPI_PUBLIC_KEY` | (opcional por ahora) |
| `WOMPI_PRIVATE_KEY` | (opcional) |
| `WOMPI_INTEGRITY_SECRET` | (opcional) |
| `WOMPI_EVENTS_SECRET` | (opcional) |
| `WOMPI_BASE_URL` | `https://production.wompi.co/v1` |

Genera el `JWT_SECRET` con:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Luego, en **Settings → Networking → Generate Domain**. Copia la URL, por ej.:
`https://grafibless-backend-production.up.railway.app`

Verifica que responde en `…/api/health` → debe decir `"database": "connected"`.

---

## 4. Servicio `frontend`

En el proyecto: **New → GitHub Repo → el mismo repo** (crea un segundo servicio).
En **Settings**:

- **Root Directory:** `frontend`
- **Dockerfile Path:** `Dockerfile.railway`  ← importante

En **Variables**:

| Variable | Valor |
|---|---|
| `REACT_APP_BACKEND_URL` | la URL pública del backend (paso 3), **sin** `/api` al final |

> Railway pasa esta variable como *build arg*, así que el frontend se compila
> apuntando al backend correcto. Si cambias la URL del backend, haz **Redeploy**
> del frontend.

Luego **Settings → Networking → Generate Domain**. Copia la URL del frontend,
por ej.: `https://grafibless.up.railway.app`

---

## 5. Cerrar el círculo (CORS + redirect)

Vuelve al servicio **backend → Variables** y ajusta:

| Variable | Valor |
|---|---|
| `CORS_ORIGINS` | la URL del frontend (paso 4), ej. `https://grafibless.up.railway.app` |
| `FRONTEND_URL` | la misma URL del frontend |

Railway hará **redeploy** del backend automáticamente. Listo: abre la URL del
frontend y entra a `/admin` con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 6. Activar pagos reales con Wompi

1. En <https://comercios.wompi.co> obtén tus llaves de **producción**.
2. En el backend, completa `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`,
   `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` y deja
   `WOMPI_BASE_URL=https://production.wompi.co/v1`.
3. En el panel de Wompi, configura el **webhook / URL de eventos** apuntando a:
   ```
   https://TU_BACKEND.up.railway.app/api/payments/wompi/webhook
   ```
4. Redeploy del backend. Cuando las llaves están presentes, el modo simulado se
   desactiva solo y el checkout usa el Web Checkout real de Wompi.

Mientras no pongas llaves, la tienda funciona en **modo simulado** (sin cobros),
ideal para probar el flujo completo.

---

## Resumen de dominios

- Tienda: `https://TU_FRONTEND.up.railway.app`
- Admin: `https://TU_FRONTEND.up.railway.app/admin`
- API: `https://TU_BACKEND.up.railway.app/api`
- Webhook Wompi: `https://TU_BACKEND.up.railway.app/api/payments/wompi/webhook`

## Costos

- MongoDB Atlas M0: **gratis**.
- Railway: plan de uso; el backend suele rondar ~USD 5/mes. El frontend estático
  consume muy poco.
