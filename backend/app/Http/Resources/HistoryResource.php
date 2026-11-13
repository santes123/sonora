<?php

namespace App\Http\Resources;

use App\Models\ListeningHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Una entrada del historial de reproducción.
 *
 * Reutiliza la forma de `SongResource` y añade los dos campos propios del
 * historial, para que el cliente pueda pintar el carrusel sin tener que
 * combinar dos estructuras distintas.
 *
 * @mixin ListeningHistory
 */
class HistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $song = (new SongResource($this->song))->resolve($request);

        return [
            ...$song,
            'played_at' => $this->played_at?->toIso8601String(),
            'play_count' => (int) $this->play_count,
        ];
    }
}
