#!/usr/bin/env bash
#
# Utilidad de administración de Sonora para el servidor.
#
# Resuelve TODAS las rutas de forma absoluta, así que funciona desde
# cualquier directorio (esto evita el error "couldn't find env file:
# /backend/.env.production" que da compose cuando se ejecuta desde ~).
#
# Uso:
#   sudo /srv/sonora/deploy/sonora.sh artisan <comando artisan> [args...]
#   sudo /srv/sonora/deploy/sonora.sh compose <comando compose> [args...]
#   sudo /srv/sonora/deploy/sonora.sh db [-e "SQL"]
#
# Ejemplos:
#   sudo /srv/sonora/deploy/sonora.sh artisan sonora:update-user \
#       --email=viejo@correo.com --new-email=nuevo@correo.com
#   sudo /srv/sonora/deploy/sonora.sh artisan sonora:create-admin \
#       --email=admin@ejemplo.com --name="Administrador"
#   sudo /srv/sonora/deploy/sonora.sh db -e "SELECT email, role FROM users;"
#   sudo /srv/sonora/deploy/sonora.sh compose ps
#
set -euo pipefail

APP_DIR="${SONORA_APP_DIR:-/srv/sonora/app}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/backend/.env.production"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "No se encuentra $COMPOSE_FILE" >&2
    exit 1
fi

cd "$APP_DIR"

compose() {
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

case "${1:-}" in
    artisan)
        shift
        compose exec -T app php artisan "$@"
        ;;

    compose)
        shift
        compose "$@"
        ;;

    db)
        shift
        db_user="$(grep -E '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2-)"
        db_name="$(grep -E '^DB_DATABASE=' "$ENV_FILE" | cut -d= -f2-)"
        db_password="$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
        compose exec -T mariadb \
            mariadb -u"$db_user" -p"$db_password" "$db_name" "$@"
        ;;

    logs)
        shift
        compose logs -f "$@"
        ;;

    *)
        cat >&2 <<'MSG'
Uso: sonora.sh <artisan|compose|db|logs> [args...]

  artisan  Ejecuta un comando de artisan dentro del contenedor `app`
  compose  Ejecuta docker compose con las rutas correctas
  db       Abre el cliente mariadb (acepta -e "SQL")
  logs     Muestra los logs del stack (por defecto, en vivo)
MSG
        exit 1
        ;;
esac
