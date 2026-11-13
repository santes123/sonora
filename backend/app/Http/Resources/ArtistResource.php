<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ProvidesMediaUrls;
use App\Models\Artist;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Artist */
class ArtistResource extends JsonResource
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
            'image_url' => $this->mediaUrl($this->image_path),
            'songs_count' => $this->whenCounted('songs'),
            'albums_count' => $this->whenCounted('albums'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
