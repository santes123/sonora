<?php

namespace App\Actions\Songs;

use App\Models\Song;

/**
 * Restaura una canción eliminada lógicamente.
 *
 * El borrado lógico conserva el fichero de audio y la fila, así que la
 * restauración es instantánea: solo hay que limpiar `deleted_at`. La canción
 * vuelve al catálogo y a ser reproducible con la misma URL firmada.
 */
final class RestoreSongAction
{
    public function execute(Song $song): Song
    {
        if ($song->deleted_at === null) {
            return $song;
        }

        $song->restore();

        return $song->refresh();
    }
}
