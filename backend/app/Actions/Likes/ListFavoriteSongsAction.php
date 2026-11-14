<?php

namespace App\Actions\Likes;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Lista las canciones marcadas como favoritas por un usuario.
 *
 * La consulta sale de la tabla pivote `song_likes`, que ya indexa
 * (user_id, created_at) para que el orden por fecha de "me gusta" sea un
 * recorrido de índice y no un filesort sobre todo el catálogo.
 */
class ListFavoriteSongsAction
{
    public function execute(User $user, int $perPage = 24): LengthAwarePaginator
    {
        return $user->likedSongs()
            // Eager loading explícito: sin esto, la serialización de cada
            // canción abriría una consulta por artista, álbum y medio.
            ->with(['artist', 'album', 'mediaAsset:id,path', 'uploader:id,name'])
            ->withIsLiked($user->id)
            ->paginate($perPage);
    }
}
