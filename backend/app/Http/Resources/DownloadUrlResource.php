<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * URL firmada de descarga de una canción.
 *
 * @property-read int $song_id
 * @property-read string $url
 * @property-read int $bytes
 */
class DownloadUrlResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'song_id' => (int) $this->resource['song_id'],
            'url' => (string) $this->resource['url'],
            'bytes' => (int) $this->resource['bytes'],
        ];
    }
}
