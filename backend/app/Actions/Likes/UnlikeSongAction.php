<?php

namespace App\Actions\Likes;

use App\Models\Song;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Quita una canción de las favoritas de un usuario.
 *
 * Idempotente: quitar un "me gusta" que no existe no es un error, simplemente
 * no hay nada que hacer.
 */
class UnlikeSongAction
{
    public function execute(User $user, Song $song): void
    {
        DB::table('song_likes')
            ->where('user_id', $user->id)
            ->where('song_id', $song->id)
            ->delete();
    }
}
