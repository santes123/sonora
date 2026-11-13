<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/**
 * Registra una reproducción en el historial del usuario.
 *
 * Se ejecuta en la cola para que el reproductor nunca espere: la respuesta
 * HTTP es un 202 inmediato y la escritura ocurre en segundo plano.
 *
 * El upsert es atómico (una sola sentencia con ON DUPLICATE KEY UPDATE).
 * Dos reproducciones simultáneas de la misma canción no se pierden ni
 * provocan un error de clave duplicada: solo incrementan el contador.
 */
final class RecordListeningJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    /** @var list<int> */
    public array $backoff = [5, 15, 60];

    public function __construct(
        private readonly int $userId,
        private readonly int $songId,
    ) {}

    public function handle(): void
    {
        $now = now()->format('Y-m-d H:i:s');

        DB::statement(
            'INSERT INTO listening_history (user_id, song_id, played_at, play_count, created_at, updated_at)
             VALUES (?, ?, ?, 1, ?, ?)
             ON DUPLICATE KEY UPDATE
                played_at = VALUES(played_at),
                play_count = play_count + 1,
                updated_at = VALUES(updated_at)',
            [$this->userId, $this->songId, $now, $now, $now],
        );
    }
}
