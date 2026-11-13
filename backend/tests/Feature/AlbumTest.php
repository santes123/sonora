<?php

namespace Tests\Feature;

use App\Models\Album;
use App\Models\Artist;
use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AlbumTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_albums(): void
    {
        $this->getJson('/api/v1/albums')
            ->assertUnauthorized();
    }

    public function test_user_can_list_albums_with_songs_count(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $artist = Artist::factory()->create(['name' => 'Pink Floyd']);
        $album = Album::factory()->for($artist)->create([
            'title' => 'The Dark Side of the Moon',
            'year' => 1973,
        ]);
        Song::factory()->count(3)->create([
            'artist_id' => $artist->id,
            'album_id' => $album->id,
            'uploader_id' => $user->id,
        ]);

        $this->getJson('/api/v1/albums')
            ->assertOk()
            ->assertJsonPath('data.0.id', $album->id)
            ->assertJsonPath('data.0.title', 'The Dark Side of the Moon')
            ->assertJsonPath('data.0.artist.name', 'Pink Floyd')
            ->assertJsonPath('data.0.songs_count', 3);
    }

    public function test_user_can_filter_albums_by_artist(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $artistA = Artist::factory()->create(['name' => 'Queen']);
        $artistB = Artist::factory()->create(['name' => 'Nirvana']);

        $albumA = Album::factory()->for($artistA)->create(['title' => 'A Night at the Opera']);
        $albumB = Album::factory()->for($artistB)->create(['title' => 'Nevermind']);

        $response = $this->getJson("/api/v1/albums?artist_id={$artistA->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $albumA->id);
    }

    public function test_user_can_view_album_detail_with_ordered_songs(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $artist = Artist::factory()->create();
        $album = Album::factory()->for($artist)->create(['title' => 'Grandes Éxitos']);

        $track2 = Song::factory()->create([
            'artist_id' => $artist->id,
            'album_id' => $album->id,
            'uploader_id' => $user->id,
            'track_number' => 2,
            'disc_number' => 1,
            'title' => 'Canción Dos',
        ]);

        $track1 = Song::factory()->create([
            'artist_id' => $artist->id,
            'album_id' => $album->id,
            'uploader_id' => $user->id,
            'track_number' => 1,
            'disc_number' => 1,
            'title' => 'Canción Uno',
        ]);

        $this->getJson("/api/v1/albums/{$album->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $album->id)
            ->assertJsonPath('data.songs_count', 2)
            ->assertJsonPath('data.songs.0.id', $track1->id)
            ->assertJsonPath('data.songs.1.id', $track2->id);
    }

    public function test_returns_404_for_nonexistent_album(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/albums/99999')
            ->assertNotFound();
    }
}
