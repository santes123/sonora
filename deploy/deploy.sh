#!/usr/bin/env bash
#
# Despliegue de Sonora en un Ubuntu Server con Docker.
#
# Script único: comprueba el sistema, prepara las carpetas, despliega el
# código, construye las imágenes, levanta el stack, instala nginx con TLS,
# programa las tareas y verifica que todo responde.
#
# Uso:
#   sudo ./deploy/deploy.sh --domain music.antoniogmportfolio.online --email tu@email.com
#
# Opciones:
#   --domain DOMINIO     dominio público (por defecto music.antoniogmportfolio.online)
#   --email CORREO       correo de Let's Encrypt (obligatorio para el TLS)
#   --repo URL           repositorio git a desplegar (usa el actual si se omite)
#   --branch RAMA        rama a desplegar (por defecto main)
#   --app-key CLAVE      APP_KEY de Laravel (si no se indica, se genera)
#   --db-password CLAVE  contraseña de MariaDB (si no se indica, se genera)
#   --skip-tls           no emitir certificado (para probar antes del DNS)
#   --skip-build         no reconstruir las imágenes
#   --skip-cron          no instalar las tareas programadas
#
# Variables de entorno alternativas: DOMINIO, CORREO, REPO, RAMA, APP_KEY,
# DB_PASSWORD, DEPLOY_DIR (por defecto /srv/sonora).
#
set -euo pipefail

# --- Valores por defecto ----------------------------------------------------
DOMINIO="${DOMINIO:-music.antoniogmportfolio.online}"
CORREO="${CORREO:-}"
REPO="${REPO:-}"
RAMA="${RAMA:-main}"
DEPLOY_DIR="${DEPLOY_DIR:-/srv/sonora}"
APP_KEY="${APP_KEY:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
SKIP_TLS=0
SKIP_BUILD=0
SKIP_CRON=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

while [ $# -gt 0 ]; do
    case "$1" in
        --domain) DOMINIO="$2"; shift 2 ;;
        --email) CORREO="$2"; shift 2 ;;
        --repo) REPO="$2"; shift 2 ;;
        --branch) RAMA="$2"; shift 2 ;;
        --app-key) APP_KEY="$2"; shift 2 ;;
        --db-password) DB_PASSWORD="$2"; shift 2 ;;
        --skip-tls) SKIP_TLS=1; shift ;;
        --skip-build) SKIP_BUILD=1; shift ;;
        --skip-cron) SKIP_CRON=1; shift ;;
        -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
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

docker compose version >/dev/null 2>&1 || true
ok "Docker $(docker version --format '{{.Server.Version}}'), nginx y git disponibles."

if ! docker info >/dev/null 2>&1; then
    warn "El usuario actual no está en el grupo docker; se usará sudo."
    DOCKER="sudo docker"
else
    DOCKER="docker"
fi

# --- 2. Estructura de carpetas ----------------------------------------------
log "Preparando $DEPLOY_DIR"

mkdir -p "$DEPLOY_DIR"/{media,web,backups,deploy}
chown -R "$(id -u):$(id -g)" "$DEPLOY_DIR" 2>/dev/null || true
ok "Carpetas listas."

APP_DIR="$DEPLOY_DIR/app"

# --- 3. Código ---------------------------------------------------------------
log "Preparando el código"

if [ -n "$REPO" ]; then
    if [ -d "$APP_DIR/.git" ]; then
        git -C "$APP_DIR" fetch --all --tags
        git -C "$APP_DIR" checkout "$RAMA"
        git -C "$APP_DIR" pull --ff-only origin "$RAMA"
    else
        git clone --branch "$RAMA" "$REPO" "$APP_DIR"
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

export MEDIA_DIR="$DEPLOY_DIR/media"

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
log "Publicando la SPA en $DEPLOY_DIR/web"

rm -rf "$DEPLOY_DIR/web"/* 2>/dev/null || true
container_id="$($DOCKER create sonora-web:prod)"
$DOCKER cp "$container_id:/usr/share/nginx/html/." "$DEPLOY_DIR/web/"
$DOCKER rm "$container_id" >/dev/null
ok "SPA publicada."

# --- 8. nginx del host -------------------------------------------------------
log "Configurando nginx"

install -m 644 "$APP_DIR/deploy/nginx/music.antoniogmportfolio.online.conf" \
    "/etc/nginx/sites-available/$DOMINIO.conf"
install -m 644 "$APP_DIR/deploy/nginx/snippets/sonora-fastcgi.conf" \
    /etc/nginx/snippets/sonora-fastcgi.conf

# La configuración generada usa el dominio por defecto; se adapta al real.
sed -i "s/music\.antoniogmportfolio\.online/$DOMINIO/g" "/etc/nginx/sites-available/$DOMINIO.conf"

ln -sf "/etc/nginx/sites-available/$DOMINIO.conf" "/etc/nginx/sites-enabled/$DOMINIO.conf"
rm -f /etc/nginx/sites-enabled/default

# El directorio de medios debe poder leerlo nginx.
chmod 755 "$DEPLOY_DIR" "$DEPLOY_DIR/media" 2>/dev/null || true

nginx -t || die "La configuración de nginx no es válida."
systemctl reload nginx || systemctl restart nginx
ok "nginx configurado para $DOMINIO."

# --- 9. TLS ------------------------------------------------------------------
if [ "$SKIP_TLS" -eq 1 ]; then
    warn "TLS omitido (--skip-tls)."
else
    log "Emitiendo el certificado de Let's Encrypt"

    if [ -z "$CORREO" ]; then
        warn "Falta --email: no se puede emitir el certificado. Emítelo luego con:"
        warn "  certbot --nginx -d $DOMINIO --email TU@EMAIL --agree-tos --no-eff-email"
    else
        if command -v certbot >/dev/null 2>&1; then
            certbot --nginx -d "$DOMINIO" --email "$CORREO" --agree-tos --no-eff-email --redirect \
                || warn "Certbot falló: revisa que el DNS apunte al servidor."
        else
            apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx
            certbot --nginx -d "$DOMINIO" --email "$CORREO" --agree-tos --no-eff-email --redirect \
                || warn "Certbot falló: revisa que el DNS apunte al servidor."
        fi

        systemctl enable certbot.timer >/dev/null 2>&1 || true
        systemctl start certbot.timer >/dev/null 2>&1 || true
        ok "Certificado emitido y renovación automática activada."
    fi
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
MEDIA_DIR=$DEPLOY_DIR/media
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

health="(sin respuesta)"
if command -v curl >/dev/null 2>&1; then
    health="$(curl -fsS --max-time 15 "http://127.0.0.1:8080/api/v1/health" 2>/dev/null || echo '(sin respuesta)')"
fi

if echo "$health" | grep -q '"status":"ok"'; then
    ok "La API responde: $health"
else
    warn "La API no responde todavía. Revisa: docker compose -f $APP_DIR/docker-compose.prod.yml logs app"
fi

spa="(sin respuesta)"
if command -v curl >/dev/null 2>&1; then
    spa="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:9000/" 2>/dev/null || echo '(sin respuesta)')"
fi
ok "PHP-FPM responde (status $spa)."

if command -v curl >/dev/null 2>&1; then
    https_status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMINIO/" 2>/dev/null || echo '(sin respuesta)')"
    if [ "$https_status" = "200" ]; then
        ok "https://$DOMINIO responde con 200."
    else
        warn "https://$DOMINIO devuelve '$https_status'. Revisa el certificado y nginx."
    fi
fi

# --- 12. Resumen -------------------------------------------------------------
cat <<EOF

$(printf '\033[1;32m')══════════════════════════════════════════════════$(printf '\033[0m')
 Despliegue terminado
$(printf '\033[1;32m')══════════════════════════════════════════════════$(printf '\033[0m')

  Dominio:        https://$DOMINIO
  Código:         $APP_DIR
  Medios:         $DEPLOY_DIR/media
  Backups:        $DEPLOY_DIR/backups
  Contraseña BD:  $DB_PASSWORD

  Estado de los servicios:
$(cd "$APP_DIR" && $DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml ps --format '    {{.Service}}  {{.Status}}')

  Copia de seguridad ahora:
    $DEPLOY_DIR/deploy/backup.sh --verify

  Estado del sistema:
    $DEPLOY_DIR/deploy/monitor.sh

  Actualizar más adelante:
    cd $APP_DIR && git pull && \\
      docker compose --env-file backend/.env.production -f docker-compose.prod.yml build && \\
      docker compose --env-file backend/.env.production -f docker-compose.prod.yml up -d

EOF
