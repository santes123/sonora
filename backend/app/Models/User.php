<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'avatar_path',
        'role',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
    ];

    /**
     * Espeja los defaults de la base de datos para que una instancia recién
     * creada ya exponga `role` (Eloquent no hidrata defaults del motor).
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'role' => 'user',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }

    /** @return HasMany<Playlist, $this> */
    public function playlists(): HasMany
    {
        return $this->hasMany(Playlist::class);
    }

    /** @return HasMany<Song, $this> */
    public function uploadedSongs(): HasMany
    {
        return $this->hasMany(Song::class, 'uploader_id');
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }
}
