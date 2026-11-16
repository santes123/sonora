<?php

namespace App\Http\Resources\Concerns;

use App\Services\Media\MediaStorage;

trait ProvidesMediaUrls
{
    /**
     * URL firmada de un medio.
     *
     * `$songId` se incluye en la URL cuando el medio pertenece a una canción:
     * es lo que permite al controlador de streaming comprobar, con una
     * consulta por clave primaria, que la canción no esté eliminada. Va
     * dentro de la firma, así que no se puede alterar sin invalidarla.
     */
    protected function mediaUrl(?string $path, ?int $songId = null): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        return app(MediaStorage::class)->temporaryUrl($path, songId: $songId);
    }
}
