<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Disco de medios
    |--------------------------------------------------------------------------
    |
    | "media" es el disco privado donde viven los audios y carátulas. Nunca se
    | expone directamente: las URLs se firman y Nginx sirve el fichero con
    | X-Accel-Redirect (producción) o el controlador con soporte Range (local).
    |
    */

    'disk' => env('MEDIA_DISK', 'media'),

    /*
    |--------------------------------------------------------------------------
    | Servido con X-Accel-Redirect
    |--------------------------------------------------------------------------
    |
    | true  -> Laravel responde con la cabecera X-Accel-Redirect y Nginx envía
    |          los bytes (soporta Range sin ocupar workers de PHP).
    | false -> el controlador transmite el fichero (útil con `artisan serve`).
    |
    */

    'x_accel' => (bool) env('MEDIA_X_ACCEL', true),

    // Prefijo interno de Nginx para el alias de medios.
    'x_accel_prefix' => env('MEDIA_X_ACCEL_PREFIX', '/_media'),

    /*
    |--------------------------------------------------------------------------
    | URLs firmadas
    |--------------------------------------------------------------------------
    |
    | Minutos de validez de las URLs de streaming y portadas. El player pide
    | una URL nueva al renovar la pista; el Service Worker cachea por id de
    | canción, no por URL firmada.
    |
    */

    'url_ttl_minutes' => (int) env('MEDIA_URL_TTL', 360),

    /*
    |--------------------------------------------------------------------------
    | Subidas
    |--------------------------------------------------------------------------
    */

    'max_upload_mb' => (int) env('MEDIA_MAX_UPLOAD_MB', 256),

    // Formatos aceptados. La validación real se hace por MIME (finfo) y por
    // metadatos, no por extensión.
    'allowed_mimes' => [
        'audio/mpeg',
        'audio/mp3',
        'audio/flac',
        'audio/x-flac',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/opus',
        'audio/wav',
        'audio/x-wav',
    ],

    'allowed_extensions' => ['mp3', 'flac', 'm4a', 'mp4', 'aac', 'ogg', 'opus', 'wav'],

    /*
    |--------------------------------------------------------------------------
    | Carátulas
    |--------------------------------------------------------------------------
    */

    'cover' => [
        'max_source_kb' => (int) env('MEDIA_COVER_MAX_KB', 10240),
        'max_source_dimension' => (int) env('MEDIA_COVER_MAX_DIMENSION', 6000),
        'size' => 800,
        'quality' => 82,
    ],

    /*
    |--------------------------------------------------------------------------
    | Portadas de playlist
    |--------------------------------------------------------------------------
    |
    | Límites más estrictos que las carátulas: la portada se sube por el
    | usuario y se convierte en la propia petición HTTP, así que el pico de
    | memoria del proceso (imagen decodificada) debe quedar acotado. Con
    | pm.max_children = 5 workers, una imagen de 2500 px ocupa ~25 MB en
    | lugar de los ~144 MB que ocuparía una de 6000 px.
    |
    */

    'playlist_cover' => [
        'max_source_kb' => (int) env('MEDIA_PLAYLIST_COVER_MAX_KB', 8192),
        'max_source_dimension' => (int) env('MEDIA_PLAYLIST_COVER_MAX_DIMENSION', 2500),
        'size' => 800,
        'quality' => 82,
    ],

    /*
    |--------------------------------------------------------------------------
    | Binarios de metadatos
    |--------------------------------------------------------------------------
    */

    'ffprobe' => env('FFPROBE_BINARY', 'ffprobe'),
    'ffmpeg' => env('FFMPEG_BINARY', 'ffmpeg'),
    'ffprobe_timeout' => (int) env('FFPROBE_TIMEOUT', 30),

];
