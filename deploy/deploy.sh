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
#   # Repositorio público por HTTPS
#   sudo ./deploy/deploy.sh --repo https://github.com/TU_USUARIO/sonora.git
#
#   # Repositorio privado por HTTPS con un token de GitHub
#   sudo env REPO_TOKEN=ghp_xxx ./deploy/deploy.sh \
#       --repo https://github.com/TU_USUARIO/sonora.git
#
#   # Repositorio privado por SSH (deploy key de solo lectura)
#   sudo ./deploy/deploy.sh --repo git@github.com:TU_USUARIO/sonora.git
#
# Las cuatro formas de autenticarse y cuál elegir están en
# docs/04-guia-acceso-repositorio.md
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
#   --fpm-port PUERTO    puerto del host para PHP-FPM (por defecto 9001)
#   --nginx-dir RUTA     configuración de nginx a usar (por defecto se detecta:
#                        /etc/nginx-second, /etc/nginx, ...)
#   --nginx-service NOMBRE  servicio systemd de nginx (por defecto se detecta)
#   --no-adminer         no instalar el bloque de Adminer en nginx
#   --install-nginx     reinstalar el vhost de nginx (por defecto se conserva
#                        el que ya haya, por si está editado a mano)
#   --skip-build         no reconstruir las imágenes
#   --skip-cron          no instalar las tareas programadas
#   --skip-spa           no publicar la SPA (la publicas tú)
#   --install-cron      reinstalar las tareas programadas
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
# Puerto del host donde se publica PHP-FPM. 9000 es el valor por defecto de
# PHP-FPM, pero en servidores con Panel de control o Portainer suele estar
# ocupado: por eso 9001 y la opción --fpm-port.
FPM_PORT="${FPM_PORT:-9001}"
BIND_MARIADB_PORT="${BIND_MARIADB_PORT:-3307}"
BIND_REDIS_PORT="${BIND_REDIS_PORT:-6380}"
# Instancia de nginx a usar. Vacío = detección automática (puede haber varias:
# la del panel "nginx-second", la estándar, etc.).
NGINX_DIR_OVERRIDE="${NGINX_DIR:-}"
NGINX_SERVICE_OVERRIDE="${NGINX_SERVICE:-}"
SKIP_BUILD=0
SKIP_CRON=0
SKIP_SPA=0
INSTALL_NGINX=0
INSTALL_CRON=0
WITH_ADMINER=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Se guardan los argumentos originales: tras actualizar el código, el script
# puede haberse cambiado y hay que relanzarlo con las mismas opciones.
ORIGINAL_ARGS=("$@")

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
        --fpm-port) FPM_PORT="$2"; shift 2 ;;
        --nginx-dir) NGINX_DIR_OVERRIDE="$2"; shift 2 ;;
        --nginx-service) NGINX_SERVICE_OVERRIDE="$2"; shift 2 ;;
        --no-adminer) WITH_ADMINER=0; shift ;;
        --install-nginx) INSTALL_NGINX=1; shift ;;
        --install-cron) INSTALL_CRON=1; shift ;;
        --skip-build) SKIP_BUILD=1; shift ;;
        --skip-cron) SKIP_CRON=1; shift ;;
        --skip-spa) SKIP_SPA=1; shift ;;
        -h|--help) sed -n '2,43p' "$0"; exit 0 ;;
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
#
# GIT_TERMINAL_PROMPT=0 evita que un despliegue no interactivo se quede
# colgado esperando usuario/contraseña: si falta la autenticación, falla
# enseguida y con un mensaje que dice cómo arreglarlo.
export GIT_TERMINAL_PROMPT=0

clone_url="$REPO"
if [ -n "$REPO_TOKEN" ] && [ -n "$REPO" ]; then
    clone_url="$(printf '%s' "$REPO" | sed -e "s|^https://|https://x-access-token:${REPO_TOKEN}@|")"
fi
fetch_url="$clone_url"

# Ayuda cuando git no puede autenticarse contra el repositorio.
auth_help() {
    cat >&2 <<'MSG'
  Formas de autenticarse (guía completa en docs/04-guia-acceso-repositorio.md):

    1) HTTPS con token de GitHub (recomendado para repos privados):
         sudo env REPO_TOKEN=ghp_xxx ./deploy/deploy.sh \
             --repo https://github.com/USUARIO/sonora.git
       El token necesita el ámbito "repo" y no se queda en .git/config.

    2) HTTPS con el ayudante de credenciales de GitHub CLI:
         gh auth login && gh auth setup-git
       y después:
         sudo ./deploy/deploy.sh --repo https://github.com/USUARIO/sonora.git

    3) SSH con una deploy key de solo lectura:
         sudo ./deploy/deploy.sh --repo git@github.com:USUARIO/sonora.git

MSG
}

# Deja el remoto sin token y borra cualquier rastro del token en la config.
clean_remote() {
    git -C "$APP_DIR" remote set-url origin "$REPO" 2>/dev/null || true
    if [ -n "$REPO_TOKEN" ] && [ -f "$APP_DIR/.git/config" ]; then
        sed -i "s|${REPO_TOKEN}|***|g" "$APP_DIR/.git/config" || true
    fi
}

if [ -n "$REPO" ]; then
    if [ -d "$APP_DIR/.git" ]; then
        # Se descarga SOLO desde la URL con token: traer `--all` intentaría
        # también el remoto limpio (sin token) y fallaría en repos privados.
        git -C "$APP_DIR" fetch --tags --force "$fetch_url" \
            "+refs/heads/$RAMA:refs/remotes/origin/$RAMA" \
            || { auth_help; die "No se pudo descargar el repositorio. Revisa --repo y --repo-token."; }
        git -C "$APP_DIR" checkout -B "$RAMA" "refs/remotes/origin/$RAMA"
        git -C "$APP_DIR" reset --hard "refs/remotes/origin/$RAMA"
        # El remoto se deja sin token.
        clean_remote
    else
        git clone --branch "$RAMA" "$clone_url" "$APP_DIR" \
            || { auth_help; die "No se pudo clonar $REPO. Revisa --repo y --repo-token."; }
        clean_remote
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

# Si el código recién descargado trae un deploy.sh distinto al que se está
# ejecutando, se relanza desde la copia nueva: bash lee el script por partes y
# seguir con un fichero reescrito en mitad de la ejecución puede ejecutar
# líneas que no pertenecen a ninguna versión del script.
if [ "${SONORA_REEXEC:-0}" != "1" ] && [ "$SCRIPT_DIR/deploy.sh" != "$APP_DIR/deploy/deploy.sh" ] \
    && [ -f "$APP_DIR/deploy/deploy.sh" ]; then
    ok "El script se ha actualizado: se relanza desde $APP_DIR/deploy/deploy.sh"
    SONORA_REEXEC=1 exec bash "$APP_DIR/deploy/deploy.sh" "${ORIGINAL_ARGS[@]}"
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

# Si ya hay APP_KEY guardada, se respeta: cambiarla invalidaría las sesiones,
# los tokens CSRF y todo lo cifrado con ella.
if [ -z "$APP_KEY" ] && [ -f "$ENV_FILE" ]; then
    APP_KEY="$(grep -E '^APP_KEY=' "$ENV_FILE" | cut -d= -f2- || true)"
    if [ -n "$APP_KEY" ] && [ "$APP_KEY" != "CAMBIAR_ESTA_CLAVE" ]; then
        ok "APP_KEY existente conservada."
    else
        APP_KEY=""
    fi
fi

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

    # La imagen del frontend (sonora-web:prod) lleva la SPA compilada: la
    # publica el nginx del host. El servicio `web` está en el perfil
    # `nginx-docker`, así que hay que activarlo explícitamente para
    # construirlo (en producción ese contenedor no se levanta).
    $DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml \
        --profile nginx-docker build web \
        || die "No se pudo construir la imagen del frontend (sonora-web:prod)."
    ok "Imagen del frontend construida."

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
export BIND_FPM_PORT="$FPM_PORT"

# --- Control previo de puertos ----------------------------------------------
# Si otro proyecto del servidor tiene el puerto, `up -d` falla con un error
# poco claro ("port is already allocated") DESPUÉS de construir las imágenes.
# Aquí se comprueba antes y se dice quién ocupa el puerto.
our_project="$(sed -n 's/^name:[[:space:]]*//p' "$APP_DIR/docker-compose.prod.yml" 2>/dev/null | head -1)"
our_project="${our_project:-sonora}"

our_ports() {
    docker ps --filter "label=com.docker.compose.project=${our_project}" \
        --format '{{.Ports}}' 2>/dev/null \
        | grep -oE "[:.][0-9]+->" | tr -cd '0-9\n' | sort -u
}

port_owner() {
    local port="$1"
    local owners

    owners="$(docker ps --format '{{.Names}}|{{.Ports}}' 2>/dev/null \
        | awk -F'|' -v p="$port" '$2 ~ "[:.]" p "->" {print $1}' \
        | grep -vE "^${our_project}-" || true)"

    if [ -n "$owners" ]; then
        echo "$owners" | tr '\n' ' '
        return 0
    fi

    if command -v ss >/dev/null 2>&1; then
        if ss -ltn 2>/dev/null | awk '{print $4}' | grep -oE "[:.][0-9]+$" \
            | tr -cd '0-9\n' | sort -u | grep -qx "$port" \
            && ! our_ports | grep -qx "$port"; then
            echo "un proceso del host"
            return 0
        fi
    fi

    return 1
}

check_port() {
    local port="$1" label="$2" owner
    owner="$(port_owner "$port")" || return 0
    warn "El puerto $port ($label) ya lo está usando: $owner"
    return 1
}

free_port=1
for pair in "$FPM_PORT:PHP-FPM" "$BIND_MARIADB_PORT:MariaDB" "$BIND_REDIS_PORT:Redis"; do
    check_port "${pair%%:*}" "${pair#*:}" || free_port=0
done

if [ "$free_port" -eq 0 ]; then
    die "Hay puertos ocupados por otro proyecto del servidor.
  Cambia el puerto de PHP-FPM con --fpm-port (por ejemplo --fpm-port 9002) o
  libera el puerto ocupado. MariaDB y Redis se pueden mover con
  BIND_MARIADB_PORT y BIND_REDIS_PORT."
fi

ok "Puertos libres: PHP-FPM $FPM_PORT, MariaDB $BIND_MARIADB_PORT, Redis $BIND_REDIS_PORT."

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
if [ "$SKIP_SPA" -eq 1 ]; then
    warn "Publicación de la SPA omitida (--skip-spa)."
else
    log "Publicando la SPA en $WEB_ROOT"

    # Solo se borran los ficheros que genera la SPA. El resto del web root
    # (`.well-known` del panel, `index.php` de Adminer, etc.) se deja intacto:
    # ese directorio lo comparte el panel de hosting con el sitio.
    rm -rf "$WEB_ROOT/assets" "$WEB_ROOT/icons" 2>/dev/null || true
    rm -f "$WEB_ROOT/index.html" "$WEB_ROOT/sw.js" "$WEB_ROOT/registerSW.js" \
        "$WEB_ROOT/manifest.webmanifest" "$WEB_ROOT/favicon.svg" "$WEB_ROOT/50x.html" \
        2>/dev/null || true

    if ! $DOCKER image inspect sonora-web:prod >/dev/null 2>&1; then
        if [ "$SKIP_BUILD" -eq 1 ]; then
            die "Falta la imagen sonora-web:prod y se pidió --skip-build. Quita --skip-build o construye la imagen."
        fi
        warn "Falta la imagen sonora-web:prod: se construye ahora (incluye el build del frontend)."
        $DOCKER compose --env-file backend/.env.production -f docker-compose.prod.yml \
            --profile nginx-docker build web \
            || die "No se pudo construir la imagen del frontend (sonora-web:prod)."
    fi

    container_id="$($DOCKER create sonora-web:prod)"
    $DOCKER cp "$container_id:/usr/share/nginx/html/." "$WEB_ROOT/"
    $DOCKER rm "$container_id" >/dev/null

    if id -u www-data >/dev/null 2>&1; then
        chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
    fi
    chmod -R a+rX "$WEB_ROOT" 2>/dev/null || true
    ok "SPA publicada."
fi

# --- 8. nginx del host -------------------------------------------------------
log "Configurando nginx"

# El servidor puede tener VARIAS instancias de nginx (por ejemplo, la del
# panel de hosting: "nginx-second" con su propio /etc/nginx-second/nginx.conf).
# Hay que tocar la que sirve el dominio, no la estándar.
#
# Se elige, por este orden:
#   1. La instancia cuya configuración ya menciona el dominio.
#   2. La instancia cuyo servicio systemd está activo.
#   3. La estándar (/etc/nginx).
detect_nginx() {
    local dir svc

    for dir in /etc/nginx-second /etc/nginx /usr/local/nginx; do
        [ -f "$dir/nginx.conf" ] || continue
        svc="$(basename "$dir")"
        if grep -rq "$DOMINIO" "$dir" 2>/dev/null; then
            NGINX_DIR="$dir"
            NGINX_SERVICE="$svc"
            return 0
        fi
    done

    for dir in /etc/nginx-second /etc/nginx; do
        [ -f "$dir/nginx.conf" ] || continue
        svc="$(basename "$dir")"
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            NGINX_DIR="$dir"
            NGINX_SERVICE="$svc"
            return 0
        fi
    done

    NGINX_DIR="/etc/nginx"
    NGINX_SERVICE="nginx"
}

if [ -n "$NGINX_DIR_OVERRIDE" ]; then
    NGINX_DIR="$NGINX_DIR_OVERRIDE"
    NGINX_SERVICE="${NGINX_SERVICE_OVERRIDE:-$(basename "$NGINX_DIR")}"
    [ -f "$NGINX_DIR/nginx.conf" ] || die "No existe $NGINX_DIR/nginx.conf"
else
    detect_nginx
fi

# Sitios y snippets. Los snippets van a un directorio PROPIO (nginx.<dominio>)
# para que el `include` con comodín del nginx principal no los arrastre al
# contexto http (donde fastcgi_pass no es válido).
if [ -d "$NGINX_DIR/sites-available" ]; then
    NGINX_SITES_AVAILABLE="$NGINX_DIR/sites-available"
    NGINX_SITES_ENABLED="$NGINX_DIR/sites-enabled"
else
    NGINX_SITES_AVAILABLE="$NGINX_DIR/conf.d"
    NGINX_SITES_ENABLED="$NGINX_DIR/conf.d"
fi

SNIPPETS_DIR="$NGINX_DIR/nginx-sonora"
mkdir -p "$NGINX_SITES_ENABLED" "$SNIPPETS_DIR"

# fastcgi_params: el de la propia instancia si existe; si no, el del paquete.
FASTCGI_PARAMS="/etc/nginx/fastcgi_params"
[ -f "$NGINX_DIR/fastcgi_params" ] && FASTCGI_PARAMS="$NGINX_DIR/fastcgi_params"

ok "Instancia de nginx: $NGINX_DIR (servicio $NGINX_SERVICE)."
ok "Sitios: $NGINX_SITES_AVAILABLE · Snippets: $SNIPPETS_DIR"

# Si hay OTROS ficheros de esta instancia que ya sirven el dominio, hay que
# avisar: dos server blocks con el mismo nombre se ignoran (gana el primero).
others="$(grep -rl "server_name.*$DOMINIO" "$NGINX_DIR" 2>/dev/null \
    | grep -v "^$NGINX_CONF$" | grep -v "/nginx-sonora/" | head -5 || true)"

if [ -n "$others" ]; then
    warn "Estos ficheros de $NGINX_DIR ya mencionan el dominio:"
    printf '    %s\n' $others
    warn "Si el sitio no responde, revisa que solo un vhost sirva $DOMINIO."
fi

install -m 644 "$APP_DIR/deploy/nginx/snippets/sonora-fastcgi.conf" \
    "$SNIPPETS_DIR/sonora-fastcgi.conf"
install -m 644 "$APP_DIR/deploy/nginx/snippets/security-headers.conf" \
    "$SNIPPETS_DIR/security-headers.conf"

# El puerto de PHP-FPM se fija aquí (el del host, no el 9000 interno del
# contenedor): si no coincide con el que publica Docker, la API devuelve 502.
sed -i -E "s|fastcgi_pass 127\.0\.0\.1:[0-9]+;|fastcgi_pass 127.0.0.1:${FPM_PORT};|" \
    "$SNIPPETS_DIR/sonora-fastcgi.conf"
grep -q "fastcgi_pass 127.0.0.1:${FPM_PORT};" "$SNIPPETS_DIR/sonora-fastcgi.conf" \
    || die "No se pudo fijar el puerto de PHP-FPM ($FPM_PORT) en el snippet de nginx."

# El snippet incluye fastcgi_params: se apunta al de la instancia en uso.
sed -i "s|include /etc/nginx/fastcgi_params;|include $FASTCGI_PARAMS;|" \
    "$SNIPPETS_DIR/sonora-fastcgi.conf"

NGINX_CONF="$NGINX_SITES_AVAILABLE/$DOMINIO.conf"

# El vhost se instala UNA vez. Si ya existe se conserva: puede estar editado
# a mano (límites, certificados, reglas propias). Con --install-nginx se
# reinstala desde el repositorio.
if [ -f "$NGINX_CONF" ] && [ "$INSTALL_NGINX" -eq 0 ]; then
    ok "Configuración de nginx conservada ($NGINX_CONF)."
    ok "Para reinstalarla desde el repositorio: --install-nginx"
else
    vhost_src="$APP_DIR/deploy/nginx/$DOMINIO.conf"
    [ -f "$vhost_src" ] || vhost_src="$APP_DIR/deploy/nginx/music.antoniogmportfolio.online.conf"

    # Copia de seguridad por si el fichero que se sustituye tenía cambios.
    if [ -f "$NGINX_CONF" ]; then
        cp -a "$NGINX_CONF" "$NGINX_CONF.bak"
        ok "Copia de seguridad: $NGINX_CONF.bak"
    fi

    install -m 644 "$vhost_src" "$NGINX_CONF" "$NGINX_CONF"

    # La configuración generada trae los valores por defecto del servidor: se
    # adaptan a los reales (dominio, raíz web, logs, medios, snippets).
    sed -i \
        -e "s|music\.antoniogmportfolio\.online|$DOMINIO|g" \
        -e "s|/var/www/site-music-antoniogmport-5de994/htdocs|$WEB_ROOT|g" \
        -e "s|/var/www/site-music-antoniogmport-5de994/logs|$LOG_DIR|g" \
        -e "s|/srv/sonora/media|$MEDIA_DIR|g" \
        -e "s|/etc/nginx/snippets|$SNIPPETS_DIR|g" \
        "$NGINX_CONF"

    # El include de Adminer es relativo: con `-c /etc/nginx-second/nginx.conf`
    # resuelve contra /etc/nginx-second, no contra /etc/nginx. Se apunta a la
    # ruta absoluta de la instancia en uso.
    sed -i "s|include snippets/fastcgi-php.conf;|include $NGINX_DIR/snippets/fastcgi-php.conf;|" \
        "$NGINX_CONF"

    ok "Configuración de nginx instalada en $NGINX_CONF."
fi

# El vhost incluye los snippets de TLS del sistema. Si en este servidor no
# existen, se quita el include (nginx arranca con los valores por defecto) en
# lugar de dejar una configuración rota.
if grep -q "include /etc/letsencrypt/options-ssl-nginx.conf;" "$NGINX_CONF" \
    && [ ! -f "/etc/letsencrypt/options-ssl-nginx.conf" ]; then
    sed -i '/include \/etc\/letsencrypt\/options-ssl-nginx.conf;/d' "$NGINX_CONF"
    warn "No existe /etc/letsencrypt/options-ssl-nginx.conf: se usa la configuración TLS por defecto."
fi

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
# Si no están los ficheros de Adminer, el snippet de PHP del panel o el socket
# de PHP-FPM del host, el bloque se elimina: dejarlo apuntando a algo
# inexistente rompe `nginx -t`.
if [ "$WITH_ADMINER" -eq 0 ]; then
    sed -i '/#---BEGIN-ADMINER---/,/#---END-ADMINER---/d' "$NGINX_CONF"
    ok "Bloque de Adminer omitido."
elif [ ! -f "/usr/share/adminer/index.php" ] \
    || [ ! -f "$NGINX_DIR/snippets/fastcgi-php.conf" ] \
    || [ ! -S "/run/php/php8.3-fpm.sock" ]; then
    sed -i '/#---BEGIN-ADMINER---/,/#---END-ADMINER---/d' "$NGINX_CONF"
    warn "Adminer no está instalado en el servidor: se omite su bloque."
fi

# Habilitar el sitio.
if [ "$NGINX_SITES_AVAILABLE" != "$NGINX_SITES_ENABLED" ]; then
    ln -sf "$NGINX_CONF" "$NGINX_SITES_ENABLED/$DOMINIO.conf"
fi

# Comprobación de la configuración con LA instancia que se está usando.
nginx -t -c "$NGINX_DIR/nginx.conf" || die "La configuración de nginx no es válida."
systemctl reload "$NGINX_SERVICE" || systemctl restart "$NGINX_SERVICE"
ok "nginx ($NGINX_SERVICE) configurado para $DOMINIO."

# Limpieza: si una ejecución anterior instaló el vhost en otra instancia de
# nginx (la estándar, por ejemplo), se retira de ahí para no duplicar el
# dominio ni dejar configs rotas.
if [ "$NGINX_DIR" != "/etc/nginx" ] && [ -f "/etc/nginx/sites-available/$DOMINIO.conf" ]; then
    rm -f "/etc/nginx/sites-available/$DOMINIO.conf" "/etc/nginx/sites-enabled/$DOMINIO.conf"
    rm -rf /etc/nginx/nginx-sonora
    ok "Vhost retirado de /etc/nginx (la instancia en uso es $NGINX_DIR)."
fi

# --- 9. TLS ------------------------------------------------------------------
log "Comprobando el certificado"

CERT_DIR="/etc/letsencrypt/live/$DOMINIO"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    ok "Certificado encontrado en $CERT_DIR (se renueva solo: no se toca certbot)."
elif [ -f "$NGINX_DIR/snippets/ssl-options-ssl-nginx.conf" ] \
    || [ -f "/etc/nginx/snippets/ssl-options-ssl-nginx.conf" ]; then
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

    # Igual que con el vhost de nginx: si ya existen, se conservan por si
    # están editadas a mano. Con --install-cron se reinstalan.
    install_cron_file() {
        local src="$1" dest="$2"
        if [ -f "$dest" ] && [ "$INSTALL_CRON" -eq 0 ]; then
            ok "Conservado: $dest"
            return 0
        fi
        install -m 644 "$src" "$dest"
    }

    install_cron_file "$APP_DIR/deploy/cron/sonora-backup" /etc/cron.d/sonora-backup
    install_cron_file "$APP_DIR/deploy/cron/sonora-monitor" /etc/cron.d/sonora-monitor
    install_cron_file "$APP_DIR/deploy/cron/sonora-maintenance" /etc/cron.d/sonora-maintenance
    install_cron_file "$APP_DIR/deploy/logrotate/sonora" /etc/logrotate.d/sonora
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
  PHP-FPM:        127.0.0.1:$FPM_PORT
  Contraseña BD:  $DB_PASSWORD

  Contenedores (6): app, queue, scheduler, mariadb, redis y web
  (web solo con el perfil nginx-docker; en producción el TLS lo termina el
  nginx del host, así que no se levanta).

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

  (El repositorio es privado: para actualizar, vuelve a lanzar deploy.sh con el
   token, como está en docs/04-guia-acceso-repositorio.md.)

EOF
