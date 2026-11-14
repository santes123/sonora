# Imagen multi-stage de producción para Sonora.
#
# No se declara `# syntax=docker/dockerfile:1.7`: todo lo que se usa aquí
# (multi-stage, COPY --from, ARG en FROM) está soportado por el frontend
# integrado de Docker 20.10+ y así el build no depende de descargar un
# frontend extra de Docker Hub.
#
# El contexto de build es la RAÍZ del repositorio (el frontend y el backend
# se compilan en la misma imagen):
#
#   docker build -f docker/Dockerfile --target app -t sonora-app:prod .
#   docker build -f docker/Dockerfile --target web -t sonora-web:prod .
#
# Stages:
#   php-base     -> PHP 8.3 FPM con las extensiones que necesita la app
#   backend-deps -> vendor de producción (composer install --no-dev)
#   frontend     -> SPA compilada con Vite
#   app          -> runtime PHP-FPM de la API (stage por defecto)
#   web          -> nginx sirviendo la SPA compilada
#
# Nada de esto sustituye al entorno de desarrollo (docker-compose.yml): aquí
# no hay bind mounts, no hay código en caliente y no se instalan dev deps.

ARG PHP_VERSION=8.3
ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27

# ---------------------------------------------------------------------------
# 1. Extensiones de PHP (stage base compartido por app y backend-deps)
# ---------------------------------------------------------------------------
FROM php:${PHP_VERSION}-fpm-alpine AS php-base

# Dependencias de sistema: ffmpeg para metadatos/portadas, librerías de imagen.
# curl se usa en los healthchecks de Docker.
RUN apk add --no-cache \
        ffmpeg \
        icu-libs \
        libzip \
        libpng \
        libjpeg-turbo \
        freetype \
        libwebp \
        oniguruma \
        tzdata \
        curl

# Herramientas de compilación. OJO: `docker-php-ext-install` purga el grupo
# .phpize-deps (autoconf, gcc, make...) cuando termina, así que la extensión
# PECL se compila ANTES, en su propio paso.
RUN apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        icu-dev \
        libzip-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        libwebp-dev \
        oniguruma-dev

# Extensión PECL: aquí siguen presentes las herramientas de compilación.
RUN pecl install redis \
    && docker-php-ext-enable redis

# Extensiones de PHP. Este script borra las herramientas de compilación al
# finalizar, por eso va después de `pecl install redis`.
RUN docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        intl \
        opcache \
        pcntl \
        pdo_mysql \
        zip

# Limpieza de las herramientas de compilación (la imagen final no las lleva).
RUN apk del --no-network .build-deps || true

# ---------------------------------------------------------------------------
# 2. Dependencias de Composer (sin dev)
# ---------------------------------------------------------------------------
FROM php-base AS backend-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Solo composer.json/lock: la capa se invalida al cambiar las dependencias,
# no al tocar el código de la aplicación.
COPY backend/composer.json backend/composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-progress \
        --no-interaction

# ---------------------------------------------------------------------------
# 3. Frontend compilado
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS frontend

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

# El build ejecuta tsc (app) + tsc (service worker) + vite build.
RUN npm run build

# ---------------------------------------------------------------------------
# 4. Runtime de la aplicación (PHP-FPM)
# ---------------------------------------------------------------------------
FROM php-base AS app

WORKDIR /var/www/html

COPY --from=backend-deps /var/www/html/vendor ./vendor
COPY backend/ ./

# Composer se necesita para generar el autoload optimizado sin dev deps.
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/app.ini
COPY docker/php/php-prod.ini /usr/local/etc/php/conf.d/zz-prod.ini
# Sustituye al pool www.conf por defecto de la imagen oficial (un único pool).
COPY docker/php/php-fpm-prod.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/php/entrypoint.prod.sh /usr/local/bin/app-entrypoint

# Autoload optimizado (sin dev) y descubrimiento de paquetes.
# Sin `|| true`: si el descubrimiento falla, la imagen no debe construirse
# (un packages.php con providers de dev, como Pail, rompe el arranque).
RUN composer dump-autoload --optimize --no-dev --no-scripts
RUN php artisan package:discover --ansi

# Estructura mínima de almacenamiento y permisos para www-data.
RUN chmod +x /usr/local/bin/app-entrypoint \
    && mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        storage/app/private/media \
        bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 9000

ENTRYPOINT ["app-entrypoint"]
CMD ["php-fpm"]

# ---------------------------------------------------------------------------
# 5. Web (nginx sirviendo la SPA compilada)
# ---------------------------------------------------------------------------
FROM nginx:${NGINX_VERSION}-alpine AS web

COPY --from=frontend /app/dist /usr/share/nginx/html
# Plantilla: el entrypoint de la imagen nginx sustituye ${SONORA_APP_HOST} y
# ${SONORA_APP_PORT} por el entorno del contenedor.
COPY docker/nginx/prod-web.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/snippets/ /etc/nginx/snippets/

EXPOSE 80
