# Respaldo automático de la base de datos (GRAFIBLESS)

La base de datos (MongoDB Atlas) se respalda **automáticamente todas las noches a
las 2:00 a.m. (hora Colombia)** con el flujo de GitHub Actions
`.github/workflows/db-backup.yml`. El respaldo se sube a un bucket de
**Cloudflare R2** y se conservan los últimos **30 días**.

> ¿Por qué esto? El plan gratuito de Atlas (M0) **no** hace respaldos. Sin esto,
> un borrado accidental o una falla no se puede recuperar.

## 1. Configuración por única vez

### a) Crear el bucket y el token en Cloudflare R2
1. En Cloudflare → **R2** → **Create bucket** (ej. nombre `grafibless-backups`).
2. R2 → **Manage R2 API Tokens** → **Create API token**:
   - Permiso: **Object Read & Write** (puede limitarse a ese bucket).
   - Al crearlo te muestra **Access Key ID**, **Secret Access Key** y el
     **endpoint** con forma `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
   - Copia los tres (el Secret solo se muestra una vez).

### b) Agregar los secretos en GitHub
En el repositorio → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**, crea estos cinco (los valores NO van en el código):

| Secreto | Valor |
|---|---|
| `MONGO_URL` | Cadena de conexión de Atlas: `mongodb+srv://usuario:clave@cluster0.xxxx.mongodb.net/...` |
| `R2_BUCKET` | Nombre del bucket, ej. `grafibless-backups` |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Access Key ID del token de R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key del token de R2 |

> En Atlas, revisa que **Network Access** permita GitHub Actions. Como las IP de
> Actions cambian, lo más simple es permitir `0.0.0.0/0` (acceso desde cualquier
> IP) — la conexión sigue protegida por usuario y contraseña. Si prefieres algo
> más estricto, se puede usar un runner con IP fija.

## 2. Probar que funciona (sin esperar a las 2 a.m.)
Repositorio → pestaña **Actions** → flujo **"DB · Respaldo diario a Cloudflare
R2"** → botón **Run workflow**. Debe terminar en verde y aparecer un archivo
`backups/grafibless-AAAAMMDD-HHMMSS.archive.gz` en el bucket de R2.

## 3. Restaurar un respaldo
1. Descarga el archivo `.archive.gz` desde R2 (panel de Cloudflare o `aws s3 cp`).
2. Restaura con MongoDB Database Tools:

```bash
# ⚠️ --drop reemplaza las colecciones actuales por las del respaldo.
mongorestore --uri="mongodb+srv://usuario:clave@cluster0.xxxx.mongodb.net" \
  --archive=grafibless-AAAAMMDD-HHMMSS.archive.gz --gzip --drop
```

Para restaurar en una base de prueba primero, quita `--drop` y agrega
`--nsFrom='ecommerce.*' --nsTo='ecommerce_restore.*'`.

## Notas
- La hora está fijada en `cron: "0 7 * * *"` (07:00 UTC = 02:00 Colombia, UTC-5).
- La retención de 30 días se aplica borrando en R2 los respaldos más antiguos en
  cada ejecución. Si prefieres, puedes además crear una *lifecycle rule* en el
  bucket de R2 para borrar objetos con más de 30 días.
- Los programados de GitHub Actions solo corren en la rama por defecto (`main`).
