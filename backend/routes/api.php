<?php

use App\Http\Controllers\Api\V1\AlbumController;
use App\Http\Controllers\Api\V1\ArtistController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\FavoritesController;
use App\Http\Controllers\Api\V1\GoogleAuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HistoryController;
use App\Http\Controllers\Api\V1\OfflineController;
use App\Http\Controllers\Api\V1\PlaylistController;
use App\Http\Controllers\Api\V1\SongController;
use App\Http\Controllers\Api\V1\SongLikeController;
use App\Http\Controllers\Api\V1\StreamMediaController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class)->name('health');

    // URL firmada: no requiere sesión (el HMAC es la capability).
    // `signed:relative` porque MediaStorage genera la URL relativa (misma
    // origen), evitando que un proxy cambie el host e invalide el HMAC.
    Route::get('/media/{token}', StreamMediaController::class)
        ->middleware('signed:relative')
        ->where('token', '[A-Za-z0-9_-]+')
        ->name('media.stream');

    Route::middleware('throttle:auth')->group(function (): void {
        Route::post('/auth/register', [AuthController::class, 'register'])->name('auth.register');
        Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
    });

    Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('auth.google.redirect');
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('auth.google.callback');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        Route::get('/songs', [SongController::class, 'index'])->name('songs.index');
        Route::get('/songs/{song}', [SongController::class, 'show'])->name('songs.show');
        Route::post('/songs', [SongController::class, 'store'])
            ->middleware('throttle:uploads')
            ->name('songs.store');
        Route::delete('/songs/{song}', [SongController::class, 'destroy'])->name('songs.destroy');
        Route::post('/songs/{song}/like', [SongLikeController::class, 'store'])->name('songs.like');
        Route::delete('/songs/{song}/like', [SongLikeController::class, 'destroy'])->name('songs.unlike');
        Route::get('/me/favorites', [FavoritesController::class, 'index'])->name('me.favorites');

        Route::get('/artists', [ArtistController::class, 'index'])->name('artists.index');
        Route::get('/artists/{artist}', [ArtistController::class, 'show'])->name('artists.show');
        Route::get('/albums', [AlbumController::class, 'index'])->name('albums.index');
        Route::get('/albums/{album}', [AlbumController::class, 'show'])->name('albums.show');

        Route::get('/playlists', [PlaylistController::class, 'index'])->name('playlists.index');
        Route::post('/playlists', [PlaylistController::class, 'store'])->name('playlists.store');
        Route::get('/playlists/{playlist}', [PlaylistController::class, 'show'])->name('playlists.show');
        Route::patch('/playlists/{playlist}', [PlaylistController::class, 'update'])->name('playlists.update');
        Route::delete('/playlists/{playlist}', [PlaylistController::class, 'destroy'])->name('playlists.destroy');

        Route::post('/playlists/{playlist}/items', [PlaylistController::class, 'addItem'])->name('playlists.items.store');
        Route::delete('/playlists/{playlist}/items/{song}', [PlaylistController::class, 'removeItem'])->name('playlists.items.destroy');
        Route::put('/playlists/{playlist}/items', [PlaylistController::class, 'reorder'])->name('playlists.items.reorder');
        Route::post('/playlists/{playlist}/cover', [PlaylistController::class, 'updateCover'])->name('playlists.cover.store');

        // Historial de reproducción del usuario.
        Route::get('/history', [HistoryController::class, 'index'])->name('history.index');
        Route::post('/history', [HistoryController::class, 'store'])->name('history.store');
        Route::delete('/history', [HistoryController::class, 'destroy'])->name('history.destroy');

        // Descarga offline: URLs firmadas en lote para guardar el audio en el
        // dispositivo. La capacidad es la propia URL firmada.
        Route::post('/offline/urls', [OfflineController::class, 'urls'])->name('offline.urls');
    });
});
