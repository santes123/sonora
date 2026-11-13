<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;
use App\Services\Media\CoverArtService;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * Sustituye la portada de una playlist por una imagen subida por el usuario.
 *
 * La conversión a WebP ocurre en la propia petición (a diferencia de la
 * carátula del audio, que va a la cola): el pico de memoria está acotado por
 * los límites de `media.playlist_cover` y así el usuario ve su portada de
 * inmediato, sin esperar al worker.
 *
 * La portada antigua queda huérfana y la recoge `media:gc` a partir del día
 * siguiente, porque el almacenamiento es direccionado por contenido: dos
 * playlists con la misma imagen comparten fichero.
 */
class UpdatePlaylistCoverAction
{
    public function __construct(
        private readonly CoverArtService $covers,
    ) {}

    public function execute(Playlist $playlist, UploadedFile $file): void
    {
        $path = $this->covers->storeFromBinary($file->get(), [
            'max_source_kb' => (int) config('media.playlist_cover.max_source_kb', 8192),
            'max_source_dimension' => (int) config('media.playlist_cover.max_source_dimension', 2500),
            'size' => (int) config('media.playlist_cover.size', 800),
            'quality' => (int) config('media.playlist_cover.quality', 82),
        ]);

        if ($path === null) {
            throw ValidationException::withMessages([
                'file' => 'No hemos podido procesar la imagen. Usa un JPEG, PNG o WebP válido.',
            ]);
        }

        $playlist->forceFill(['cover_path' => $path])->save();
    }
}
