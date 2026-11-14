#!/usr/bin/env bash
#
# Restauración de Sonora a partir de una copia de seguridad.
#
# Uso:
#   ./deploy/restore.sh /srv/sonora/backups/daily/db-2026-11-13T15-00-00.sql.gz
#   ./deploy/restore.sh <db.sql.gz> <media.tar.gz>
#
# Variables de entorno:
#   COMPOSE_FILE  compose de producción (por defecto ./docker-compose.prod.yml)
#   MEDIA_DIR     directorio de medios    (por defecto /srv/sonora/media)
#   DB_NAME       base de datos           (por defecto music)
#   DB_USER       usuario de la app       (por defecto music)
#
# ADVERTENCIA: la restauración SOBRESCRIBE los datos actuales.
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-$(dirname "$0")/../docker-compose.prod.yml}"
MEDIA_DIR="${MEDIA_DIR:-/srv/sonora/media}"
DB_NAME="${DB_NAME:-music}"
DB_USER="${DB_USER:-music}"

DB_FILE="${1:-}"
MEDIA_FILE="${2:-}"

[ -n "$DB_FILE" ] || { echo "Uso: $0 <dump.sql.gz> [medios.tar.gz]"; exit 1; }
[ -f "$DB_FILE" ] || { echo "No existe el fichero: $DB_FILE"; exit 1; }

echo "⚠  Se va a restaurar la base de datos '$DB_NAME' desde $DB_FILE"
read -r -p "¿Continuar? (escribe SI): " answer
[ "$answer" = "SI" ] || { echo "Cancelado."; exit 1; }

# --- Comprobación de integridad de la copia ---------------------------------
gzip -t "$DB_FILE" || { echo "El volcado está corrupto."; exit 1; }

echo "==> Deteniendo la aplicación (para que nadie escriba durante la restauración)…"
docker compose -f "$COMPOSE_FILE" stop app queue scheduler || true

echo "==> Restaurando la base de datos…"
gunzip -c "$DB_FILE" > /tmp/sonora-restore.sql
docker cp /tmp/sonora-restore.sql "$(docker compose -f "$COMPOSE_FILE" ps -q mariadb):/tmp/restore.sql"
docker compose -f "$COMPOSE_FILE" exec -T mariadb sh -c \
    "mariadb -uroot -p'${DB_ROOT_PASSWORD:-root}' -e 'DROP DATABASE IF EXISTS ${DB_NAME}; CREATE DATABASE ${DB_NAME}; GRANT ALL ON ${DB_NAME}.* TO '${DB_USER}'@'%'; FLUSH PRIVILEGES;' \
     && mariadb -uroot -p'${DB_ROOT_PASSWORD:-root}' ${DB_NAME} < /tmp/restore.sql"
rm -f /tmp/sonora-restore.sql

# --- Medios ------------------------------------------------------------------
if [ -n "$MEDIA_FILE" ] && [ -f "$MEDIA_FILE" ]; then
    echo "==> Restaurando los medios…"
    tar -xzf "$MEDIA_FILE" -C "$(dirname "$MEDIA_DIR")"
    # Nginx debe poder leer los ficheros (X-Accel-Redirect).
    docker compose -f "$COMPOSE_FILE" exec -T app php artisan media:permissions || true
else
    echo "==> No se indica paquete de medios: se conserva el actual."
fi

echo "==> Arrancando la aplicación…"
docker compose -f "$COMPOSE_FILE" start app queue scheduler

echo "==> Comprobando la salud…"
for i in $(seq 1 30); do
    if curl -fsS "http://localhost:8080/api/v1/health" >/dev/null 2>&1; then
        echo "✓ Restauración completada y la aplicación responde."
        exit 0
    fi
    sleep 2
done

echo "⚠  La aplicación no responde tras 60 s. Revisa: docker compose -f $COMPOSE_FILE logs app"
exit 1
