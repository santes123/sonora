# Análisis del planning y arquitectura propuesta

> Proyecto: web/PWA de reproducción y gestión musical tipo Spotify.
> Despliegue objetivo: Ubuntu Server propio (PHP 8.3.6, Docker, PM2 disponibles).
> Estado: Fase 1 y Fase 2 en ejecución.

---

## 1. Veredicto del planning

El planning es sólido en el reparto de fases y en la elección de stack. Estas son las
correcciones que aplicamos antes de escribir código:

| Punto del planning | Veredicto | Decisión |
|---|---|---|
| MinIO vs disco local | Correcto, pero "solo cambian 3 líneas en `.env`" es optimista | Disco local privado ya, con una interfaz `MediaStorage`. Las URLs firmadas se generan en el adaptador, así que migrar a S3/MinIO no toca controladores ni frontend. |
| MariaDB | Correcto | MariaDB 11.4 en Docker. `FULLTEXT` con columnas normalizadas (sin acentos) y fallback por prefijo. |
| `file_hash` único en `songs` | Se queda corto | La deduplicación se hace en `media_assets` (el archivo), separada de `songs` (los metadatos). Evita carreras y permite reutilizar el archivo si mañana hay variantes o transcodificaciones. |
| Servir audio desde `storage/app/public` | Riesgo de hotlinking y fuga de catálogo | Disco privado + rutas firmadas + `X-Accel-Redirect` en Nginx. PHP nunca bombea los bytes en producción. |
| Sanctum "stateful o JWT" | Correcto, pero hay que elegir | Cookie de sesión Sanctum (mismo origen). Las peticiones del Service Worker heredan la sesión. Token personal queda disponible para futuros clientes nativos. |
| Subida de archivos en un solo POST | Funciona para MVP; es el mayor cuello de botella móvil | MVP con POST multipart y límites claros. La interfaz de subida se aísla para poder añadir subida reanudable (tus) sin reescribir la UI. |
| Carátulas a WebP en la petición de subida | Bloquea el request y dispara la CPU | Extracción y conversión en cola (Redis). La canción aparece al instante con placeholder. |
| Buscador "con índices de texto en MariaDB" | Correcto para catálogo mediano | `FULLTEXT` en `(title_normalized, artist_name_normalized, album_title_normalized)`, consulta en `BOOLEAN MODE` con prefijo y normalización de acentos. |
| PWA offline con Cache Storage | Correcto, con salvedades de iOS | Cache por canción con clave canónica (no por URL firmada), IndexedDB para metadatos, LRU por cuota y `navigator.storage.persist()` cuando exista. |
| Reordenar playlist | Sin detalle | `position` entero + actualización transaccional del rango afectado. Suficiente para cientos de canciones. |
| HTTPS local con certificado autofirmado | Correcto para Media Session/PWA | En producción Let's Encrypt (o DNS-01). Para pruebas en móvil, mkcert o certificado propio instalado en el dispositivo. |

### Ajustes al roadmap

1. **Fase 0 (nueva): fundaciones.** ADRs, convenciones, Docker Compose, CI, base de tests.
2. **Fase 2 dividida:** 2A identidad + catálogo + subida; 2B búsqueda, playlists y operación.
3. **Fase 6 ampliada:** hardening, backups, observabilidad y *smoke tests*, no solo "compilar y montar Nginx".
4. **Fase 5 condicionada:** el motor offline se construye cuando el catálogo y el player estén estables. Cachear una API inestable multiplica la deuda.

---

## 2. Arquitectura

**Monolito modular** (no microservicios): un solo despliegue Laravel con fronteras internas claras.
Es la opción con mejor relación coste/complejidad para un servidor propio y permite extraer
servicios (búsqueda, medios) más adelante sin reescribir el dominio.

```
┌────────────────────────────────────────────────────────────────┐
│ Nginx (TLS, estáticos, X-Accel-Redirect)                       │
│  ├── /                → React build (SPA + PWA)                │
│  ├── /api/*           → PHP-FPM (Laravel)                      │
│  └── /_media/*        → internal: storage/app/private/media    │
└───────────────┬───────────────────────────┬────────────────────┘
                │                           │
        ┌───────▼────────┐          ┌───────▼────────┐
        │ Laravel API    │          │ Redis          │
        │ (modular)      │          │ cache/queue/   │
        │                │          │ sesiones       │
        └───┬────────┬───┘          └────────────────┘
            │        │
   ┌────────▼──┐  ┌──▼─────────┐
   │ MariaDB   │  │ Disco      │  (MinIO/S3 opcional vía MediaStorage)
   │ 11.4      │  │ privado    │
   └───────────┘  └────────────┘
```

### Capas del backend

```
app/
├── Models/                     Eloquent + relaciones + scopes
├── Enums/                      Role, RepeatMode... (casts tipados)
├── Data/                       DTOs de entrada/salida (spatie/laravel-data)
├── Actions/                    Casos de uso: una clase = una operación
│   ├── Auth/
│   ├── Songs/                  UploadSongAction, DeleteSongAction
│   └── Playlists/              CreatePlaylistAction, ReorderPlaylistAction...
├── Services/
│   └── Media/
│       ├── MediaStorage.php            Interfaz (Strategy)
│       ├── LocalMediaStorage.php       Disco privado + URL firmada + X-Accel
│       ├── S3MediaStorage.php          (previsto)
│       ├── MetadataExtractor.php       Interfaz
│       ├── FfprobeMetadataExtractor.php
│       ├── NullMetadataExtractor.php
│       └── CoverArtService.php         Imagen → WebP acotado
├── Http/
│   ├── Controllers/Api/V1/
│   ├── Requests/
│   ├── Resources/
│   └── Middleware/
├── Policies/                   Autorización por recurso
├── Events/ + Listeners/        Efectos secundarios desacoplados
├── Jobs/                       Trabajo pesado en cola
└── Console/Commands/           GC de medios, reindexado, salud
```

Reglas:

- **Controllers finos**: validan (FormRequest), autorizan (Policy) y delegan en una Action.
- **Actions** transaccionales y testeables; no conocen HTTP.
- **Sin repositorios genéricos**: Eloquent ya es la abstracción. Solo se crea una interfaz
  cuando hay una razón real (p. ej. almacenamiento).
- **Eventos** para efectos no críticos (carátula, métricas, cache). Nunca para lo que debe
  ser consistente dentro del mismo commit.
- **DTOs** en la frontera HTTP → dominio para no arrastrar `Request` ni arrays sueltos.

### Frontend

```
src/
├── app/            providers, router, layout
├── features/
│   ├── auth/
│   ├── catalog/    búsqueda, álbumes, artistas
│   ├── playlists/
│   ├── player/     store Zustand + motor de audio singleton
│   └── offline/    (Fase 5) Dexie + Cache API
├── components/ui/  primitivas accesibles
├── lib/            api client, queryClient, utilidades
└── styles/
```

- **TanStack Query** para estado del servidor (cache, reintentos, invalidación).
- **Zustand** para estado del reproductor (cola, pista, repetición, aleatorio).
- **Un único `<audio>`** fuera del árbol de React (`audioEngine.ts`) para evitar re-renders
  y fugas de `Blob`/`URL.createObjectURL`.
- **Media Session API** centralizada en el motor de audio.
- **Tipos compartidos** generados/alineados con los API Resources (contrato documentado).

---

## 3. Modelo de datos

```
users ──< playlists ──< playlist_items >── songs
  │                                          │
  │                                          ├── media_assets (hash único)
  │                                          ├── artists
  │                                          └── albums ── artists
  └── (uploader)
```

| Tabla | Campos clave | Notas |
|---|---|---|
| `users` | `email` único, `google_id` único nullable, `role`, `password` nullable | Password nullable para cuentas solo-Google |
| `media_assets` | `hash` char(64) **único**, `disk`, `path`, `size_bytes`, `duration_ms`, `format`, `mime_type` | Unidad de deduplicación. El archivo se guarda como `tracks/ab/cd/<hash>.<ext>` |
| `artists` | `name`, `name_normalized` único | `firstOrCreate` con captura de carrera |
| `albums` | `artist_id`, `title`, `title_normalized`, único `(artist_id, title_normalized)` | Carátula propia |
| `songs` | `media_asset_id` único, `uploader_id`, `artist_id`, `album_id`, `title`, `duration_ms`, nombres desnormalizados | FULLTEXT en columnas normalizadas |
| `playlists` | `user_id`, `is_public`, `songs_count`, `duration_ms` | Contadores desnormalizados (no `COUNT(*)` por request) |
| `playlist_items` | `playlist_id`, `song_id`, `position`, único `(playlist_id, song_id)` | Sin duplicados en MVP |

### Por qué `media_assets` separado de `songs`

1. La deduplicación ocurre **antes** de tener metadatos: dos ficheros idénticos con tags
   distintos comparten un solo binario.
2. La restricción única sobre `hash` resuelve la carrera de dos subidas simultáneas sin
   bloquear la tabla `songs`.
3. Deja la puerta abierta a variantes (original + Opus) y a MinIO sin rehacer el modelo.

### Normalización y búsqueda

- `Str::ascii(Str::lower(...))` + colapso de espacios → `*_normalized`.
- Se guarda también `artist_name_normalized` y `album_title_normalized` en `songs` para que
  el `FULLTEXT` no dependa de `JOIN`s.
- Consulta: `MATCH(...) AGAINST ('+termino*' IN BOOLEAN MODE)` con operadores escapados.
- Consultas de 1–2 caracteres: `LIKE 'prefijo%'` (aprovecha índice), nunca `%texto%`.
- `innodb_ft_min_token_size=3` explícito en Docker para que el comportamiento sea el mismo
  en desarrollo y producción.

---

## 4. Decisiones de arquitectura (ADR resumidas)

| ID | Decisión | Motivo | Consecuencia |
|---|---|---|---|
| ADR-001 | Monolito modular Laravel | Menor coste operativo; fronteras internas | Se puede extraer búsqueda/medios después |
| ADR-002 | Docker Compose como entorno canónico | PHP 8.3 idéntico a producción, ffmpeg y Redis incluidos | Windows usa Docker para backend; Node nativo |
| ADR-003 | Disco privado + URLs firmadas + X-Accel | Seguridad, Range nativo, cero bytes por PHP | Requiere `/_media/` en Nginx y permisos 0755/0644 en el disco de medios |
| ADR-004 | `MediaStorage` como Strategy | Migrar a MinIO/S3 sin tocar dominio | S3 necesita presigned URLs (ya previsto) |
| ADR-005 | Dedup en `media_assets.hash` | Evita carreras y ahorra disco | Una canción por asset en MVP |
| ADR-006 | Sanctum cookie SPA | PWA same-origin, Service Worker hereda sesión | HTTPS y CSRF obligatorios; CORS acotado |
| ADR-007 | MariaDB 11.4 | Conocimiento del equipo, FULLTEXT suficiente | Sin extensiones geoespaciales |
| ADR-008 | Carátulas en cola | No bloquear subida ni disparar CPU | UI con placeholder y refresco |
| ADR-009 | `position` entero | Simple y suficiente | Reordenar es O(n) acotado; futuro fractional index |
| ADR-010 | Un solo `<audio>` + Media Session | Estabilidad y controles del sistema | El player no vive en el árbol React |

---

## 5. Cuellos de botella identificados y mitigación

> Objetivo: que ninguno aparezca por sorpresa en preproducción.

| # | Riesgo | Dónde duele | Mitigación en este desarrollo |
|---|---|---|---|
| 1 | Servir audio con PHP-FPM | Cada descarga ocupa un worker; 20 oyentes pueden agotar el pool | `X-Accel-Redirect` en producción; `BinaryFileResponse` (Range) solo en local |
| 2 | Límites de subida | `upload_max_filesize=2M` y `client_max_body_size=1M` por defecto → 413 opacos | `php.ini` y Nginx a 256 MB; validación con mensaje 422 claro |
| 3 | Hash + ffprobe en el request | Subidas de FLAC grandes tardan y consumen CPU | Hash en streaming (`hash_file`), ffprobe con timeout 20 s; carátula en cola |
| 4 | Carrera de deduplicación | Dos usuarios suben el mismo archivo a la vez | Índice único + captura de `UniqueConstraintViolationException` + relectura |
| 5 | Duplicado con tags distintos | Mismo audio, distinto bitrate/tags | Se documenta la limitación; futuro `chromaprint`/fingerprint |
| 6 | FULLTEXT y acentos | "cancion" no encuentra "Canción" | Columnas normalizadas sin acentos + normalización de la query |
| 7 | N+1 en listados | 50 canciones → 150 queries | `with(['artist','album'])`, `preventLazyLoading()` en local, tests |
| 8 | Reordenar playlist | Enviar 1000 posiciones actualiza 1000 filas | Transacción única + `upsert`; límite de 1000 items; futuro `sort_key` |
| 9 | Contadores de playlist | `withCount` + `sum` en cada listado | `songs_count` y `duration_ms` desnormalizados y recalculados al mutar |
| 10 | Redis como dependencia dura | Si cae, sesiones/colas/caché fallan | Healthcheck, reintentos de cola, plan de fallback documentado |
| 11 | Carátulas maliciosas | Decompression bombs / memoria | Límite de bytes y dimensiones, re-encode a WebP, cola con timeout |
| 12 | Disco sin control | Catálogo crece sin límite | Dedup global, cuota configurable, comando GC de huérfanos |
| 13 | Borrado con referencias | Canciones en playlists de otros | `playlist_items` con `ON DELETE CASCADE`; medio se borra solo si queda huérfano |
| 14 | Bind mounts en Windows | Artisan lento con `vendor` en NTFS | `vendor` en volumen Docker nombrado; frontend con Node nativo |
| 15 | Cuota iOS/PWA | El navegador purga la caché | Descarga por playlist, LRU, aviso de espacio, `persist()` si está disponible |
| 16 | Fugas de Blob URLs | Memoria crece al cambiar de pista | Un solo elemento `<audio>`, `revokeObjectURL` al liberar |
| 17 | Service Worker y auth | Cachear respuestas privadas o CSRF | `NetworkOnly` para `/api` salvo endpoints offline explícitos; nunca cachear `Set-Cookie` |
| 18 | CSRF en SPA | 419 intermitentes | `GET /sanctum/csrf-cookie`, `withCredentials`, `SameSite=Lax`, dominio correcto |
| 19 | `pm.max_children` | Subidas lentas + streaming agotan PHP-FPM | Streaming fuera de PHP; dimensionar workers; futuro tus para subidas |
| 20 | Backups inconsistentes | DB y medios desincronizados | `mysqldump` + snapshot de medios en la misma ventana; restauración probada |
| 21 | Búsqueda con offset alto | `LIMIT 100000, 20` se degrada | Catálogo mediano OK; cursor pagination cuando supere ~100k |
| 22 | Migración a MinIO | URLs, CORS y Range distintos | Interfaz ya preparada; bucket privado + presigned URLs; probar CORS del player |
| 23 | Índices ausentes | Listados y FKs lentos | Índices en FKs, `(playlist_id, position)`, `(is_public, updated_at)`, `created_at` |
| 24 | Logs sin contexto | Difícil correlacionar errores | `request_id` en middleware + logs estructurados; Telescope en local |

---

## 6. Roadmap revisado (entregables)

### Fase 0 — Fundaciones ✅
- [x] Decisiones de arquitectura y modelo de datos.
- [x] Docker Compose (Nginx, PHP-FPM 8.3, MariaDB 11.4, Redis, worker, scheduler, Mailpit).
- [x] Convenciones y `.env.example`.

### Fase 1 — Entorno y repositorio ✅
- [x] Monorepo `backend/` + `frontend/` + `docker/` + `docs/`.
- [x] Stack reproducible con `docker compose up`.
- [ ] CI (lint + tests + build) — siguiente iteración.

### Fase 2A — Identidad y catálogo
- [x] Migraciones y modelos (`users`, `artists`, `albums`, `media_assets`, `songs`).
- [x] Registro/login/logout con Sanctum (cookie SPA) y `google_id` preparado.
- [x] Subida con dedup SHA-256, metadatos vía ffprobe y almacenamiento privado.
- [x] Streaming con Range y URLs firmadas.
- [x] Carátula WebP en cola.
- [x] Tests de dedup, auth, streaming y búsqueda.

### Fase 2B — Biblioteca
- [x] Playlists CRUD + añadir/quitar/reordenar.
- [x] Búsqueda con FULLTEXT normalizado.
- [x] Salud, rate limiting y comando de GC.

### Fase 3 — Frontend base
- [x] Vite + React + TS + Tailwind + PWA instalable.
- [x] Layout responsive, auth, catálogo, subida y player global.
- [x] Media Session API, shuffle Fisher-Yates y repetición.
- [ ] Diseño visual definitivo y accesibilidad AA — iteración.

### Fase 4 — Social y detalle
- [x] Vistas enriquecidas de Álbum y Artista con discografía, metadatos y reproducción dedicada.
- [x] Reordenación de playlist con drag & drop y flechas.
- [x] Favoritos / likes ("Tus me gusta").
  - Tabla `song_likes` con restricción única `(user_id, song_id)` e índice `(user_id, created_at)`.
  - `POST|DELETE /api/v1/songs/{song}/like` idempotentes y `GET /api/v1/me/favorites` paginado.
  - `is_liked` en `SongResource`; filtro `liked=1` / `favorites=1` en `GET /api/v1/songs`.
  - Corazón interactivo en filas y reproductor; pestaña "Canciones que te gustan" en la Biblioteca.
- [x] Historial de reproducción.
  - Tabla `listening_history` con única `(user_id, song_id)` e índice `(user_id, played_at)` para el carrusel sin filesort.
  - Registro asíncrono en cola (`RecordListeningJob`, upsert atómico `ON DUPLICATE KEY UPDATE`) desde el evento `playing` del `<audio>`; `POST /api/v1/history` responde `202`.
  - `GET /api/v1/history` (última escucha + nº de reproducciones) y `DELETE /api/v1/history` para vaciarlo.
  - Carrusel "Escuchado recientemente" en la Inicio con confirmación en línea antes de vaciar.
- [ ] Perfiles y portadas personalizadas de playlist.
  - [x] Portada de playlist: subida de imagen → WebP en línea (`POST /api/v1/playlists/{playlist}/cover`), con límites de memoria (8 MB / 2500 px).
  - [x] Portada por defecto generada (color + inicial deterministas a partir del nombre, hash djb2).
  - [ ] Perfiles de usuario.

### Fase 5 — Offline
- [x] Descarga de canciones (y atajo de playlist completa) a Cache Storage + IndexedDB (Dexie).
  - Endpoint `POST /api/v1/offline/urls` (`auth:sanctum`): devuelve **URLs firmadas en lote**
    (máx. 200 canciones) con `{song_id, url, bytes}`; una sola consulta con
    `with('mediaAsset:id,path,size_bytes')`, respetando el orden pedido y omitiendo lo que no
    tiene fichero. Evita el N+1 de red de pedir una firma por canción.
  - Service worker propio (`src/sw.ts`, `injectManifest`, **sin dependencias**): precache
    manual del shell desde `self.__WB_MANIFEST`, limpieza de cachés `sonora-*` antiguas en
    `activate`, `clients.claim()`, y caché de audio en `sonora-audio-v1` **con soporte Range
    (206)** para `/api/v1/media/*`. La API nunca se cachea.
  - Puente por mensajes (`PING`, `CACHE_AUDIO`, `DELETE_AUDIO`, `CLEAR_AUDIO`, `LIST_AUDIO`)
    con `MessageChannel` y timeout de 120 s; el audio vive en Cache Storage y los metadatos
    en Dexie (`sonora-offline`, tabla `downloads` con `songId`, `cachedAt`, `lastAccessedAt`,
    `*playlistIds`).
  - Clave de caché = **pathname sin query** (`/api/v1/media/<token>`), no la URL firmada: el
    token es el base64 de la ruta interna (estable y único por fichero), así la descarga
    sobrevive a la caducidad de la firma (TTL 360 min) y el SW sirve sin revalidarla.
  - Descarga por canción con atajo de playlist; concurrencia 2 (`runPool`), progreso en vivo.
- [x] LRU, cuota, `persist()`, indicadores y reproducción offline real.
  - Presupuesto: `min(1 GB, 50 % × (quota − uso ajeno))`. El uso propio **no** descuenta el
    presupuesto (evita el paradoxical shrink que shrinkearía el límite con cada descarga).
  - `navigator.storage.persist()` se pide en la **primera descarga**, con aviso previo
    ("Conservar tus descargas") y salida "Ahora no".
  - LRU por `lastAccessedAt`: el reproductor marca el uso al reproducir; la expulsión libera
    espacio antes de descargar (`makeRoom` + `selectEvictions`).
  - Página `/downloads`: resumen de cuota, estado de persistencia, reproducción, borrado
    individual y "Liberar espacio" con `InlineConfirm`.
  - Indicadores: badge "Sin conexión" en la cabecera, enlace "Descargas" en sidebar y móvil,
    aviso por toast al intentar reproducir sin conexión una canción no descargada.
  - **Auth tolerante a falta de red**: copia local del usuario en `localStorage`
    (`sonora:user`); si `api.me()` falla por red (no 401) se usa la copia y se marca
    `offline: true`. Solo un 401 explícito o un logout cierran la sesión.
  - Verificado e2e: backend Docker apagado → `/downloads` sigue accesible y la canción
    descargada se sirve desde la caché del SW con **206 Partial Content** (`audio/mpeg`).
  - Tests: 70 en 11 ficheros de frontend (quota, LRU, pool, canción, `DownloadButton`,
    `PlayerContext`), 100 de backend (9 nuevos del endpoint offline), Pint PASS.

### Fase 6 — Producción
- [ ] Imagen multi-stage, `docker-compose.prod.yml`, TLS, cron, backups, restauración.
- [ ] Observabilidad, límites, pruebas de carga y checklist de seguridad.

---

## 7. Operación

- **Backups:** `mysqldump --single-transaction` + `restic`/`rsync` de `storage/app/private/media`.
  Probar restauración mensualmente.
- **Permisos de medios:** Nginx corre con otro usuario que PHP-FPM y sirve los ficheros
  con `X-Accel-Redirect`, así que necesita atravesar los directorios y leerlos. El disco
  `media` escribe con 0755/0644 (`config/filesystems.php`); tras restaurar un backup o
  migrar de servidor, ejecutar `php artisan media:permissions` (idempotente, admite
  `--dry-run`). Sin esto, Nginx responde 403 en las URLs firmadas.
- **Cron:** `schedule:work` en el contenedor scheduler; comandos de GC y limpieza de temporales.
- **Observabilidad:** endpoint `/api/v1/health` (DB + Redis), logs con `request_id`,
  Telescope en local, slow query log de MariaDB (`long_query_time=0.5`).
- **Seguridad:** HTTPS obligatorio, cookies `Secure`+`HttpOnly`, CORS acotado, rate limiting,
  validación MIME real, bucket/disco privado, `nosniff`, sin ejecución en el directorio de medios.
