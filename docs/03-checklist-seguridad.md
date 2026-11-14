# 3. Checklist de seguridad — Sonora

Checklist operativo para la Fase 6 (Producción). Estado a 2026-11-14.

Leyenda: ✅ implementado y verificado · 🔧 implementado en el repositorio,
pendiente de aplicar en el servidor · ⬜ pendiente

> La columna 🔧 cubre todo lo que ya está en el código (imagen, compose,
> nginx, scripts) y solo necesita ejecutarse en `music.antoniogmportfolio.online`
> con los valores reales de `.env.production`.

---

## 1. Superficie de exposición

| Control | Estado | Cómo se verifica |
|---|---|---|
| Solo 80/443 publicados en el firewall | 🔧 | `sudo ufw status` en el servidor |
| MariaDB y Redis **no** publicados fuera de Docker | ✅ | `docker-compose.prod.yml` → `127.0.0.1:3307` y `127.0.0.1:6380` |
| PHP-FPM no accesible desde Internet | ✅ | `127.0.0.1:9000` (solo el nginx del host lo alcanza) |
| Contenedores de apoyo (mailpit, minio) fuera de producción | ✅ | `docker-compose.prod.yml` no los incluye |
| Contenedores con `restart: unless-stopped` | ✅ | `docker compose config` |
| Imágenes fijadas por tag (sin `latest`) | ✅ | `php:8.3-fpm-alpine`, `node:22-alpine`, `nginx:1.27-alpine`, `mariadb:11.4`, `redis:7-alpine` |

## 2. Transporte y TLS

| Control | Estado | Cómo se verifica |
|---|---|---|
| HTTPS obligatorio (redirección 80 → 443) | 🔧 | `curl -I http://music.antoniogmportfolio.online` → 301/308 |
| Certificado válido y renovable | 🔧 | `certbot certificates` / `ss -tlnp | grep 443` |
| HSTS | 🔧 | `curl -I https://…` → `strict-transport-seconds` |
| TLS 1.2+ | 🔧 | `sslscan` o `openssl s_client -tls1_1` |
| `SESSION_SECURE_COOKIE=true` y `SameSite=lax` | 🔧 | `.env` de producción + inspección de `Set-Cookie` |

## 3. Autenticación y sesión (Sanctum, SPA same-origin)

| Control | Estado | Cómo se verifica |
|---|---|---|
| Cookie de sesión `HttpOnly` | ✅ | `config/session.php` → `http_only=true` |
| Cookie de sesión `Secure` en producción | 🔧 | `SESSION_SECURE_COOKIE=true` en `.env` |
| Cookie con `SameSite=lax` | ✅ | `config/session.php` |
| `SANCTUM_STATEFUL_DOMAINS` limitado al dominio real | 🔧 | Solo `music.antoniogmportfolio.online` (+ `localhost` en local) |
| Login limitado a 8 intentos/min por email+IP | ✅ | `RateLimiter::for('auth')` |
| Sesión invalidada al cerrar sesión | ✅ | `AuthController::logout` |
| Sin tokens de API de larga duración | ✅ | Sanctum por cookie, sin endpoint de tokens personales |

## 4. Autorización

| Control | Estado | Cómo se verifica |
|---|---|---|
| Cada recurso privado comprueba el propietario | ✅ | Policies + `authorize()` en los controladores |
| Playlists/listados ajenos → 403/404 | ✅ | Tests de feature |
| Historial y favoritos son por usuario | ✅ | Consultas filtradas por `user_id` |

## 5. Entradas y subidas

| Control | Estado | Cómo se verifica |
|---|---|---|
| Validación con FormRequests y Rules | ✅ | `app/Http/Requests/**` |
| Lote offline limitado a 200 canciones | ✅ | `Offline\DownloadUrlsRequest::MAX_SONGS` |
| Tipos MIME reales verificados (ffprobe) | ✅ | `Media\UploadSongRequest` + `FfprobeMetadataExtractor` |
| Tamaño máximo de subida (256 MB) | ✅ | `MEDIA_MAX_UPLOAD_MB`, `client_max_body_size` |
| Portadas limitadas a 10 MB y 6000 px | ✅ | `MEDIA_COVER_MAX_KB`, `MEDIA_COVER_MAX_DIMENSION` |
| Extensión derivative: se conserva la MIME real | ✅ | Detección por contenido, no por nombre |
| Sin ejecución de ficheros en el directorio de medios | ✅ | Disco fuera de `public/`, servido por `X-Accel-Redirect` |

## 6. Cabeceras HTTP y CORS

| Control | Estado | Cómo se verifica |
|---|---|---|
| `X-Content-Type-Options: nosniff` | ✅ | Snippet `docker/nginx/snippets/security-headers.conf` |
| `X-Frame-Options: DENY` | ✅ | Ídem |
| `Referrer-Policy` y `Permissions-Policy` | ✅ | Ídem |
| CORS limitado al origen real | 🔧 | `FRONTEND_URL=https://music.antoniogmportfolio.online` |
| `supports_credentials=true` con orígenes explícitos | ✅ | `config/cors.php` |
| Cabeceras propias aplicadas también en sub-locations | ✅ | El snippet se incluye en cada `location` con `add_header` (nginx los descarta si no) |
| Peticiones no autenticadas devuelven 401 JSON (no 500) | ✅ | `redirectGuestsTo(null)` en `bootstrap/app.php` |
| Proxy confiable para IP real y esquema https | ✅ | `trustProxies` en `bootstrap/app.php` |

## 7. Medios privados

| Control | Estado | Cómo se verifica |
|---|---|---|
| Disco fuera del alcance público | ✅ | `storage/app/private` |
| URLs firmadas con caducidad (360 min) | ✅ | `config/media.php` → `MEDIA_URL_TTL` |
| Firma verificada (HMAC) y firma alterada rechazada | ✅ | `StreamMediaTest` |
| `X-Accel-Redirect` + `internal` en nginx | ✅ | `location ^~ /_media/ { internal; }` |
| Permisos de lectura para nginx sin escritura | ✅ | `php artisan media:permissions` |
| `X-Accel-Redirect` no usable para salir del directorio | ✅ | Prefijo fijo `/_media/` + `alias` |

## 8. Abuso y disponibilidad

| Control | Estado | Cómo se verifica |
|---|---|---|
| Límite global de API (120/min por usuario o IP) | ✅ | `RateLimiter::for('api')` |
| Límite de subidas (120/h) | ✅ | `RateLimiter::for('uploads')` |
| Límite de peticiones del servidor (nginx `limit_req`) | ⬜ | Configuración del host nginx |
| `pm.max_children` calibrado al servidor | 🔧 | `PHP_FPM_MAX_CHILDREN` por entorno (10 por defecto) |
| Timeouts en nginx y PHP-FPM (subidas) | 🔧 | `600s` + `request_terminate_timeout=660` |
| Cabeceras `X-Powered-By` y `Server` ocultadas | 🔧 | `expose_php=Off`; nginx `server_tokens off` (🔧 en host) |

## 9. Secretos

| Control | Estado | Cómo se verifica |
|---|---|---|
| `.env` de producción fuera del repositorio | ✅ | `.gitignore` |
| `APP_KEY` no vacío y no versionado | 🔧 | `grep APP_KEY .env` (solo en el servidor) |
| Credenciales de BD/Redis no son las de desarrollo | 🔧 | `.env` de producción |
| Secretos por variable de entorno, no en la imagen | 🔧 | `docker-compose.prod.yml` usa `env_file` |
| Permisos `600` en el `.env` | 🔧 | `ls -l .env` |

## 10. Datos y logs

| Control | Estado | Cómo se verifica |
|---|---|---|
| `APP_DEBUG=false` en producción | 🔧 | `.env` de producción |
| Excepciones en JSON solo para `api/*` | ✅ | `bootstrap/app.php` |
| `request_id` en cada respuesta | ✅ | Middleware `AssignRequestId` |
| Logs sin contraseñas ni tokens | ✅ | Revisión de `AuthController` |
| Rotación y límite de `storage/logs` | 🔧 | `logrotate` en el host |

## 11. Supply chain

| Control | Estado | Cómo se verifica |
|---|---|---|
| `composer install --no-dev --no-scripts` en la imagen | ✅ | `docker/Dockerfile`, stage `backend-deps` |
| Sin `--dev` ni herramientas de build en el runtime | ✅ | Stage `app` sobre `php-base` sin `$PHPIZE_DEPS` |
| `npm ci` con lockfile exacto | ✅ | Stage `frontend` |
| Dependencias auditadas | ⬜ | `composer audit` / `npm audit` en CI |
| Imagen sin `sudo`/shell innecesario | 🔧 | Usuario `www-data` para PHP-FPM |

## 12. Copias de seguridad

| Control | Estado | Cómo se verifica |
|---|---|---|
| Dump de BD con `--single-transaction` | 🔧 | Script de backup en `deploy/` |
| Copia de `storage/app/private/media` | 🔧 | Ídem |
| Retención (7 diarios / 4 semanales) | 🔧 | Ídem |
| Restauración probada de verdad | ✅ | Restaurado en base scratch (18 tablas, conteos verificados) |
| Copia cifrada fuera del servidor | 🔧 | Depende de la decisión de backups |

## 13. Verificación previa a publicar

```bash
# TLS y cabeceras
curl -sI https://music.antoniogmportfolio.online | grep -iE 'strict-transport|content-type-options|x-frame'

# Health de la aplicación
curl -s https://music.antoniogmportfolio.online/api/v1/health

# Servicio worker y precache (no debe cachearse)
curl -sI https://music.antoniogmportfolio.online/sw.js | grep -i cache-control

# Recursos con hash: cacheables e inmutables
curl -sI https://music.antoniogmportfolio.online/assets/<hash>.js | grep -i cache-control

# Puertos publicados (no debe haber 3306/6379/9000 abiertos al exterior)
sudo ss -tlnp | grep -E ':(3306|6379|9000)'
```

- [ ] Ningún puerto de base de datos, Redis o PHP-FPM accesible desde Internet.
- [ ] `.env` de producción con `APP_DEBUG=false`, `APP_KEY` real y credenciales propias.
- [ ] Copia de seguridad del día verificada con restauración en scratch.
- [ ] Test de carga ejecutado con los límites de `php-fpm` ya ajustados.
- [ ] Plan de rollback probado (imagen anterior + `docker compose up -d`).
