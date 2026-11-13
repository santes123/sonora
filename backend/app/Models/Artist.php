<?php

namespace App\Models;

use Database\Factories\ArtistFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Artist extends Model
{
    /** @use HasFactory<ArtistFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'name_normalized',
        'image_path',
        'bio',
    ];

    /** @return HasMany<Album, $this> */
    public function albums(): HasMany
    {
        return $this->hasMany(Album::class);
    }

    /** @return HasMany<Song, $this> */
    public function songs(): HasMany
    {
        return $this->hasMany(Song::class);
    }
}
