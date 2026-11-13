<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ProvidesMediaUrls;
use App\Models\Playlist;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Playlist */
class PlaylistResource extends JsonResource
{
    use ProvidesMediaUrls;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'is_public' => $this->is_public,
            'songs_count' => $this->songs_count,
            'duration_ms' => $this->duration_ms,
            'cover_url' => $this->mediaUrl($this->cover_path),
            'user' => $this->whenLoaded('user', fn () => new UserResource($this->user)),
            'items' => PlaylistItemResource::collection($this->whenLoaded('items')),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
