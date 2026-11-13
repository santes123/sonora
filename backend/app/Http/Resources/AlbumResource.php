<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ProvidesMediaUrls;
use App\Models\Album;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Album */
class AlbumResource extends JsonResource
{
    use ProvidesMediaUrls;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'year' => $this->year,
            'cover_url' => $this->mediaUrl($this->cover_path),
            'songs_count' => $this->whenCounted('songs'),
            'artist' => $this->whenLoaded('artist', fn () => new ArtistResource($this->artist)),
            'songs' => SongResource::collection($this->whenLoaded('songs')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
