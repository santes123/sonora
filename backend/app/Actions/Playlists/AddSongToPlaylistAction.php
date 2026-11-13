<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;
use App\Models\PlaylistItem;
use Illuminate\Support\Facades\DB;

/**
 * Añade una canción al final de la playlist.
 *
 * El bloqueo de la fila de la playlist serializa las posiciones y evita dos
 * elementos con la misma posición cuando se añade desde dos pestañas.
 */
final class AddSongToPlaylistAction
{
    public function execute(Playlist $playlist, int $songId): bool
    {
        return DB::transaction(function () use ($playlist, $songId): bool {
            $playlist = Playlist::query()->lockForUpdate()->findOrFail($playlist->id);

            $maxPosition = $playlist->items()->max('position');

            // Posiciones densas basadas en 0: al borrar, la compactación deja
            // siempre el primer elemento en 0.
            $nextPosition = $maxPosition === null ? 0 : ((int) $maxPosition) + 1;

            $item = PlaylistItem::query()->firstOrCreate(
                ['playlist_id' => $playlist->id, 'song_id' => $songId],
                ['position' => $nextPosition],
            );

            if ($item->wasRecentlyCreated) {
                $playlist->recalculateStats();
            }

            return $item->wasRecentlyCreated;
        });
    }
}
