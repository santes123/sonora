<?php

namespace App\Services\Media;

use Carbon\CarbonInterface;

/**
 * Abstracción de almacenamiento de medios (patrón Strategy).
 *
 * Toda la aplicación depende de esta interfaz, nunca de un disco concreto.
 * Cambiar a S3/MinIO consiste en registrar otra implementación; los
 * controladores, acciones y recursos no cambian.
 */
interface MediaStorage
{
    public function putFromPath(string $sourcePath, string $path): void;

    public function putContents(string $contents, string $path): void;

    public function get(string $path): string;

    public function exists(string $path): bool;

    public function delete(string $path): bool;

    public function size(string $path): int;

    /**
     * @return list<string>
     */
    public function allFiles(string $directory = ''): array;

    public function lastModified(string $path): int;

    /**
     * Ruta absoluta en disco local, o null si el driver no la expone (S3).
     */
    public function absolutePath(string $path): ?string;

    /**
     * Ruta interna para X-Accel-Redirect, o null si debe servirse por PHP.
     */
    public function xAccelPath(string $path): ?string;

    /**
     * URL firmada y temporal para leer el archivo.
     */
    public function temporaryUrl(string $path, ?CarbonInterface $expiresAt = null): string;
}
