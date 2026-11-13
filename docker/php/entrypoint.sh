#!/bin/sh
set -e

cd /var/www/html

# En desarrollo el código llega por bind mount; el vendor puede no existir todavía.
if [ ! -f vendor/autoload.php ]; then
    echo "[entrypoint] Instalando dependencias de Composer..."
    composer install --no-interaction --prefer-dist --no-progress
fi

# Estructura mínima de almacenamiento (necesaria también con volúmenes nuevos).
mkdir -p \
    storage/app/private/media \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

# En el contenedor corremos como root por defecto; los ficheros generados deben ser
# escribibles por php-fpm (www-data).
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R ug+rwX storage bootstrap/cache 2>/dev/null || true

if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
fi

if [ -f .env ] && grep -q '^APP_KEY=$' .env; then
    php artisan key:generate --force --no-interaction || true
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] Ejecutando migraciones..."
    php artisan migrate --force --no-interaction
fi

exec "$@"
