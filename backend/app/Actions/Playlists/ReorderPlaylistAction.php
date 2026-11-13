<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;
use App\Models\PlaylistItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reordena una playlist completa en una sola operación (upsert).
 * El cliente envía la lista de song_ids en el nuevo orden.
 */
final class ReorderPlaylistAction
{
    /**
     * @param  list<int>  $songIds
     */
    public function execute(Playlist $playlist, array $songIds): void
    {
        $current = $playlist->items()->pluck('song_id')->map(static fn ($id): int => (int) $id)->all();

        $sortedCurrent = $current;
        $sortedRequested = $songIds;
        sort($sortedCurrent);
        sort($sortedRequested);

        if ($sortedCurrent !== $sortedRequested) {
            throw ValidationException::withMessages([
                'song_ids' => 'La lista debe contener exactamente las canciones actuales de la playlist.',
            ]);
        }

        if ($songIds === []) {
            return;
        }

        $now = now();
        $rows = [];

        foreach (array_values($songIds) as $position => $songId) {
            $rows[] = [
                'playlist_id' => $playlist->id,
                'song_id' => $songId,
                'position' => $position,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::transaction(static function () use ($rows): void {
            PlaylistItem::query()->upsert($rows, ['playlist_id', 'song_id'], ['position', 'updated_at']);
        });
    }
}
