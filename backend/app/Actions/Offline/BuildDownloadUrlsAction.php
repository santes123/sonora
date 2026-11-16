<?php

namespace App\Actions\Offline;

use App\Models\Song;
use App\Services\Media\MediaStorage;

/**
 * Genera las URLs firmadas necesarias para descargar canciones al dispositivo.
 *
 * Se resuelve en lote (una sola consulta) porque descargar una playlist son
 * decenas de canciones: pedir una URL por canción sería un N+1 de red. La
 * capacidad es la propia URL firmada, así que el cliente solo necesita la
 * ruta y el tamaño para calcular la cuota antes de descargar.
 */
class BuildDownloadUrlsAction
{
    public function __construct(private readonly MediaStorage $storage) {}

    /**
     * @param  list<int>  $songIds
     * @return list<array{song_id: int, url: string, bytes: int}>
     */
    public function execute(array $songIds): array
    {
        if ($songIds === []) {
            return [];
        }

        $songs = Song::query()
            ->with('mediaAsset:id,path,size_bytes')
            ->whereIn('id', $songIds)
            ->get()
            ->keyBy('id');

        $urls = [];

        // Se respeta el orden pedido: el cliente muestra el progreso en ese
        // orden y no necesita reordenar la respuesta.
        foreach ($songIds as $songId) {
            $song = $songs->get($songId);

            if (! $song instanceof Song || $song->mediaAsset === null) {
                continue;
            }

            $urls[] = [
                'song_id' => (int) $song->id,
                // La canción viaja en la URL firmada: si se elimina más
                // tarde, el servidor rechaza el audio aunque la URL siga
                // siendo válida.
                'url' => $this->storage->temporaryUrl($song->mediaAsset->path, songId: (int) $song->id),
                'bytes' => (int) ($song->mediaAsset->size_bytes ?? 0),
            ];
        }

        return $urls;
    }
}
