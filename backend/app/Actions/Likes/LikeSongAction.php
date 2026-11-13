<?php

namespace App\Actions\Likes;

use App\Models\Song;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Marca una canción como favorita de un usuario.
 *
 * La operación es idempotente por diseño: dos "me gusta" simultáneos sobre la
 * misma canción no deben devolver un 500 por violación de la restricción única
 * (user_id, song_id). `insertOrIgnore` compila a `INSERT IGNORE` en MariaDB,
 * que descarta la fila duplicada en lugar de abortar la transacción.
 */
class LikeSongAction
{
    /**
     * @return bool `true` si el "me gusta" es nuevo, `false` si ya existía.
     */
    public function execute(User $user, Song $song): bool
    {
        $inserted = DB::table('song_likes')->insertOrIgnore([
            'user_id' => $user->id,
            'song_id' => $song->id,
            'created_at' => now(),
        ]) > 0;

        if ($inserted) {
            return true;
        }

        // `INSERT IGNORE` también descarta filas por otros motivos (por ejemplo
        // una clave ajena inválida). Comprobar que el "me gusta" existe de
        // verdad evita confirmar al cliente una operación que no se realizó.
        $exists = DB::table('song_likes')
            ->where('user_id', $user->id)
            ->where('song_id', $song->id)
            ->exists();

        if (! $exists) {
            throw new RuntimeException('No se pudo registrar el "me gusta".');
        }

        return false;
    }
}
