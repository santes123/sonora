<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Historial de reproducción del usuario.
 *
 * Una fila por canción: `played_at` es la última vez que se escuchó y
 * `play_count` cuántas veces se ha escuchado en total.
 *
 * @property Carbon $played_at
 */
class ListeningHistory extends Model
{
    /**
     * La tabla se llama en singular, como el resto de tablas que registran un
     * hecho (`song_likes`). Eloquent pluralizaría a `listening_histories`.
     */
    protected $table = 'listening_history';

    protected $fillable = ['user_id', 'song_id', 'played_at', 'play_count'];

    protected function casts(): array
    {
        return [
            'played_at' => 'datetime',
            'play_count' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Song, $this> */
    public function song(): BelongsTo
    {
        return $this->belongsTo(Song::class);
    }
}
