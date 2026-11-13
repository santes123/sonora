<?php

namespace App\Actions\Songs;

use App\Jobs\DeleteOrphanedMediaAssetJob;
use App\Models\Playlist;
use App\Models\Song;
use Illuminate\Support\Facades\DB;

final class DeleteSongAction
{
    public function execute(Song $song): void
    {
        $assetId = $song->media_asset_id;

        // Las canciones pueden estar en playlists de cualquier usuario: se
        // recalculan solo las afectadas y se dejan las FK en cascada.
        $playlistIds = $song->playlistItems()->pluck('playlist_id')->unique();

        DB::transaction(static fn () => $song->delete());

        Playlist::query()
            ->whereIn('id', $playlistIds)
            ->get()
            ->each(static fn (Playlist $playlist) => $playlist->recalculateStats());

        DeleteOrphanedMediaAssetJob::dispatch($assetId);
    }
}
