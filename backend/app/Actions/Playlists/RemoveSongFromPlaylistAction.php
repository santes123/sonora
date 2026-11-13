<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;
use Illuminate\Support\Facades\DB;

final class RemoveSongFromPlaylistAction
{
    public function execute(Playlist $playlist, int $songId): bool
    {
        return DB::transaction(function () use ($playlist, $songId): bool {
            $playlist = Playlist::query()->lockForUpdate()->findOrFail($playlist->id);

            $item = $playlist->items()->where('song_id', $songId)->first();

            if ($item === null) {
                return false;
            }

            $position = $item->position;
            $item->delete();

            // Compacta posiciones para que el orden siga siendo denso.
            $playlist->items()
                ->where('position', '>', $position)
                ->decrement('position');

            $playlist->recalculateStats();

            return true;
        });
    }
}
