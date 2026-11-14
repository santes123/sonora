#!/bin/sh
#
# Entrypoint de producción. Prepara el runtime antes de arrancar PHP-FPM.
#
# Variables relevantes (docker-compose.prod.yml):
#   RUN_MIGRATIONS=true  -> ejecuta `php artisan migrate --force`
#   OPTIMIZE_APP=false   -> no cachea config/rutas/vistas (para depurar)
#   APP_KEY              -> si viene vacía, se genera y persiste en .env
#
set -e

cd /var/www/html

# --- Estructura de almacenamiento y permisos ---------------------------------
mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/private/media \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R ug+rwX storage bootstrap/cache 2>/dev/null || true

# --- Espera a la base de datos ----------------------------------------------
# El healthcheck de MariaDB ya ordena el arranque, pero un reinicio manual
# de la base no debe tumbar el arranque de la app.
DB_WAIT="${DB_WAIT_SECONDS:-60}"
i=0
while [ "$i" -lt "$DB_WAIT" ]; do
    if php -r '
        $host = getenv("DB_HOST") ?: "mariadb";
        $port = getenv("DB_PORT") ?: "3306";
        $name = getenv("DB_DATABASE") ?: "music";
        $user = getenv("DB_USERNAME") ?: "music";
        $pass = getenv("DB_PASSWORD") ?: "";
        try {
            new PDO("mysql:host=$host;port=$port;dbname=$name", $user, $pass);
            exit(0);
        } catch (Throwable $e) {
            exit(1);
        }
    ' 2>/dev/null; then
        echo "[entrypoint] Base de datos disponible."
        break
    fi
    i=$((i + 1))
    sleep 1
done

if [ "$i" -ge "$DB_WAIT" ]; then
    echo "[entrypoint] Aviso: la base de datos no respondió en ${DB_WAIT}s; continúo."
fi

# --- APP_KEY ----------------------------------------------------------------
# En producción la clave se inyecta por variable de entorno (obligatorio).
# Si falta, se genera una y se guarda en storage/app/app.key para no perderla
# entre reinicios del contenedor. `php artisan key:generate` no sirve aquí:
# sin fichero .env en el contenedor no tiene dónde escribir la clave.
KEY_FILE="storage/app/app.key"

if [ -z "${APP_KEY:-}" ]; then
    if [ -f "$KEY_FILE" ]; then
        APP_KEY="$(cat "$KEY_FILE")"
        export APP_KEY
        echo "[entrypoint] APP_KEY recuperada de $KEY_FILE."
    else
        # `key:generate --show` imprime la clave envuelta en etiquetas de
        # consola (<comment>…</comment>): hay que limpiarla.
        APP_KEY="$(php artisan key:generate --show --force --no-interaction 2>/dev/null \
            | tr -d '\r' | sed -e 's/<[^>]*>//g')"
        if [ -z "$APP_KEY" ]; then
            echo "[entrypoint] ERROR: no se pudo generar APP_KEY. Defínela en .env.production." >&2
            exit 1
        fi
        printf '%s' "$APP_KEY" > "$KEY_FILE"
        chmod 600 "$KEY_FILE"
        export APP_KEY
        echo "[entrypoint] AVISO: APP_KEY generada automáticamente."
        echo "[entrypoint] Defínela en .env.production: si el volumen se pierde, las sesiones se invalidan."
    fi
fi

# --- Migraciones ------------------------------------------------------------
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] Ejecutando migraciones..."
    php artisan migrate --force --no-interaction
fi

# --- Cachés de Laravel ------------------------------------------------------
# config:cache se rehace en cada arranque: si cambian las variables de
# entorno, la configuración cacheada quedaría obsoleta.
if [ "${OPTIMIZE_APP:-true}" = "true" ]; then
    php artisan config:clear || true
    php artisan route:clear || true
    php artisan view:clear || true
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    echo "[entrypoint] Cachés de Laravel generadas."
fi

exec "$@"
