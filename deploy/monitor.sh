#!/usr/bin/env bash
#
# Monitor de salud de Sonora (observabilidad sin dependencias externas).
#
# Comprueba, en este orden:
#   1. contenedores y su estado
#   2. salud de la aplicación (/api/v1/health)
#   3. espacio en disco y memoria
#   4. conexiones de MariaDB y consultas lentas
#   5. memoria de Redis
#   6. errores recientes en el log de la aplicación
#
# Salida: 0 si todo está bien, 1 si hay algún problema (para cron/alertas).
#
#   COMPOSE_FILE  compose de producción (por defecto ./docker-compose.prod.yml)
#   APP_URL       URL pública de la aplicación
#
set -uo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-$(dirname "$0")/../docker-compose.prod.yml}"
APP_URL="${APP_URL:-http://localhost:8080}"
ROOT_PASSWORD="${DB_ROOT_PASSWORD:-root}"

problems=0

ok()   { printf '  OK    %s\n' "$*"; }
warn() { printf '  AVISO %s\n' "$*"; }
fail() { printf '  FALLO %s\n' "$*"; problems=$((problems + 1)); }

echo "== Sonora: monitor de salud ($(date -Is)) =="

# --- 1. Contenedores ---------------------------------------------------------
echo "-- contenedores"
unhealthy="$(docker compose -f "$COMPOSE_FILE" ps --format '{{.Service}} {{.Status}}' \
    | awk '{print $1, $2}' \
    | grep -Ev '^(app|queue|scheduler|mariadb|redis|web) (Up|running)' \
    || true)"
if [ -n "$unhealthy" ]; then
    fail "servicios con estado inesperado: $unhealthy"
else
    ok "todos los servicios están arriba"
fi

# --- 2. Salud de la aplicación ----------------------------------------------
echo "-- aplicación"
health="$(curl -fsS --max-time 10 "$APP_URL/api/v1/health" 2>/dev/null || true)"
if echo "$health" | grep -q '"status":"ok"'; then
    ok "health: $health"
else
    fail "health no responde correctamente (${health:-sin respuesta})"
fi

# --- 3. Recursos del host ----------------------------------------------------
echo "-- recursos"
disk="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
if [ "${disk:-0}" -lt 85 ]; then
    ok "disco al ${disk} %"
else
    fail "disco al ${disk} % (límite 85 %)"
fi

mem_free="$(free -m | awk '/Mem:/ {print $7}')"
if [ "${mem_free:-0}" -gt 300 ]; then
    ok "memoria libre: ${mem_free} MB"
else
    warn "memoria libre: ${mem_free} MB"
fi

# --- 4. MariaDB --------------------------------------------------------------
echo "-- base de datos"
db_info="$(docker compose -f "$COMPOSE_FILE" exec -T mariadb \
    mariadb -uroot -p"$ROOT_PASSWORD" -N -B \
    -e "SHOW STATUS WHERE Variable_name IN ('Threads_connected','Max_used_connections','Slow_queries');" 2>/dev/null || true)"

if [ -n "$db_info" ]; then
    connected="$(echo "$db_info" | awk '$1=="Threads_connected"{print $2}')"
    max_used="$(echo "$db_info" | awk '$1=="Max_used_connections"{print $2}')"
    slow="$(echo "$db_info" | awk '$1=="Slow_queries"{print $2}')"
    ok "conexiones: ${connected:-?} (máx. histórico ${max_used:-?}), consultas lentas: ${slow:-?}"
else
    warn "no se pudo consultar el estado de MariaDB"
fi

# --- 5. Redis ----------------------------------------------------------------
echo "-- redis"
redis_info="$(docker compose -f "$COMPOSE_FILE" exec -T redis \
    redis-cli info memory 2>/dev/null | grep -E '^used_memory_human' || true)"
if [ -n "$redis_info" ]; then
    ok "${redis_info}"
else
    warn "no se pudo consultar la memoria de Redis"
fi

# --- 6. Errores recientes ----------------------------------------------------
echo "-- log de la aplicación"
errors="$(docker compose -f "$COMPOSE_FILE" exec -T app \
    sh -c "tail -n 300 storage/logs/*.log 2>/dev/null | grep -c 'production.ERROR' || true" 2>/dev/null | tr -d '\r')"
if [ "${errors:-0}" -gt 0 ]; then
    warn "${errors} errores en las últimas 300 líneas del log"
else
    ok "sin errores recientes"
fi

echo ""
if [ "$problems" -eq 0 ]; then
    echo "Estado: correcto"
    exit 0
fi

echo "Estado: ${problems} problema(s) detectado(s)"
exit 1
