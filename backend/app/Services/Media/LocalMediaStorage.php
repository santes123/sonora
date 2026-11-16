<?php

namespace App\Services\Media;

use Carbon\CarbonInterface;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\URL;
use RuntimeException;

/**
 * Implementación sobre un disco local privado.
 *
 * - Los archivos viven fuera de public/.
 * - Las URLs son rutas firmadas (HMAC) con caducidad.
 * - En producción Nginx sirve el binario con X-Accel-Redirect.
 */
final class LocalMediaStorage implements MediaStorage
{
    public function __construct(private readonly Filesystem $disk) {}

    public function putFromPath(string $sourcePath, string $path): void
    {
        if ($this->exists($path)) {
            return;
        }

        $stream = fopen($sourcePath, 'rb');

        if ($stream === false) {
            throw new RuntimeException("No se pudo abrir el archivo origen: {$sourcePath}");
        }

        try {
            // Visibilidad explícita: fija 0644 según config/filesystems.php sin
            // depender del umask del proceso (php-fpm y CLI pueden diferir).
            if (! $this->disk->writeStream($path, $stream, ['visibility' => Filesystem::VISIBILITY_PRIVATE])) {
                throw new RuntimeException("No se pudo escribir el medio: {$path}");
            }
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    public function putContents(string $contents, string $path): void
    {
        if (! $this->disk->put($path, $contents, ['visibility' => Filesystem::VISIBILITY_PRIVATE])) {
            throw new RuntimeException("No se pudo escribir el medio: {$path}");
        }
    }

    public function get(string $path): string
    {
        $contents = $this->disk->get($path);

        if ($contents === null) {
            throw new RuntimeException("Medio no encontrado: {$path}");
        }

        return $contents;
    }

    public function exists(string $path): bool
    {
        return $this->disk->exists($path);
    }

    public function delete(string $path): bool
    {
        return $this->disk->delete($path);
    }

    public function size(string $path): int
    {
        return $this->disk->size($path);
    }

    /** @return list<string> */
    public function allFiles(string $directory = ''): array
    {
        return array_values($this->disk->allFiles($directory));
    }

    public function lastModified(string $path): int
    {
        return $this->disk->lastModified($path);
    }

    public function absolutePath(string $path): ?string
    {
        return method_exists($this->disk, 'path') ? $this->disk->path($path) : null;
    }

    public function xAccelPath(string $path): ?string
    {
        if (! config('media.x_accel')) {
            return null;
        }

        $prefix = rtrim((string) config('media.x_accel_prefix', '/_media'), '/');

        return $prefix.'/'.ltrim($path, '/');
    }

    public function temporaryUrl(string $path, ?CarbonInterface $expiresAt = null, ?int $songId = null): string
    {
        $expiresAt ??= now()->addMinutes((int) config('media.url_ttl_minutes', 360));

        $token = rtrim(strtr(base64_encode($path), '+/', '-_'), '=');

        $parameters = ['token' => $token];

        // La canción viaja dentro de la URL firmada: al eliminarla, el
        // servidor puede rechazar las URLs ya emitidas sin tener que
        // consultar el medio (que no lleva índice por ruta).
        if ($songId !== null) {
            $parameters['song'] = $songId;
        }

        return URL::temporarySignedRoute(
            'media.stream',
            $expiresAt,
            $parameters,
            absolute: false,
        );
    }
}
