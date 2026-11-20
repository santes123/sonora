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
sudo bash -c 'umask 077; read -rs TOKEN; printf "%s" "$TOKEN" > /root/.sonora-token; echo'

# 2. Clonar el repositorio
sudo bash -c 'T=$(cat /root/.sonora-token); git clone "https://x-access-token:${T}@github.com/santes123/sonora.git" /srv/sonora/app'

# 3. Desplegar (el token no queda en .git/config)
sudo bash -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git'
```

> El certificado TLS ya existe en el servidor y se renueva solo: el script
> **no** lanza certbot, solo comprueba que el certificado siga ahí.
>
> Si el script da `Permission denied`, ejecútalo con `bash` delante
> (`sudo bash /srv/sonora/app/deploy/deploy.sh ...`) o dale permiso con
> `sudo chmod +x /srv/sonora/app/deploy/*.sh`.

**El script no pisa tu configuración manual**: el vhost de nginx y las tareas
programadas se instalan **solo la primera vez**; si ya existen, se conservan.
Para reinstalarlos: `--install-nginx` y `--install-cron`. Y si prefieres
publicar la SPA a mano: `--skip-spa`.

**La SPA se publica en `htdocs/web/`** (subdirectorio propio), así el
despliegue borra solo esa carpeta y no toca el `index.php` del panel ni el
`.well-known` del certificado. Configurable con `--spa-dir`.

**Puertos y contenedores**: el stack publica PHP-FPM en `127.0.0.1:9001`
(opción `--fpm-port` para cambiarlo), MariaDB en `3307` y Redis en `6380`.
`deploy.sh` comprueba que estén libres **antes** de construir las imágenes y
avisa de qué contenedor los ocupa si no lo están. Se crean **5 contenedores**:
`app`, `queue`, `scheduler`, `mariadb` y `redis` (el sexto, `web`, solo con el
perfil `nginx-docker`, que no se usa en producción).

Todos los comandos, las rutas reales del servidor y los cuatro métodos de
autenticación están en
[docs/04-guia-acceso-repositorio.md](docs/04-guia-acceso-repositorio.md).

**Primer arranque** (crear la cuenta de administrador):

```bash
sudo /srv/sonora/deploy/sonora.sh artisan sonora:create-admin \
  --email=tu@correo.com --name="Administrador"
```

Después, entra en `/admin` para registrar usuarios y revisar los ajustes.

---

## Administración del servidor

El helper `sonora.sh` resuelve **todas** las rutas de forma absoluta, así que
funciona desde cualquier directorio (si ejecutas `docker compose` a mano desde
`~`, compose busca `/backend/.env.production` y falla):

```bash
# Comandos de artisan dentro del contenedor de producción
sudo /srv/sonora/deploy/sonora.sh artisan sonora:update-user \
  --email=viejo@correo.com --new-email=nuevo@correo.com
sudo /srv/sonora/deploy/sonora.sh artisan sonora:create-admin \
  --email=admin@ejemplo.com

# Cliente de MariaDB (con las credenciales del .env.production)
sudo /srv/sonora/deploy/sonora.sh db -e "SELECT email, role FROM users;"
sudo /srv/sonora/deploy/sonora.sh db -e "DELETE FROM users WHERE email='prueba@correo.com';"

# Compose y logs
sudo /srv/sonora/deploy/sonora.sh compose ps
sudo /srv/sonora/deploy/sonora.sh logs app
```

| Comando | Qué hace |
|---|---|
| `sonora:create-admin` | Crea la primera cuenta de administrador |
| `sonora:update-user` | Cambia el correo, nombre, contraseña o rol de una cuenta |

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
