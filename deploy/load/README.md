# Pruebas de carga — Sonora

Guion de k6 para medir el comportamiento de la API en producción y calibrar
los límites de PHP-FPM, MariaDB, Redis y nginx **antes** de que la carga real
los alcance.

## Requisitos

```bash
# Ubuntu Server
sudo apt-get install -y k6
```

## Ejecución

```bash
# Prueba de humo (30 s) contra el entorno local
BASE_URL=http://localhost:8080 VUS=5 DURATION=30s RATE=10 \
  k6 run deploy/load/api.js

# Prueba completa contra producción
BASE_URL=https://music.antoniogmportfolio.online VUS=20 DURATION=5m RATE=40 \
  THRESHOLD_P95=400 THRESHOLD_ERR=0.01 \
  k6 run deploy/load/api.js
```

Variables:

| Variable | Por defecto | Descripción |
|---|---|---|
| `BASE_URL` | `http://localhost:8080` | Origen de la API |
| `VUS` | `10` | Usuarios virtuales concurrentes |
| `DURATION` | `2m` | Duración de la meseta de carga |
| `RATE` | `20` | Peticiones/segundo del escenario de catálogo |
| `THRESHOLD_P95` | `400` | Límite de latencia p95 en ms |
| `THRESHOLD_ERR` | `0.01` | Límite de tasa de error |

## Qué mide

- **catalogo**: usuarios autenticados (login + sesión Sanctum) que leen
  `/songs`, `/artists`, `/albums`, `/playlists`, `/me/favorites`, `/history` y
  `/auth/me`. Es el perfil real de uso: la SPA carga estas vistas al navegar.
- **busqueda**: `GET /songs?search=…` con FULLTEXT. Es la consulta más cara
  del catálogo (búsqueda normalizada + `LIKE`/FULLTEXT sobre canciones).
- **checks**: si algún endpoint devuelve un estado distinto de 200, el test
  falla por umbral (`checks > 0.99`).

Cada VU crea su propio usuario (`load+<vu>@sonora.test`), así el rate limit de
autenticación (8/min por email) no falsea la medición.

## Qué mirar durante la prueba

```bash
# 1. Saturación de PHP-FPM (si max_children está al límite, la latencia sube)
docker compose -f docker-compose.prod.yml exec app sh -c \
  'ls /proc/*/fds 2>/dev/null | wc -l; grep -c . /proc/loadavg'

# 2. Conexiones de MariaDB (límite típico: max_connections=100)
docker compose -f docker-compose.prod.yml exec mariadb \
  mariadb -uroot -proot -e "SHOW STATUS LIKE 'Threads_connected'; SHOW STATUS LIKE 'Max_used_connections';"

# 3. Consultas lentas
docker compose -f docker-compose.prod.yml exec mariadb \
  mariadb -uroot -proot -e "SHOW VARIABLES LIKE 'long_query_time'; SHOW GLOBAL STATUS LIKE 'Slow_queries';"

# 4. Latencia real desde fuera (con TLS)
curl -s -o /dev/null -w '%{time_total}\n' https://music.antoniogmportfolio.online/api/v1/health
```

## Señales de cuello de botella (y qué hacer)

| Síntoma | Causa probable | Ajuste |
|---|---|---|
| p95 sube y `pm.max_children` está al máximo | PHP-FPM sin workers suficientes | Subir `PHP_FPM_MAX_CHILDREN` (con cuidado: cada worker ~128 MB) |
| Latencia alta y `Threads_connected` al máximo | MariaDB con pocas conexiones | Subir `max_connections` o el pool de PHP |
| Peticiones lentas con `Slow_queries` creciendo | Índice faltante o consulta sin caché | Revisar `EXPLAIN` y los índices de `songs` |
| Errores 502/504 | nginx no alcanza a PHP-FPM | Ajustar `fastcgi_read_timeout` y `pm.max_children` |
| Errores 429 | Rate limit global de API (120/min) | Subir el límite o el de nginx (`limit_req`) |

## Criterio de aceptación

La configuración de producción se considera válida si, con el objetivo de
carga acordado, se cumple todo:

- [ ] `checks > 0.99` y `api_errors < 1 %`.
- [ ] `api_duration p95 < 400 ms` con la carga nominal.
- [ ] Ningún 502/504 (nginx ↔ PHP-FPM bien dimensionados).
- [ ] `Max_used_connections` de MariaDB por debajo del 70 % de `max_connections`.
- [ ] `Slow_queries` no crece de forma sostenida durante la meseta.
- [ ] El audio se sirve con `X-Accel-Redirect` (no PHP): cero uso de workers
      para el streaming.
