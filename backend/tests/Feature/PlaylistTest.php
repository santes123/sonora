<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlaylistTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_a_playlist(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/playlists', [
            'name' => 'Mis favoritas',
            'description' => 'Lo mejor',
            'is_public' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Mis favoritas')
            ->assertJsonPath('data.is_public', true);

        $this->assertDatabaseHas('playlists', [
            'user_id' => $user->id,
            'name' => 'Mis favoritas',
        ]);
    }

    public function test_songs_can_be_added_and_duplicates_are_idempotent(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->for($user)->create();
        $song = Song::factory()->create();

        Sanctum::actingAs($user);

        $this->postJson("/api/v1/playlists/{$playlist->id}/items", ['song_id' => $song->id])
            ->assertCreated()
            ->assertJsonCount(1, 'data.items');

        $this->postJson("/api/v1/playlists/{$playlist->id}/items", ['song_id' => $song->id])
            ->assertOk()
            ->assertJsonCount(1, 'data.items');

        $this->assertDatabaseCount('playlist_items', 1);
        $this->assertSame(1, $playlist->fresh()->songs_count);
    }

    public function test_playlist_can_be_reordered(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->for($user)->create();
        $first = Song::factory()->create();
        $second = Song::factory()->create();
        $third = Song::factory()->create();

        Sanctum::actingAs($user);

        foreach ([$first, $second, $third] as $song) {
            $this->postJson("/api/v1/playlists/{$playlist->id}/items", ['song_id' => $song->id]);
        }

        $response = $this->putJson("/api/v1/playlists/{$playlist->id}/items", [
            'song_ids' => [$third->id, $first->id, $second->id],
        ])->assertOk();

        $ids = collect($response->json('data.items'))->pluck('song.id')->all();

        $this->assertSame([$third->id, $first->id, $second->id], $ids);

        $this->assertDatabaseHas('playlist_items', [
            'playlist_id' => $playlist->id,
            'song_id' => $third->id,
            'position' => 0,
        ]);
    }

    public function test_reorder_rejects_a_different_song_set(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->for($user)->create();
        $song = Song::factory()->create();
        $other = Song::factory()->create();

        $playlist->items()->create(['song_id' => $song->id, 'position' => 0]);

        Sanctum::actingAs($user);

        $this->putJson("/api/v1/playlists/{$playlist->id}/items", [
            'song_ids' => [$other->id],
        ])->assertStatus(422);
    }

    public function test_removing_a_song_compacts_positions(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->for($user)->create();
        $first = Song::factory()->create();
        $second = Song::factory()->create();

        Sanctum::actingAs($user);

        foreach ([$first, $second] as $song) {
            $this->postJson("/api/v1/playlists/{$playlist->id}/items", ['song_id' => $song->id]);
        }

        $this->deleteJson("/api/v1/playlists/{$playlist->id}/items/{$first->id}")
            ->assertNoContent();

        $this->assertDatabaseHas('playlist_items', [
            'playlist_id' => $playlist->id,
            'song_id' => $second->id,
            'position' => 0,
        ]);
    }

    public function test_public_playlist_is_visible_but_not_editable_by_others(): void
    {
        $owner = User::factory()->create();
        $playlist = Playlist::factory()->for($owner)->public()->create();
        $visitor = User::factory()->create();

        Sanctum::actingAs($visitor);

        $this->getJson("/api/v1/playlists/{$playlist->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $playlist->id);

        $this->patchJson("/api/v1/playlists/{$playlist->id}", ['name' => 'Hackeada'])
            ->assertForbidden();
    }

    public function test_private_playlist_is_hidden_from_other_users(): void
    {
        $owner = User::factory()->create();
        $playlist = Playlist::factory()->for($owner)->create();
        $visitor = User::factory()->create();

        Sanctum::actingAs($visitor);

        $this->getJson("/api/v1/playlists/{$playlist->id}")->assertForbidden();
    }

    public function test_owner_can_delete_a_playlist(): void
    {
        $owner = User::factory()->create();
        $playlist = Playlist::factory()->for($owner)->create();

        Sanctum::actingAs($owner);

        $this->deleteJson("/api/v1/playlists/{$playlist->id}")->assertNoContent();

        $this->assertSoftDeleted('playlists', ['id' => $playlist->id]);
    }
}
