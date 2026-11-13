# PHP-FPM 8.3 + ffmpeg + GD/WebP + Redis
FROM php:8.3-fpm-alpine

# Dependencias de sistema: ffmpeg para metadatos/portadas, librerías de imagen.
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
    && apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        icu-dev \
        libzip-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        libwebp-dev \
        oniguruma-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        intl \
        opcache \
        pcntl \
        pdo_mysql \
        zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/app.ini
COPY docker/php/entrypoint.sh /usr/local/bin/app-entrypoint

WORKDIR /var/www/html

# Cache de dependencias: solo se invalida si cambian composer.json/lock.
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-scripts --no-autoloader --no-progress

COPY backend/ ./
RUN composer dump-autoload --optimize --no-scripts \
    && php artisan package:discover --ansi || true

RUN chmod +x /usr/local/bin/app-entrypoint \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
              storage/logs storage/app/private/media \
    && chown -R www-data:www-data storage bootstrap/cache

ENTRYPOINT ["app-entrypoint"]
CMD ["php-fpm"]
