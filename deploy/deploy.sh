#!/usr/bin/env bash
#
# Despliegue de Sonora en un Ubuntu Server con Docker.
#
# Script único: comprueba el sistema, prepara las carpetas, despliega el
# código, construye las imágenes, levanta el stack, instala nginx, publica la
# SPA, programa las tareas y verifica que todo responde.
#
# TLS: el certificado ya existe en el servidor y se renueva solo. Este script
# NO lanza certbot: comprueba que el certificado esté en su sitio y lo usa.
#
# Uso:
#   sudo ./deploy/deploy.sh --repo https://github.com/TU_USUARIO/sonora.git
#
# Opciones:
#   --repo URL           repositorio git a desplegar (usa el actual si se omite)
#   --repo-token TOKEN   token de acceso para repositorios privados
#   --branch RAMA        rama a desplegar (por defecto main)
#   --domain DOMINIO     dominio público (por defecto music.antoniogmportfolio.online)
#   --web-root RUTA      raíz web de nginx (por defecto la del panel)
#   --log-dir RUTA       directorio de logs de nginx (por defecto el del panel)
#   --media-dir RUTA     directorio de medios privados (por defecto /srv/sonora/media)
#   --deploy-dir RUTA    directorio de trabajo (por defecto /srv/sonora)
#   --app-key CLAVE      APP_KEY de Laravel (si no se indica, se genera)
#   --db-password CLAVE  contraseña de MariaDB (si no se indica, se genera)
#   --no-adminer         no instalar el bloque de Adminer en nginx
#   --skip-build         no reconstruir las imágenes
#   --skip-cron          no instalar las tareas programadas
#
# Variables de entorno alternativas: DOMINIO, REPO, REPO_TOKEN, RAMA, APP_KEY,
# DB_PASSWORD, DEPLOY_DIR, WEB_ROOT, LOG_DIR, MEDIA_DIR.
#
set -euo pipefail

# --- Valores por defecto ----------------------------------------------------
DOMINIO="${DOMINIO:-music.antoniogmportfolio.online}"
REPO="${REPO:-}"
REPO_TOKEN="${REPO_TOKEN:-}"
RAMA="${RAMA:-main}"
DEPLOY_DIR="${DEPLOY_DIR:-/srv/sonora}"
WEB_ROOT="${WEB_ROOT:-/var/www/site-music-antoniogmport-5de994/htdocs}"
LOG_DIR="${LOG_DIR:-/var/www/site-music-antoniogmport-5de994/logs}"
MEDIA_DIR="${MEDIA_DIR:-$DEPLOY_DIR/media}"
APP_KEY="${APP_KEY:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
SKIP_BUILD=0
SKIP_CRON=0
WITH_ADMINER=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

while [ $# -gt 0 ]; do
    case "$1" in
        --domain) DOMINIO="$2"; shift 2 ;;
        --repo) REPO="$2"; shift 2 ;;
        --repo-token) REPO_TOKEN="$2"; shift 2 ;;
        --branch) RAMA="$2"; shift 2 ;;
        --web-root) WEB_ROOT="$2"; shift 2 ;;
        --log-dir) LOG_DIR="$2"; shift 2 ;;
        --media-dir) MEDIA_DIR="$2"; shift 2 ;;
        --deploy-dir) DEPLOY_DIR="$2"; shift 2 ;;
        --app-key) APP_KEY="$2"; shift 2 ;;
        --db-password) DB_PASSWORD="$2"; shift 2 ;;
        --no-adminer) WITH_ADMINER=0; shift ;;
        --skip-build) SKIP_BUILD=1; shift ;;
        --skip-cron) SKIP_CRON=1; shift ;;
        -h|--help) sed -n '2,35p' "$0"; exit 0 ;;
        *) echo "Opción desconocida: $1" >&2; exit 1 ;;
    esac
done

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '  \033[0;32mOK\033[0m %s\n' "$*"; }
warn() { printf '  \033[0;33mAVISO\033[0m %s\n' "$*"; }
die()  { printf '  \033[0;31mFALLO\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Ejecuta el script como root (sudo)."

# --- 1. Comprobaciones previas ----------------------------------------------
log "Comprobando el sistema"

command -v docker >/dev/null 2>&1 || die "Falta Docker. Instálalo con: apt install -y docker.io docker-compose-v2"
docker compose version >/dev/null 2>&1 || die "Falta Docker Compose v2."
command -v nginx >/dev/null 2>&1 || die "Falta nginx. Instálalo con: apt install -y nginx"
command -v git >/dev/null 2>&1 || die "Falta git."

if ! docker info >/dev/null 2>&1; then
    warn "El usuario actual no está en el grupo docker; se usará sudo."
    DOCKER="sudo docker"
else
    DOCKER="docker"
fi

ok "Docker $(docker version --format '{{.Server.Version}}'), nginx $(nginx -v 2>&1 | sed 's|.*nginx/||') y git disponibles."

# --- 2. Estructura de carpetas ----------------------------------------------
log "Preparando $DEPLOY_DIR, $WEB_ROOT y $LOG_DIR"

mkdir -p "$DEPLOY_DIR"/{media,backups,deploy}
mkdir -p "$WEB_ROOT" "$LOG_DIR"
mkdir -p "$WEB_ROOT/.well-known/acme-challenge"

# nginx corre como www-data: tiene que poder leer la SPA y los medios.
if id -u www-data >/dev/null 2>&1; then
    chown -R www-data:www-data "$WEB_ROOT" "$LOG_DIR" 2>/dev/null || true
fi
chmod 755 "$DEPLOY_DIR" "$MEDIA_DIR" "$WEB_ROOT" "$LOG_DIR" 2>/dev/null || true
chmod -R a+rX "$MEDIA_DIR" 2>/dev/null || true

ok "Carpetas listas."

APP_DIR="$DEPLOY_DIR/app"

# --- 3. Código ---------------------------------------------------------------
log "Preparando el código"

# Si el repositorio es privado, el token viaja solo en la URL del clonado:
# después se deja el remoto limpio, sin token, en .git/config.
clone_url="$REPO"
if [ -n "$REPO_TOKEN" ] && [ -n "$REPO" ]; then
    clone_url="$(printf '%s' "$REPO" | sed -e "s|^https://|https://x-access-token:${REPO_TOKEN}@|")"
fi

if [ -n "$REPO" ]; then
    if [ -d "$APP_DIR/.git" ]; then
        fetch_url="$clone_url"
        git -C "$APP_DIR" fetch --all --tags "$fetch_url" \
            || die "No se pudo descargar el repositorio. Revisa --repo y --repo-token."
        git -C "$APP_DIR" checkout "$RAMA"
        git -C "$APP_DIR" reset --hard "origin/$RAMA" 2>/dev/null || git -C "$APP_DIR" pull --ff-only origin "$RAMA"
        # El remoto se deja sin token.
        git -C "$APP_DIR" remote set-url origin "$REPO" 2>/dev/null || true
    else
        git clone --branch "$RAMA" "$clone_url" "$APP_DIR" \
            || die "No se pudo clonar $REPO. Revisa --repo y --repo-token."
        git -C "$APP_DIR" remote set-url origin "$REPO" 2>/dev/null || true
    fi
    ok "Código actualizado desde $REPO ($RAMA)."
elif [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch --all --tags
    git -C "$APP_DIR" checkout "$RAMA"
    git -C "$APP_DIR" pull --ff-only origin "$RAMA" || warn "No se pudo actualizar (sin remoto o sin cambios)."
    ok "Código actualizado en $APP_DIR."
else
    mkdir -p "$APP_DIR"
    cp -a "$SOURCE_DIR"/. "$APP_DIR"/
    ok "Código copiado desde $SOURCE_DIR."
fi

cd "$APP_DIR"

# --- 4. Variables de entorno -------------------------------------------------
log "Configurando el entorno"

ENV_FILE="$APP_DIR/backend/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    cp "$APP_DIR/backend/.env.production.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    ok "Creado backend/.env.production a partir de la plantilla."
else
    ok "backend/.env.production ya existe (no se toca)."
fi

set_env() {
    local key="$1" value="$2"
    if grep -qE "^${key}=" "$ENV_FILE"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    fi
}

set_env APP_ENV production
set_env APP_DEBUG false
set_env APP_URL "https://$DOMINIO"
set_env FRONTEND_URL "https://$DOMINIO"
set_env SESSION_DOMAIN "$DOMINIO"
set_env SESSION_SECURE_COOKIE true
set_env SANCTUM_STATEFUL_DOMAINS "$DOMINIO"
set_env MAIL_FROM_ADDRESS "hola@$DOMINIO"

if [ -z "$APP_KEY" ]; then
    # Se genera con la imagen ya construida; si aún no existe, se deja
    # pendiente y se regenera tras la construcción.
    APP_KEY="$($DOCKER run --rm --entrypoint php sonora-app:prod artisan key:generate --show 2>/dev/null \
        | sed -e 's/<[^>]*>//g' | tr -d '\r' || true)"
    if [ -z "$APP_KEY" ]; then
        APP_KEY="PENDIENTE"
    fi
fi

if [ "$APP_KEY" = "PENDIENTE" ]; then
    warn "APP_KEY vacía: se generará al construir la imagen."
else
    set_env APP_KEY "$APP_KEY"
    ok "APP_KEY fijada."
fi

if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "CAMBIAR_ESTA_CLAVE" ]; then
    DB_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 24)"
    set_env DB_PASSWORD "$DB_PASSWORD"
    ok "Contraseña de MariaDB generada: $DB_PASSWORD"
else
    set_env DB_PASSWORD "$DB_PASSWORD"
    ok "Contraseña de MariaDB fijada."
fi

# --- 5. Construcción de imágenes ---------------------------------------------
if [ "$SKIP_BUILD" -eq 1 ]; then
    log "Omitiendo la construcción de imágenes"
else
    log "Construyendo las imágenes (tarda varios minutos la primera vez)"
    $DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml build
    ok "Imágenes construidas."

    if [ "$APP_KEY" = "PENDIENTE" ]; then
        APP_KEY="$($DOCKER run --rm --entrypoint php sonora-app:prod artisan key:generate --show 2>/dev/null \
            | sed -e 's/<[^>]*>//g' | tr -d '\r')"
        if [ -n "$APP_KEY" ]; then
            set_env APP_KEY "$APP_KEY"
            ok "APP_KEY generada y guardada."
        else
            die "No se pudo generar el APP_KEY. Pásalo con --app-key."
        fi
    fi
fi

# --- 6. Levantar el stack ---------------------------------------------------
log "Levantando el stack"

export MEDIA_DIR="$MEDIA_DIR"

# `sudo` no hereda el entorno: se exporta en vez de prefijar el comando.
export RUN_MIGRATIONS=true
$DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml up -d
ok "Servicios levantados."

# Espera a que la base de datos esté lista antes de migrar.
for i in $(seq 1 30); do
    if $DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml ps mariadb \
        | grep -q healthy; then
        break
    fi
    sleep 2
done

# --- 7. Publicar la SPA -----------------------------------------------------
log "Publicando la SPA en $WEB_ROOT"

# Se conserva .well-known: es donde el panel y la renovación del certificado
# dejan el reto de ACME.
find "$WEB_ROOT" -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} + 2>/dev/null || true

container_id="$($DOCKER create sonora-web:prod)"
$DOCKER cp "$container_id:/usr/share/nginx/html/." "$WEB_ROOT/"
$DOCKER rm "$container_id" >/dev/null

if id -u www-data >/dev/null 2>&1; then
    chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
fi
chmod -R a+rX "$WEB_ROOT" 2>/dev/null || true
ok "SPA publicada."

# --- 8. nginx del host -------------------------------------------------------
log "Configurando nginx"

install -d -m 755 /etc/nginx/snippets
install -m 644 "$APP_DIR/deploy/nginx/snippets/sonora-fastcgi.conf" \
    /etc/nginx/snippets/sonora-fastcgi.conf
install -m 644 "$APP_DIR/deploy/nginx/snippets/security-headers.conf" \
    /etc/nginx/snippets/security-headers.conf

install -m 644 "$APP_DIR/deploy/nginx/music.antoniogmportfolio.online.conf" \
    "/etc/nginx/sites-available/$DOMINIO.conf"

NGINX_CONF="/etc/nginx/sites-available/$DOMINIO.conf"

# La configuración generada trae los valores por defecto del servidor: se
# adaptan a los reales (dominio, raíz web, logs y medios).
sed -i \
    -e "s|music\.antoniogmportfolio\.online|$DOMINIO|g" \
    -e "s|/var/www/site-music-antoniogmport-5de994/htdocs|$WEB_ROOT|g" \
    -e "s|/var/www/site-music-antoniogmport-5de994/logs|$LOG_DIR|g" \
    -e "s|/srv/sonora/media|$MEDIA_DIR|g" \
    "$NGINX_CONF"

# HTTP/2: `http2 on;` existe desde nginx 1.25.1. En versiones anteriores la
# opción va en la propia directiva `listen`.
nginx_version="$(nginx -v 2>&1 | sed -e 's|.*nginx/||')"
nginx_major="$(printf '%s' "$nginx_version" | cut -d. -f1)"
nginx_minor="$(printf '%s' "$nginx_version" | cut -d. -f2)"

if [ "$nginx_major" -gt 1 ] || { [ "$nginx_major" -eq 1 ] && [ "$nginx_minor" -ge 25 ]; }; then
    sed -i "s|^    #__HTTP2__|    http2 on;|" "$NGINX_CONF"
else
    sed -i "s|^    #__HTTP2__||" "$NGINX_CONF"
    sed -i "s|listen 443 ssl;|listen 443 ssl http2;|" "$NGINX_CONF"
fi

# Adminer: es una puerta abierta a la base de datos. Se puede quitar.
if [ "$WITH_ADMINER" -eq 0 ]; then
    sed -i '/#---BEGIN-ADMINER---/,/#---END-ADMINER---/d' "$NGINX_CONF"
    ok "Bloque de Adminer omitido."
fi

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMINIO.conf"
rm -f /etc/nginx/sites-enabled/default

nginx -t || die "La configuración de nginx no es válida."
systemctl reload nginx || systemctl restart nginx
ok "nginx configurado para $DOMINIO."

# --- 9. TLS ------------------------------------------------------------------
log "Comprobando el certificado"

CERT_DIR="/etc/letsencrypt/live/$DOMINIO"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    ok "Certificado encontrado en $CERT_DIR (se renueva solo: no se toca certbot)."
elif [ -f "/etc/nginx/snippets/ssl-options-ssl-nginx.conf" ]; then
    warn "No hay certificado en $CERT_DIR, pero el servidor tiene snippets de SSL de nginx."
    warn "Si el TLS lo termina otro servidor, ajusta a mano ssl_certificate en $NGINX_CONF."
else
    warn "No se encuentra el certificado en $CERT_DIR."
    warn "Emítelo con: certbot --nginx -d $DOMINIO --email TU@EMAIL --agree-tos --no-eff-email"
fi

# --- 10. Tareas programadas --------------------------------------------------
if [ "$SKIP_CRON" -eq 1 ]; then
    warn "Tareas programadas omitidas (--skip-cron)."
else
    log "Instalando las tareas programadas"

    install -m 644 "$APP_DIR/deploy/cron/sonora-backup" /etc/cron.d/sonora-backup
    install -m 644 "$APP_DIR/deploy/cron/sonora-monitor" /etc/cron.d/sonora-monitor
    install -m 644 "$APP_DIR/deploy/cron/sonora-maintenance" /etc/cron.d/sonora-maintenance
    install -m 644 "$APP_DIR/deploy/logrotate/sonora" /etc/logrotate.d/sonora
    chmod 644 /etc/cron.d/sonora-*

    install -m 755 "$APP_DIR/deploy/backup.sh" "$DEPLOY_DIR/deploy/backup.sh"
    install -m 755 "$APP_DIR/deploy/restore.sh" "$DEPLOY_DIR/deploy/restore.sh"
    install -m 755 "$APP_DIR/deploy/monitor.sh" "$DEPLOY_DIR/deploy/monitor.sh"

    cat > /etc/default/sonora <<EOF
MEDIA_DIR=$MEDIA_DIR
COMPOSE_FILE=$APP_DIR/docker-compose.prod.yml
BACKUP_ROOT=$DEPLOY_DIR/backups
DB_USER=$(grep -E '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2-)
DB_PASSWORD=$DB_PASSWORD
DB_ROOT_PASSWORD=root
KEEP_DAYS=7
KEEP_WEEKS=4
EOF
    chmod 644 /etc/default/sonora

    ok "Tareas instaladas (backup diario, monitor cada 5 min, mantenimiento)."
fi

# --- 11. Verificación --------------------------------------------------------
log "Verificando el despliegue"

sleep 5

# Se prueba el vhost real contra el localhost: así se valida el TLS, la SPA y
# el proxy a PHP-FPM, no solo los contenedores.
resolve="--resolve ${DOMINIO}:443:127.0.0.1"

check_url() {
    local url="$1" label="$2"

    if ! command -v curl >/dev/null 2>&1; then
        warn "curl no está disponible: no se puede comprobar $label."
        return
    fi

    local status
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 $resolve "$url" 2>/dev/null || echo '(sin respuesta)')"

    if [ "$status" = "200" ]; then
        ok "$label responde 200."
    else
        warn "$label devuelve '$status'."
    fi
}

check_url "https://$DOMINIO/" "La SPA"
check_url "https://$DOMINIO/api/v1/health" "La API"
check_url "https://$DOMINIO/robots.txt" "robots.txt"
check_url "https://$DOMINIO/sanctum/csrf-cookie" "La cookie CSRF"

if command -v curl >/dev/null 2>&1; then
    robots="$(curl -fsS --max-time 15 $resolve "https://$DOMINIO/robots.txt" 2>/dev/null || echo '')"
    if printf '%s' "$robots" | grep -q 'Disallow: /'; then
        ok "robots.txt prohíbe el rastreo (sitio privado)."
    else
        warn "robots.txt no contiene 'Disallow: /'. Revisa el ajuste de indexación."
    fi
fi

# --- 12. Resumen -------------------------------------------------------------
cat <<EOF

$(printf '\033[1;32m')══════════════════════════════════════════════════$(printf '\033[0m')
 Despliegue terminado
$(printf '\033[1;32m')══════════════════════════════════════════════════$(printf '\033[0m')

  Dominio:        https://$DOMINIO
  Código:         $APP_DIR
  Raíz web:       $WEB_ROOT
  Logs nginx:     $LOG_DIR
  Medios:         $MEDIA_DIR
  Backups:        $DEPLOY_DIR/backups
  Contraseña BD:  $DB_PASSWORD

  Estado de los servicios:
$(cd "$APP_DIR" && $DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml ps --format '    {{.Service}}  {{.Status}}')

  Copia de seguridad ahora:
    $DEPLOY_DIR/deploy/backup.sh --verify

  Estado del sistema:
    $DEPLOY_DIR/deploy/monitor.sh

  Primer arranque:
    1. Entra en https://$DOMINIO/login con la cuenta de administrador.
    2. Abre el panel de administración para registrar usuarios y cambiar los
       ajustes del sitio (el registro público y la indexación están cerrados).

  Actualizar más adelante:
    cd $APP_DIR && git pull && \\
      docker compose --env-file backend/.env.production -f docker-compose.prod.yml build && \\
      docker compose --env-file backend/.env.production -f docker-compose.prod.yml up -d

EOF
