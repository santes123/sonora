<?php

namespace App\Policies;

use App\Models\Song;
use App\Models\User;

class SongPolicy
{
    public function view(User $user, Song $song): bool
    {
        // Catálogo compartido: cualquier usuario autenticado puede escuchar.
        return true;
    }

    public function update(User $user, Song $song): bool
    {
        return $user->isAdmin() || $song->uploader_id === $user->id;
    }

    public function delete(User $user, Song $song): bool
    {
        return $user->isAdmin() || $song->uploader_id === $user->id;
    }
}
