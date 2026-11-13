<?php

namespace App\Models;

use Database\Factories\MediaAssetFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MediaAsset extends Model
{
    /** @use HasFactory<MediaAssetFactory> */
    use HasFactory;

    protected $fillable = [
        'hash',
        'disk',
        'path',
        'mime_type',
        'extension',
        'format',
        'size_bytes',
        'duration_ms',
        'bitrate',
        'sample_rate',
        'channels',
        'original_filename',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'duration_ms' => 'integer',
            'bitrate' => 'integer',
            'sample_rate' => 'integer',
            'channels' => 'integer',
        ];
    }

    /** @return HasMany<Song, $this> */
    public function songs(): HasMany
    {
        return $this->hasMany(Song::class);
    }
}
