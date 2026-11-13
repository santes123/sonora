<?php

namespace App\Actions\Playlists;

use App\Models\Playlist;
use App\Models\User;

final class CreatePlaylistAction
{
    public function execute(User $user, array $data): Playlist
    {
        return $user->playlists()->create([
            'name' => trim($data['name']),
            'description' => $data['description'] ?? null,
            'is_public' => (bool) ($data['is_public'] ?? false),
        ]);
    }
}
