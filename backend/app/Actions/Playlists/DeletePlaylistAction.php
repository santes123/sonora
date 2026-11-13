<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;

final class DeletePlaylistAction
{
    public function execute(Playlist $playlist): void
    {
        $playlist->delete();
    }
}
