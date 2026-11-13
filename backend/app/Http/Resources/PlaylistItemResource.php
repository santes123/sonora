<?php

namespace App\Http\Resources;

use App\Models\PlaylistItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PlaylistItem */
class PlaylistItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position,
            'song' => $this->whenLoaded('song', fn () => new SongResource($this->song)),
        ];
    }
}
