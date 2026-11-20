# Sonora

Web de música tipo streaming (PWA) con catálogo, playlists, historial, reproductor
y descarga offline. Backend **Laravel 12 + PHP 8.3**, frontend **React 19 +
TypeScript + Vite 8 + Tailwind v4**, con **MariaDB 11.4** y **Redis 7** en Docker.

Producción: `https://music.antoniogmportfolio.online`

---

## Documentación

| Documento | Para qué |
|---|---|
| [docs/01-analisis-y-arquitectura.md](docs/01-analisis-y-arquitectura.md) | Arquitectura por fases (1–7), decisiones y cuellos de botella prevenidos |
| [docs/02-despliegue-produccion.md](docs/02-despliegue-produccion.md) | Despliegue completo en el Ubuntu Server, nginx, medios, backups |
| [docs/03-checklist-seguridad.md](docs/03-checklist-seguridad.md) | Checklist de seguridad antes de publicar |
| [docs/04-guia-acceso-repositorio.md](docs/04-guia-acceso-repositorio.md) | **Cómo clonar el repo en el servidor** (HTTPS con token, credenciales, SSH con deploy key) |

---

## Estructura

```
backend/        API Laravel (actions transaccionales, controladores finos, DTOs)
frontend/       SPA React + PWA (TanStack Query, modo offline con Dexie)
deploy/         deploy.sh (script único) + configuración de nginx
docker/         Dockerfile multi-stage de producción
docs/           Documentación técnica
```

---

## Puesta en marcha en local

```bash
# 1. Stack de desarrollo (app, nginx, MariaDB, Redis, cola, scheduler, mailpit, minio)
docker compose up -d
docker compose exec app php artisan migrate --seed

# 2. Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api y /sanctum → :8080)
```

Servicios del stack de desarrollo: app `:8080` · MariaDB `:3307` · Redis `:6380` ·
Mailpit `:8025` · MinIO `:9000`.

## Tests y calidad

```bash
# Backend (Laravel + Pest/PHPUnit)
docker compose exec -T app php artisan test
docker compose exec -T app ./vendor/bin/pint --test

# Frontend (Vitest + Testing Library)
cd frontend
npm test
npx tsc --noEmit && npx tsc -p tsconfig.sw.json
npm run build
```

---

## Despliegue en producción

Un solo comando en el servidor (el script clona o actualiza el código, construye
las imágenes, levanta el stack, instala nginx, publica la SPA y verifica que todo
responde):

```bash
# 1. Guardar el token de GitHub en el servidor (no pasa por el historial)
sudo sh -c 'umask 077; read -rs TOKEN; printf "%s" "$TOKEN" > /root/.sonora-token; echo'

# 2. Clonar el repositorio
sudo sh -c 'T=$(cat /root/.sonora-token); git clone "https://x-access-token:${T}@github.com/santes123/sonora.git" /srv/sonora/app'

# 3. Desplegar (el token no queda en .git/config)
sudo sh -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git'
```

> El certificado TLS ya existe en el servidor y se renueva solo: el script
> **no** lanza certbot, solo comprueba que el certificado siga ahí.

Todos los comandos, las rutas reales del servidor y los cuatro métodos de
autenticación están en
[docs/04-guia-acceso-repositorio.md](docs/04-guia-acceso-repositorio.md).

**Primer arranque** (crear la cuenta de administrador):

```bash
cd /srv/sonora/app && sudo docker compose --env-file backend/.env.production \
  -f docker-compose.prod.yml exec app php artisan sonora:create-admin \
  --email=tu@correo.com
```

Después, entra en `/admin` para registrar usuarios y revisar los ajustes.

---

## Ajustes del sitio (panel `/admin`)

| Ajuste | Por defecto | Efecto |
|---|---|---|
| Registro público | **Desactivado** | `POST /api/v1/auth/register` responde 403; no hay enlace de registro en la UI |
| Indexación por motores | **Desactivado** | `X-Robots-Tag: noindex, nofollow, noarchive` + `robots.txt` con `Disallow: /` |
| Usuarios | — | Alta de cuentas desde el panel (no hay endpoints públicos de gestión) |

Las canciones eliminadas se conservan en las playlists marcadas como **"No
disponible"**, pero el reproductor las salta y su audio ya no se sirve
(`404` en la URL firmada).

---

## Seguridad

- Los medios se guardan en **disco privado** y se sirven con **URLs firmadas**
  (`X-Accel-Redirect`). Nunca en `storage/app/public`.
- La API usa **Sanctum** con cookies *stateful* same-origin (CSRF incluido).
- `.env`, `.env.production`, `login.txt`, los medios y `.deploy/` (claves) están
  en `.gitignore`. Los `.env.example` solo llevan marcadores de posición.
- El usuario de semilla `admin@sonora.local` es **solo para desarrollo**:
  en producción se usa `php artisan sonora:create-admin`.

---

## Estado actual

Rama `main` desplegable, con las fases 1–7 cerradas
(análisis → arquitectura → API → auth → catálogo/reproductor → PWA/offline →
ajustes de sitio y despliegue).
