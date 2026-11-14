#!/usr/bin/env bash
#
# Copia de seguridad de Sonora (base de datos + medios privados).
#
# Uso:
#   ./deploy/backup.sh                 # backup normal
#   ./deploy/backup.sh --verify        # además restaura en una BD scratch
#
# Variables de entorno:
#   BACKUP_ROOT   directorio de backups   (por defecto /srv/sonora/backups)
#   MEDIA_DIR     directorio de medios    (por defecto /srv/sonora/media)
#   COMPOSE_FILE  compose de producción   (por defecto ./docker-compose.prod.yml)
#   KEEP_DAYS     retención de diarios    (por defecto 7)
#   KEEP_WEEKS    retención de semanales  (por defecto 4)
#   RESTIC_REPOSITORY  si se define, se copia también con restic (offsite)
#   RESTIC_PASSWORD  contraseña de restic (o variable RESTIC_PASSWORD_FILE)
#
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/srv/sonora/backups}"
MEDIA_DIR="${MEDIA_DIR:-/srv/sonora/media}"
COMPOSE_FILE="${COMPOSE_FILE:-$(dirname "$0")/../docker-compose.prod.yml}"
KEEP_DAYS="${KEEP_DAYS:-7}"
KEEP_WEEKS="${KEEP_WEEKS:-4}"
DB_NAME="${DB_NAME:-music}"
DB_USER="${DB_USER:-music}"
VERIFY=0

[ "${1:-}" = "--verify" ] && VERIFY=1

STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
DAY_DIR="$BACKUP_ROOT/daily"
WEEK_DIR="$BACKUP_ROOT/weekly"
LOG_FILE="${LOG_FILE:-/var/log/sonora-backup.log}"

log() {
    printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG_FILE"
}

fail() {
    log "ERROR: $*"
    exit 1
}

mkdir -p "$DAY_DIR" "$WEEK_DIR"

# --- Base de datos ----------------------------------------------------------
# --single-transaction: volcado consistente sin bloquear la escritura.
DB_FILE="$DAY_DIR/db-$STAMP.sql.gz"

log "Volcando la base de datos $DB_NAME…"
if ! docker compose -f "$COMPOSE_FILE" exec -T mariadb \
        mariadb-dump -u"$DB_USER" -p"${DB_PASSWORD:-secret}" \
            --single-transaction --routines --triggers --events "$DB_NAME" \
        | gzip -9 > "$DB_FILE"; then
    rm -f "$DB_FILE"
    fail "el volcado de la base de datos falló"
fi

# Integridad del gzip: un .gz corrupto no sirve de copia.
gzip -t "$DB_FILE" || fail "el volcado está corrupto ($DB_FILE)"

# --- Medios privados --------------------------------------------------------
MEDIA_FILE="$DAY_DIR/media-$STAMP.tar.gz"

if [ -d "$MEDIA_DIR" ]; then
    log "Empaquetando los medios…"
    tar -czf "$MEDIA_FILE" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
    tar -tzf "$MEDIA_FILE" >/dev/null || { rm -f "$MEDIA_FILE"; fail "el paquete de medios está corrupto"; }
else
    log "Aviso: $MEDIA_DIR no existe; se omite el paquete de medios."
    MEDIA_FILE=""
fi

# --- Comprobaciones ---------------------------------------------------------
( cd "$DAY_DIR" && sha256sum "$(basename "$DB_FILE")" > "checksums-$STAMP.sha256" )
log "Backup completado: $(basename "$DB_FILE")$([ -n "$MEDIA_FILE" ] && echo " + $(basename "$MEDIA_FILE")")"

# --- Copia semanal (domingo) -----------------------------------------------
if [ "$(date +%u)" = "7" ]; then
    cp "$DB_FILE" "$WEEK_DIR/"
    [ -n "$MEDIA_FILE" ] && cp "$MEDIA_FILE" "$WEEK_DIR/"
    log "Copia semanal archivada."
fi

# --- Retención ---------------------------------------------------------------
find "$DAY_DIR" -type f -name 'db-*'      -mtime "+$KEEP_DAYS"  -delete
find "$DAY_DIR" -type f -name 'media-*'   -mtime "+$KEEP_DAYS"  -delete
find "$DAY_DIR" -type f -name 'checksums-*' -mtime "+$KEEP_DAYS" -delete
find "$WEEK_DIR" -type f -mtime "+$((KEEP_WEEKS * 7))" -delete
log "Retención aplicada (diarios: $KEEP_DAYS días, semanales: $KEEP_WEEKS semanas)."

# --- Copia offsite (opcional) ----------------------------------------------
if [ -n "${RESTIC_REPOSITORY:-}" ]; then
    log "Copia offsite con restic a $RESTIC_REPOSITORY…"
    restic backup "$DAY_DIR" --tag sonora --tag "$STAMP"
    restic forget --tag sonora --keep-daily "$KEEP_DAYS" --keep-weekly "$KEEP_WEEKS" --prune
    log "Copia offsite completada."
fi

# --- Verificación real (opcional) ------------------------------------------
if [ "$VERIFY" = "1" ]; then
    log "Verificando: restaurando en la base scratch…"
    SCRATCH="${SCRATCH_DB:-music_restore_check}"
    gunzip -c "$DB_FILE" > /tmp/sonora-restore.sql
    docker compose -f "$COMPOSE_FILE" exec -T mariadb sh -c \
        "mariadb -uroot -p'${DB_ROOT_PASSWORD:-root}' -e 'DROP DATABASE IF EXISTS ${SCRATCH}; CREATE DATABASE ${SCRATCH};' \
         && mariadb -uroot -p'${DB_ROOT_PASSWORD:-root}' ${SCRATCH} < /tmp/sonora-restore.sql \
         && mariadb -uroot -p'${DB_ROOT_PASSWORD:-root}' ${SCRATCH} -e 'SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema=\"${SCRATCH}\";' \
         && mariadb -uroot -p'${DB_ROOT_PASSWORD:-root}' -e 'DROP DATABASE ${SCRATCH};'"
    rm -f /tmp/sonora-restore.sql
    log "Verificación superada: la copia se restaura correctamente."
fi

log "Fin del backup."
