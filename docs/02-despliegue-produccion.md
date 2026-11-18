# 2. Despliegue en producción — Sonora

Guía completa para publicar Sonora en `music.antoniogmportfolio.online` sobre un
Ubuntu Server con Docker. Todo lo que hay aquí está **verificado ejecutándose**
en el stack de producción local (imagen multi-stage + `docker-compose.prod.yml`).

---

## 0. Despliegue en un solo comando

Hay un script que hace todo lo de este documento: comprueba el sistema,
prepara las carpetas, despliega el código, construye las imágenes, levanta el
stack, instala nginx, publica la SPA, programa las tareas y verifica que todo
responde.

```bash
# En el servidor (el script clona o actualiza el repositorio):
sudo ./deploy/deploy.sh \
    --repo https://github.com/TU_USUARIO/sonora.git
```

Opciones útiles:

| Opción | Para qué |
|---|---|
| `--repo URL` | Repositorio git a desplegar (clona si no existe, actualiza si ya está) |
| `--repo-token TOKEN` | Acceso a un repositorio privado (el token no se queda en `.git/config`) |
| `--branch RAMA` | Rama a desplegar (por defecto `main`) |
| `--domain DOMINIO` | Dominio público (por defecto `music.antoniogmportfolio.online`) |
| `--web-root RUTA` | Raíz web de nginx (por defecto la del panel) |
| `--log-dir RUTA` | Directorio de logs de nginx (por defecto el del panel) |
| `--media-dir RUTA` | Medios privados (por defecto `/srv/sonora/media`) |
| `--app-key CLAVE` | Fijar el `APP_KEY` (si no, se genera y se guarda) |
| `--db-password CLAVE` | Fijar la contraseña de MariaDB (si no, se genera) |
| `--no-adminer` | No instalar el bloque de Adminer en nginx |
| `--skip-build` | No reconstruir imágenes (despliegue rápido) |
| `--skip-cron` | No instalar las tareas programadas |

> **El TLS no lo toca el script.** El servidor ya tiene el certificado en
> `/etc/letsencrypt/live/music.antoniogmportfolio.online/` y se renueva solo:
> el script solo comprueba que siga ahí y lo usa. No lanza `certbot`.

Al terminar imprime el estado de los servicios, la contraseña de la base de
datos y los comandos para actualizar, hacer backup y revisar el estado.

> El script es **idempotente**: se puede volver a ejecutar para actualizar.
> No toca `backend/.env.production` si ya existe (solo rellena lo que falta).

---

## 1. Arquitectura de producción

```
Internet
   │  HTTPS (443) · Let's Encrypt (ya emitido, se renueva solo)
   ▼
nginx del host (Ubuntu)          ← TLS, SPA estática, cabeceras de seguridad
   │ ├── /            → /var/www/site-music-antoniogmport-5de994/htdocs
   │ ├── /api/        → fastcgi_pass 127.0.0.1:9000  (PHP-FPM del contenedor)
   │ ├── /sanctum/    → fastcgi_pass 127.0.0.1:9000
   │ ├── /robots.txt  → fastcgi_pass 127.0.0.1:9000  (lo genera la app)
   │ └── /_media/     → /srv/sonora/media  (X-Accel-Redirect, `internal`)
   │
Docker (red interna `sonora`)
   ├── app        PHP-FPM 8.3 (imagen multi-stage, código dentro de la imagen)
   ├── queue      php artisan queue:work (portadas WebP, metadatos)
   ├── scheduler  php artisan schedule:work (media:gc diario 03:15)
   ├── mariadb    11.4 (datos + slow query log)
   └── redis      7 (sesiones, caché y colas; política noeviction)
```

**Por qué así:**

| Decisión | Motivo |
|---|---|
| nginx en el host | Un solo punto de entrada: TLS, límites por IP y logs en un sitio. No hace falta PM2: el frontend es una SPA estática de Vite, no hay proceso Node en runtime. |
| PHP-FPM en Docker | El código viaja en la imagen: no hay estado en el host, el rollback es cambiar de etiqueta. |
| Medios en `/srv/sonora/media` | El nginx del host los sirve con `X-Accel-Redirect`: streaming con Range sin consumir workers de PHP. Por eso el directorio se monta también en el contenedor `app`. |
| MariaDB y Redis sin puertos públicos | Solo `127.0.0.1` y red interna de Docker. |
| `trustProxies` en Laravel | Necesario para que la app vea `https` y la IP real del cliente (cookies seguras y rate limit por IP). |

Topología alternativa incluida: con el perfil `nginx-docker` el nginx también
corre en Docker y el del host solo hace de proxy TLS
(`docker compose --profile nginx-docker up -d`).

---

## 2. Requisitos del servidor

| Recurso | Mínimo | Recomendado (por defecto) |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 20 GB | 40 GB (catálogo + medios + backups) |
| SO | Ubuntu Server 22.04/24.04 LTS | 24.04 LTS |

Software: Docker Engine 24+ con Compose v2, nginx, certbot.

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git curl
sudo usermod -aG docker "$USER"   # cierra la sesión y vuelve a entrar
```

Puertos del firewall: **80 y 443** abiertos. Nada más debe estarlo.

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

### DNS

Antes de nada, un registro A (o AAAA) debe apuntar al servidor:

```
music.antoniogmportfolio.online.  3600  IN  A  <IP_DEL_SERVIDOR>
```

Certbot valida por HTTP: si el DNS no apunta al servidor, el certificado falla.

---

## 3. Preparación del host

```bash
sudo mkdir -p /srv/sonora/{media,web,backups,deploy}
sudo chown -R "$USER":"$USER" /srv/sonora

# Repositorio
cd /srv/sonora
git clone <URL_DEL_REPOSITORIO> app
cd app
```

Copia de la configuración de nginx y de los scripts:

```bash
sudo cp -r deploy/nginx/. /etc/nginx/  # snippets y sites-available
sudo cp deploy/backup.sh deploy/restore.sh deploy/monitor.sh /srv/sonora/deploy/
sudo chmod +x /srv/sonora/deploy/*.sh
```

---

## 4. Variables de entorno

```bash
cp backend/.env.production.example backend/.env.production
chmod 600 backend/.env.production
```

Valores **obligatorios** a cambiar:

| Variable | Valor | Por qué |
|---|---|---|
| `APP_KEY` | `base64:...` | Cifra cookies y sesión. **Sin ella la app responde 500.** Generar con `php artisan key:generate --show`. |
| `APP_URL` | `https://music.antoniogmportfolio.online` | URLs absolutas y redirecciones. |
| `FRONTEND_URL` | `https://music.antoniogmportfolio.online` | Origen permitido por CORS. |
| `SESSION_DOMAIN` | `music.antoniogmportfolio.online` | Ámbito de la cookie de sesión. |
| `SESSION_SECURE_COOKIE` | `true` | Cookie solo por HTTPS. |
| `SANCTUM_STATEFUL_DOMAINS` | `music.antoniogmportfolio.online` | Sanctum solo acepta el flujo por cookie desde este dominio. |
| `DB_PASSWORD` / `DB_USERNAME` | credenciales propias | **Nunca** las de desarrollo. |
| `MAIL_*` | SMTP real | En producción no hay Mailpit: sin esto, los correos de verificación se pierden. |

Si `APP_KEY` se deja vacía, el contenedor genera una y la guarda en
`storage/app/app.key`, avisando por log: **las sesiones se invalidan** si ese
fichero se pierde (por ejemplo, al reconstruir la imagen).

---

## 5. Despliegue

```bash
cd /srv/sonora/app

# Construir las imágenes (frontend + backend en una sola multi-stage)
docker compose --env-file backend/.env.production -f docker-compose.prod.yml build

# Levantar (la primera vez, con migraciones)
RUN_MIGRATIONS=true docker compose --env-file backend/.env.production \
    -f docker-compose.prod.yml up -d

# A partir de ahora, para reiniciar
docker compose --env-file backend/.env.production -f docker-compose.prod.yml up -d
```

Comprobar:

```bash
docker compose --env-file backend/.env.production -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:9000/up          # a través de PHP-FPM
curl -s http://127.0.0.1:8080/api/v1/health
```

### Publicar la SPA

El nginx del host sirve la SPA desde la raíz web del panel
(`/var/www/site-music-antoniogmport-5de994/htdocs`). Se extrae de la imagen
`sonora-web`:

```bash
docker create --name sonora-web-extract sonora-web:prod
docker cp sonora-web-extract:/usr/share/nginx/html/. \
        /var/www/site-music-antoniogmport-5de994/htdocs/
docker rm sonora-web-extract
```

En cada despliegue hay que repetirlo (los assets llevan hash: si no se copian,
la SPA seguirá pidiendo los ficheros antiguos). `deploy.sh` lo hace y conserva
`.well-known/`, donde el panel y la renovación del certificado dejan el reto
de ACME.

---

## 6. nginx del host y TLS

```bash
sudo cp deploy/nginx/music.antoniogmportfolio.online.conf \
        /etc/nginx/sites-available/music.antoniogmportfolio.online.conf
sudo cp deploy/nginx/snippets/sonora-fastcgi.conf \
        deploy/nginx/snippets/security-headers.conf /etc/nginx/snippets/
sudo ln -sf /etc/nginx/sites-available/music.antoniogmportfolio.online.conf \
           /etc/nginx/sites-enabled/music.antoniogmportfolio.online
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### El certificado

**El servidor ya tiene el certificado y se renueva solo.** No hay que ejecutar
`certbot` ni tocar nada:

| Ruta | Contenido |
|---|---|
| `/etc/letsencrypt/live/music.antoniogmportfolio.online/fullchain.pem` | Certificado |
| `/etc/letsencrypt/live/music.antoniogmportfolio.online/privkey.pem` | Clave privada |
| `/etc/letsencrypt/options-ssl-nginx.conf` | Ajustes de TLS que ya se incluyen |

La configuración incluye ese último fichero y **no** redefine `ssl_protocols`
ni `ssl_session_cache` (duplicarlos hace que nginx no arranque). El reto de
ACME se sirve desde la raíz web, sin redirección a HTTPS, para que la
renovación automática siga funcionando.

`deploy.sh` comprueba que el certificado siga en su sitio y avisa si falta,
pero nunca emite ni renueva nada.

### Adminer

El bloque de Adminer viene aplanado (nginx no admite `location` anidados) y
apunta al PHP-FPM del host. Es una puerta abierta a la base de datos: si no lo
necesitas, despliega con `--no-adminer`.

---

## 7. Tareas programadas

| Tarea | Fichero | Cuándo |
|---|---|---|
| Copia de seguridad (BD + medios) | `/etc/cron.d/sonora-backup` | Diario a las 02:30 |
| Verificación de la copia (restaura en base scratch) | el mismo fichero | Domingos a las 04:00 |
| Monitor de salud | `/etc/cron.d/sonora-monitor` | Cada 5 minutos |
| Mantenimiento (prune de Docker, disco, memoria) | `/etc/cron.d/sonora-maintenance` | Domingo 05:30 |
| Rotación de logs | `/etc/logrotate.d/sonora` | Diario |
| `media:gc` (limpia huérfanos) | contenedor `scheduler` | Diario 03:15 (dentro de la app) |

```bash
sudo cp deploy/cron/sonora-backup deploy/cron/sonora-maintenance deploy/cron/sonora-monitor /etc/cron.d/
sudo chmod 644 /etc/cron.d/sonora-*
sudo cp deploy/logrotate/sonora /etc/logrotate.d/sonora
```

Variables que necesitan los scripts (crear `/etc/default/sonora`):

```bash
MEDIA_DIR=/srv/sonora/media
COMPOSE_FILE=/srv/sonora/app/docker-compose.prod.yml
BACKUP_ROOT=/srv/sonora/backups
DB_USER=music
DB_PASSWORD=...
DB_ROOT_PASSWORD=...
KEEP_DAYS=7
KEEP_WEEKS=4
# Copia offsite cifrada (opcional):
# RESTIC_REPOSITORY=s3:mi-bucket/sonora
# RESTIC_PASSWORD=...
```

### Backups

```bash
/srv/sonora/deploy/backup.sh            # copia normal
/srv/sonora/deploy/backup.sh --verify   # restaura además en una base scratch
```

La copia se guarda en `/srv/sonora/backups/{daily,weekly}`: dump comprimido de
MariaDB (`--single-transaction`, sin bloquear escritura), paquete de los medios
y `sha256` de cada fichero. La retención por defecto es de 7 diarios y 4
semanales. La copia **offsite** con `restic` solo necesita las dos variables
`RESTIC_*`: si no están definidas, el backup es local.

### Restauración

```bash
/srv/sonora/deploy/restore.sh /srv/sonora/backups/daily/db-2026-11-13T02-30-00.sql.gz \
                             /srv/sonora/backups/daily/media-2026-11-13T02-30-00.tar.gz
```

Detiene la aplicación, restaura la base de datos y los medios, aplica los
permisos de lectura para nginx y comprueba que la app vuelve a responder.

---

## 8. Observabilidad

| Señal | Dónde |
|---|---|
| Salud de la app | `GET /api/v1/health` → estado de MariaDB y Redis |
| Traza por petición | Cabecera `X-Request-Id` en todas las respuestas |
| Logs de la app | `storage/logs/laravel-YYYY-MM-DD.log` (rotación por `logrotate`) |
| Logs de nginx | `/var/log/nginx/music.antoniogmportfolio.online.access.log` con `rt` y `urt` (tiempo de respuesta y del upstream) |
| Consultas lentas | MariaDB `slow.log` (`long_query_time=0.5`) |
| Uso de Redis | `docker compose exec redis redis-cli info memory` |
| Estado general | `/srv/sonora/deploy/monitor.sh` (también en cron cada 5 min) |

---

## 9. Límites y afinado

| Límite | Valor | Dónde |
|---|---|---|
| Peticiones API | 120/min por usuario (o por IP sin sesión) | `RateLimiter::for('api')` |
| Login/registro | 8/min por email+IP | `RateLimiter::for('auth')` |
| Subidas | 120/h por usuario | `RateLimiter::for('uploads')` |
| Tamaño de subida | 256 MB (260 MB en nginx) | `MEDIA_MAX_UPLOAD_MB` |
| Workers PHP | `PHP_FPM_MAX_CHILDREN=10` | `.env` de producción |
| Conexiones MariaDB | 100 | `MARIADB_MAX_CONNECTIONS` |
| Memoria Redis | 256 MB, política `noeviction` | `REDIS_MAXMEMORY` |
| Buffer pool MariaDB | 2G | `INNODB_BUFFER_POOL_SIZE` |

Cálculo de `PHP_FPM_MAX_CHILDREN` para 8 GB de RAM:

```
max_children = (RAM_MB * 0.75) / 128   →  (8192 * 0.75) / 128 = 48
```

El valor por defecto (10) es conservador a propósito: cada worker de PHP-FPM
consume ~128 MB y el límite real lo imponen MariaDB y la memoria disponible.
Subirlo solo con métricas delante (`pm.max_children` saturado + latencia alta).

---

## 10. Pruebas de carga

```bash
# Rápida, sin instalar nada (Node 18+)
node deploy/load/quick.js --url https://music.antoniogmportfolio.online \
     --requests 1000 --concurrency 25 --path /up

# Completa, con usuarios autenticados y umbrales (k6)
sudo apt install -y k6
BASE_URL=https://music.antoniogmportfolio.online VUS=20 DURATION=5m RATE=40 \
  k6 run deploy/load/api.js
```

Medición de referencia (Docker Desktop sobre Windows, 4 vCPU; no es
representativa del Ubuntu Server):

| Escenario | req/s | p50 | p95 | Errores |
|---|---|---|---|---|
| 1000 peticiones a `/up`, concurrencia 25 | 300 | 73 ms | 130 ms | 0 |
| 400 peticiones a `/api/v1/health` | 234 | 61 ms | 125 ms | 280 × **429** |

El 429 no es un fallo: es el rate limit (120/min por IP) haciendo su trabajo.
Con usuarios autenticados el límite es por usuario, así que no se disparan.

Los umbrales y la guía de interpretación están en
[`deploy/load/README.md`](../../deploy/load/README.md).

---

## 11. Actualización y rollback

```bash
cd /srv/sonora/app
git pull
docker compose --env-file backend/.env.production -f docker-compose.prod.yml build
docker compose --env-file backend/.env.production -f docker-compose.prod.yml up -d
docker create --name sonora-web-extract sonora-web:prod
docker cp sonora-web-extract:/usr/share/nginx/html/. /srv/sonora/web/
docker rm sonora-web-extract
```

**Rollback**: las imágenes se etiquetan por versión de git. Si el despliegue
falla, se vuelve a la anterior y se levanta:

```bash
git checkout <commit-anterior>
docker compose --env-file backend/.env.production -f docker-compose.prod.yml build
docker compose --env-file backend/.env.production -f docker-compose.prod.yml up -d
```

Las migraciones son la parte no reversible: antes de un despliegue con
migraciones, la copia de seguridad debe existir y estar verificada
(`backup.sh --verify`).

---

## 12. Prueba de humo tras el despliegue

```powershell
./deploy/e2e/smoke-prod.ps1 -BaseUrl "https://music.antoniogmportfolio.online"
```

Comprueba, en este orden: salud de la API, servido de la SPA, cabeceras de
seguridad, service worker sin caché, cookie CSRF, registro, login, sesión,
catálogo, subida de audio, URL firmada y streaming con Range (206).

---

## 13. Checklist de publicación

- [ ] DNS de `music.antoniogmportfolio.online` apunta al servidor.
- [ ] Puertos 80 y 443 abiertos; 3306, 6379 y 9000 **cerrados** al exterior.
- [ ] `backend/.env.production` con `APP_KEY`, `APP_DEBUG=false` y credenciales propias (`chmod 600`).
- [ ] `SANCTUM_STATEFUL_DOMAINS` y `SESSION_DOMAIN` con el dominio real.
- [ ] `docker compose ps` → todos los servicios arriba y healthy.
- [ ] `curl https://…/api/v1/health` → `{"status":"ok"}`.
- [ ] `curl https://…/robots.txt` → `Disallow: /` (sitio privado).
- [ ] Certificado presente en `/etc/letsencrypt/live/music.antoniogmportfolio.online/`
      (ya se renueva solo: no hay que ejecutar `certbot`).
- [ ] Copia de seguridad ejecutada y **verificada con restauración**.
- [ ] `nginx -t` sin errores y `systemctl reload nginx` aplicado.
- [ ] Prueba de humo (`smoke-prod.ps1`) sin fallos.
- [ ] Checklist de seguridad revisado (`docs/03-checklist-seguridad.md`).

---

## 14. Primer arranque: la cuenta de administrador

El registro público está **cerrado** (es un sitio privado) y la indexación por
motores de búsqueda está **bloqueada**. Los dos se cambian desde el panel de
administración, sin tocar el servidor.

1. Crear la primera cuenta de administrador (una sola vez):

   ```bash
   cd /srv/sonora/app
   docker compose --env-file backend/.env.production -f docker-compose.prod.yml \
       exec app php artisan sonora:create-admin \
       --name=Administrador --email=admin@ejemplo.com --password='una-contrasena-larga'
   ```

   Si se omite `--password`, se genera una y se muestra por pantalla (no se
   guarda en ningún sitio).

2. Entrar en `https://music.antoniogmportfolio.online/login`.

3. Abrir el panel de administración (icono de engranaje en la barra superior):
   - **Ajustes del sitio**: registrar público e indexación.
   - **Registrar un usuario**: dar de alta cuentas.

4. Comprobar el estado del sitio:

   ```bash
   curl -s https://music.antoniogmportfolio.online/api/v1/settings
   # {"registration_enabled":false,"allow_indexing":false}
   ```

> El registro y la indexación están cerrados por defecto **y también si la
> tabla `settings` todavía no existe**: el sitio responde con los valores
> restrictivos en vez de caerse.
