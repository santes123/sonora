<?php

namespace Tests\Feature;

use App\Models\Artist;
use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ArtistTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_artists(): void
    {
        $this->getJson('/api/v1/artists')
            ->assertUnauthorized();
    }

    public function test_user_can_list_artists_ordered_alphabetically(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $artistB = Artist::factory()->create(['name' => 'The Beatles', 'name_normalized' => 'the beatles']);
        $artistA = Artist::factory()->create(['name' => 'ABBA', 'name_normalized' => 'abba']);

        $this->getJson('/api/v1/artists')
            ->assertOk()
            ->assertJsonPath('data.0.id', $artistA->id)
            ->assertJsonPath('data.1.id', $artistB->id);
    }

    public function test_user_can_search_artists_by_prefix(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $match = Artist::factory()->create(['name' => 'Coldplay', 'name_normalized' => 'coldplay']);
        $other = Artist::factory()->create(['name' => 'Radiohead', 'name_normalized' => 'radiohead']);

        $this->getJson('/api/v1/artists?q=Cold')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $match->id);
    }

    public function test_artist_includes_songs_count(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $artist = Artist::factory()->create(['name' => 'Daft Punk', 'name_normalized' => 'daft punk']);
        Song::factory()->count(4)->create([
            'artist_id' => $artist->id,
            'uploader_id' => $user->id,
        ]);

        $this->getJson('/api/v1/artists')
            ->assertOk()
            ->assertJsonPath('data.0.id', $artist->id)
            ->assertJsonPath('data.0.songs_count', 4);
    }

    public function test_user_can_view_artist_detail_with_albums_and_songs(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $artist = Artist::factory()->create(['name' => 'Queen', 'bio' => 'Banda de rock británica.']);
        $album = \App\Models\Album::factory()->for($artist)->create(['title' => 'A Night at the Opera', 'year' => 1975]);
        $song = Song::factory()->create([
            'artist_id' => $artist->id,
            'album_id' => $album->id,
            'uploader_id' => $user->id,
            'title' => 'Bohemian Rhapsody',
        ]);

        $this->getJson("/api/v1/artists/{$artist->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $artist->id)
            ->assertJsonPath('data.name', 'Queen')
            ->assertJsonPath('data.bio', 'Banda de rock británica.')
            ->assertJsonPath('data.songs_count', 1)
            ->assertJsonPath('data.albums_count', 1)
            ->assertJsonPath('data.albums.0.id', $album->id)
            ->assertJsonPath('data.songs.0.id', $song->id);
    }

    public function test_returns_404_for_nonexistent_artist(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/artists/99999')
            ->assertNotFound();
    }
}
