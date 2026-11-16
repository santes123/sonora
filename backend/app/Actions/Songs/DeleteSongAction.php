<?php

namespace App\Actions\Songs;

use App\Models\Song;

/**
 * Elimina una canción del catálogo (borrado lógico).
 *
 * La fila no se borra: la canción deja de aparecer en el catálogo y de ser
 * reproducible, pero sigue existiendo para poder marcarla como "no disponible"
 * en las playlists de otras personas y para poder restaurarla más adelante.
 *
 * Consecuencias decididas aquí:
 *
 * - La entrada en la playlist se conserva. Quitar la fila dejaría la playlist
 *   de otra persona con un hueco invisible y cambiaría su numeración.
 * - El fichero de audio NO se borra. Es lo que hace el borrado reversible;
 *   el medio se limpia cuando la canción se elimina de forma definitiva.
 * - No se recalculan los contadores de la playlist: la canción sigue dentro.
 */
final class DeleteSongAction
{
    public function execute(Song $song): void
    {
        if ($song->deleted_at !== null) {
            return;
        }

        // `delete()` de SoftDeletes marca `deleted_at` y filtra la fila del
        // catálogo a partir de ese momento.
        $song->delete();
    }
}
