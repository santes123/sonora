<?php

namespace App\Models;

use Database\Factories\PlaylistFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Playlist extends Model
{
    /** @use HasFactory<PlaylistFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'cover_path',
        'is_public',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'songs_count' => 'integer',
            'duration_ms' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<PlaylistItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(PlaylistItem::class)->orderBy('position');
    }

    /** @param Builder<Playlist> $query */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $inner) use ($user): void {
            $inner->where('user_id', $user->id)
                ->orWhere('is_public', true);
        });
    }

    /**
     * Recalcula contadores desnormalizados en una sola consulta.
     * Se invoca solo en mutaciones, nunca en lecturas.
     */
    public function recalculateStats(): void
    {
        $stats = PlaylistItem::query()
            ->where('playlist_id', $this->id)
            ->join('songs', 'songs.id', '=', 'playlist_items.song_id')
            ->selectRaw('COUNT(songs.id) as songs_count, COALESCE(SUM(songs.duration_ms), 0) as duration_ms')
            ->first();

        $this->forceFill([
            'songs_count' => (int) ($stats->songs_count ?? 0),
            'duration_ms' => (int) ($stats->duration_ms ?? 0),
        ])->saveQuietly();
    }
}
