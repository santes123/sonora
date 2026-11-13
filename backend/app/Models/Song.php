<?php

namespace App\Models;

use App\Support\TextNormalizer;
use Database\Factories\SongFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Song extends Model
{
    /** @use HasFactory<SongFactory> */
    use HasFactory;

    protected $fillable = [
        'media_asset_id',
        'uploader_id',
        'artist_id',
        'album_id',
        'title',
        'title_normalized',
        'artist_name',
        'artist_name_normalized',
        'album_title',
        'album_title_normalized',
        'track_number',
        'disc_number',
        'year',
        'genre',
        'duration_ms',
        'cover_path',
    ];

    protected function casts(): array
    {
        return [
            'duration_ms' => 'integer',
            'track_number' => 'integer',
            'disc_number' => 'integer',
            'year' => 'integer',
        ];
    }

    /** @return BelongsTo<MediaAsset, $this> */
    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class);
    }

    /** @return BelongsTo<Artist, $this> */
    public function artist(): BelongsTo
    {
        return $this->belongsTo(Artist::class);
    }

    /** @return BelongsTo<Album, $this> */
    public function album(): BelongsTo
    {
        return $this->belongsTo(Album::class);
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }

    /** @return HasMany<PlaylistItem, $this> */
    public function playlistItems(): HasMany
    {
        return $this->hasMany(PlaylistItem::class);
    }

    /** @param Builder<Song> $query */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $boolean = TextNormalizer::toBooleanQuery($term);

        if ($boolean !== null) {
            return $query->whereRaw(
                'MATCH(title_normalized, artist_name_normalized, album_title_normalized) AGAINST (? IN BOOLEAN MODE)',
                [$boolean]
            );
        }

        // Términos de 1–2 caracteres no entran en el índice FULLTEXT.
        $prefix = TextNormalizer::normalize($term).'%';

        return $query->where(function (Builder $inner) use ($prefix): void {
            $inner->where('title_normalized', 'like', $prefix)
                ->orWhere('artist_name_normalized', 'like', $prefix)
                ->orWhere('album_title_normalized', 'like', $prefix);
        });
    }

    /** @param Builder<Song> $query */
    public function scopeOrderByRelevance(Builder $query, ?string $term): Builder
    {
        $boolean = TextNormalizer::toBooleanQuery($term);

        if ($boolean === null) {
            return $query;
        }

        return $query->orderByRaw(
            'MATCH(title_normalized, artist_name_normalized, album_title_normalized) AGAINST (? IN BOOLEAN MODE) DESC',
            [$boolean]
        );
    }

    /** @param Builder<Song> $query */
    public function scopeByArtist(Builder $query, ?int $artistId): Builder
    {
        return $artistId ? $query->where('artist_id', $artistId) : $query;
    }

    /** @param Builder<Song> $query */
    public function scopeByAlbum(Builder $query, ?int $albumId): Builder
    {
        return $albumId ? $query->where('album_id', $albumId) : $query;
    }
}
