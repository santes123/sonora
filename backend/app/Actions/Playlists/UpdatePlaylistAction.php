<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;

final class UpdatePlaylistAction
{
    public function execute(Playlist $playlist, array $data): Playlist
    {
        $playlist->fill($data)->save();

        return $playlist->refresh();
    }
}
