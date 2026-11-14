<?php

namespace App\Actions\Songs;

use App\Models\Song;
use App\Services\Media\CoverArtService;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * Sustituye la carátula de una canción por una imagen subida por el usuario.
 *
 * La conversión a WebP ocurre en la propia petición (igual que la portada de
 * una playlist): el pico de memoria está acotado por `media.playlist_cover` y
 * el usuario ve el cambio de inmediato, sin esperar al worker.
 *
 * La carátula anterior queda huérfana y la recoge `media:gc` al día
 * siguiente: el almacenamiento es direccionado por contenido, así que dos
 * canciones con la misma imagen comparten fichero.
 */
class UpdateSongCoverAction
{
    public function __construct(
        private readonly CoverArtService $covers,
    ) {}

    public function execute(Song $song, UploadedFile $file): void
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

        $song->forceFill(['cover_path' => $path])->save();
    }
}
