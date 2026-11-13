<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\PlaylistItem;
use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SongLikeTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_like_a_song(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/songs/{$song->id}/like")
            ->assertCreated()
            ->assertJsonPath('data.id', $song->id)
            ->assertJsonPath('data.is_liked', true);

        $this->assertDatabaseHas('song_likes', [
            'user_id' => $user->id,
            'song_id' => $song->id,
        ]);
    }

    public function test_liking_a_song_twice_is_idempotent(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        Sanctum::actingAs($user);

        // La primera vez se crea el recurso (201); la segunda ya existía (200).
        $this->postJson("/api/v1/songs/{$song->id}/like")->assertCreated();
        $this->postJson("/api/v1/songs/{$song->id}/like")
            ->assertOk()
            ->assertJsonPath('data.is_liked', true);

        $this->assertDatabaseCount('song_likes', 1);
    }

    public function test_liking_an_already_liked_song_does_not_fail_with_a_duplicate_key_error(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();

        // Simula la carrera: otra petición (u otro dispositivo) ya insertó la
        // fila. La restricción única (user_id, song_id) no debe convertirse en
        // un 500, sino en una respuesta idempotente.
        $user->likedSongs()->attach($song->id);

        Sanctum::actingAs($user);

        $this->postJson("/api/v1/songs/{$song->id}/like")
            ->assertOk()
            ->assertJsonPath('data.is_liked', true);

        $this->assertDatabaseCount('song_likes', 1);
    }

    public function test_user_can_unlike_a_song(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        $user->likedSongs()->attach($song->id);
        Sanctum::actingAs($user);

        $this->deleteJson("/api/v1/songs/{$song->id}/like")
            ->assertOk()
            ->assertJsonPath('data.is_liked', false);

        $this->assertDatabaseMissing('song_likes', [
            'user_id' => $user->id,
            'song_id' => $song->id,
        ]);
    }

    public function test_unliking_a_not_liked_song_is_safe(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        Sanctum::actingAs($user);

        $this->deleteJson("/api/v1/songs/{$song->id}/like")
            ->assertOk()
            ->assertJsonPath('data.is_liked', false);
    }

    public function test_songs_index_returns_is_liked_flag(): void
    {
        $user = User::factory()->create();
        $liked = Song::factory()->create();
        $notLiked = Song::factory()->create();
        $user->likedSongs()->attach($liked->id);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/songs')
            ->assertOk();

        $data = collect($response->json('data'));
        $this->assertTrue($data->firstWhere('id', $liked->id)['is_liked']);
        $this->assertFalse($data->firstWhere('id', $notLiked->id)['is_liked']);
    }

    public function test_songs_index_can_filter_favorites_only(): void
    {
        $user = User::factory()->create();
        $liked = Song::factory()->create(['title' => 'Mi Favorita']);
        $other = Song::factory()->create(['title' => 'No favorita']);
        $user->likedSongs()->attach($liked->id);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/songs?liked=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $liked->id);
    }

    public function test_guest_cannot_like_a_song(): void
    {
        $song = Song::factory()->create();

        $this->postJson("/api/v1/songs/{$song->id}/like")
            ->assertUnauthorized();
    }

    public function test_like_on_nonexistent_song_returns_404(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/songs/99999/like')
            ->assertNotFound();
    }

    public function test_song_detail_returns_is_liked_flag(): void
    {
        $user = User::factory()->create();
        $liked = Song::factory()->create();
        $notLiked = Song::factory()->create();
        $user->likedSongs()->attach($liked->id);
        Sanctum::actingAs($user);

        $this->getJson("/api/v1/songs/{$liked->id}")
            ->assertOk()
            ->assertJsonPath('data.is_liked', true);

        $this->getJson("/api/v1/songs/{$notLiked->id}")
            ->assertOk()
            ->assertJsonPath('data.is_liked', false);
    }

    public function test_playlist_songs_carry_the_is_liked_flag(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        $liked = Song::factory()->create();
        $notLiked = Song::factory()->create();

        PlaylistItem::factory()->create(['playlist_id' => $playlist->id, 'song_id' => $liked->id, 'position' => 0]);
        PlaylistItem::factory()->create(['playlist_id' => $playlist->id, 'song_id' => $notLiked->id, 'position' => 1]);

        $user->likedSongs()->attach($liked->id);
        Sanctum::actingAs($user);

        $response = $this->getJson("/api/v1/playlists/{$playlist->id}")->assertOk();

        $items = collect($response->json('data.items'));
        $this->assertTrue($items->firstWhere('song.id', $liked->id)['song']['is_liked']);
        $this->assertFalse($items->firstWhere('song.id', $notLiked->id)['song']['is_liked']);
    }

    public function test_liked_filter_also_accepts_the_favorites_alias(): void
    {
        $user = User::factory()->create();
        $liked = Song::factory()->create();
        $user->likedSongs()->attach($liked->id);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/songs?favorites=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $liked->id);
    }

    public function test_liked_filter_is_ordered_by_when_the_song_was_liked(): void
    {
        $user = User::factory()->create();

        // La canción marcada más tarde es la más antigua del catálogo: el
        // filtro de favoritas ordena por la fecha del "me gusta", no por la
        // fecha de creación de la canción.
        $olderSong = Song::factory()->create(['created_at' => now()->subDays(30)]);
        $newerSong = Song::factory()->create(['created_at' => now()->subDays(60)]);

        $user->likedSongs()->attach($olderSong->id, ['created_at' => now()->subDays(10)]);
        $user->likedSongs()->attach($newerSong->id, ['created_at' => now()]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/songs?liked=1')->assertOk();

        $response->assertJsonPath('data.0.id', $newerSong->id)
            ->assertJsonPath('data.1.id', $olderSong->id)
            ->assertJsonPath('meta.total', 2);
    }
}
