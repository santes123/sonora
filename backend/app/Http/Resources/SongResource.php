<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ProvidesMediaUrls;
use App\Models\Song;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Song */
class SongResource extends JsonResource
{
    use ProvidesMediaUrls;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $coverPath = $this->cover_path
            ?? ($this->relationLoaded('album') ? $this->album?->cover_path : null);

        $streamUrl = $this->relationLoaded('mediaAsset') && $this->mediaAsset !== null
            ? $this->mediaUrl($this->mediaAsset->path)
            : null;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'artist_name' => $this->artist_name,
            'album_title' => $this->album_title,
            'track_number' => $this->track_number,
            'disc_number' => $this->disc_number,
            'year' => $this->year,
            'genre' => $this->genre,
            'duration_ms' => $this->duration_ms,
            'is_liked' => (bool) ($this->is_liked ?? false),
            'cover_url' => $this->mediaUrl($coverPath),
            'stream_url' => $streamUrl,
            'artist' => $this->whenLoaded('artist', fn () => new ArtistResource($this->artist)),
            'album' => $this->whenLoaded('album', fn () => new AlbumResource($this->album)),
            'uploader' => $this->whenLoaded('uploader', fn () => new UserResource($this->uploader)),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
