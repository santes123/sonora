<?php

namespace App\Actions\History;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Lista el historial de reproducción del usuario, de más reciente a más
 * antigua.
 *
 * La consulta parte de `listening_history`, cuyo índice (user_id, played_at)
 * ya devuelve las filas en orden: no hay filesort ni se leen más filas de
 * las pedidas.
 */
class ListListeningHistoryAction
{
    public function execute(User $user, int $perPage = 24): LengthAwarePaginator
    {
        return $user->listeningHistory()
            // Eager loading explícito: sin esto, serializar cada entrada
            // abriría una consulta por canción, artista, álbum y medio.
            ->with(['song' => fn ($query) => $query
                ->with(['artist', 'album', 'mediaAsset:id,path', 'uploader:id,name'])
                ->withIsLiked($user->id),
            ])
            ->orderByDesc('played_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }
}
