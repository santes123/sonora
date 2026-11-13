<?php

namespace App\Models;

use Database\Factories\AlbumFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Album extends Model
{
    /** @use HasFactory<AlbumFactory> */
    use HasFactory;

    protected $fillable = [
        'artist_id',
        'title',
        'title_normalized',
        'year',
        'cover_path',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
        ];
    }

    /** @return BelongsTo<Artist, $this> */
    public function artist(): BelongsTo
    {
        return $this->belongsTo(Artist::class);
    }

    /** @return HasMany<Song, $this> */
    public function songs(): HasMany
    {
        return $this->hasMany(Song::class);
    }
}
