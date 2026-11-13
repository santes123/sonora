<?php

namespace Tests\Feature;

use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FavoritesTest extends TestCase
{
    use RefreshDatabase;

    public function test_favorites_lists_only_the_songs_liked_by_the_user(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $liked = Song::factory()->create(['title' => 'Me encanta']);
        $someoneElses = Song::factory()->create(['title' => 'De otro usuario']);

        $user->likedSongs()->attach($liked->id);
        $other->likedSongs()->attach($someoneElses->id);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/me/favorites')->assertOk();

        $response->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $liked->id)
            ->assertJsonPath('data.0.title', 'Me encanta')
            ->assertJsonPath('data.0.is_liked', true);

        $ids = collect($response->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($liked->id));
        $this->assertFalse($ids->contains($someoneElses->id));
    }

    public function test_favorites_are_ordered_from_newest_to_oldest(): void
    {
        $user = User::factory()->create();
        $old = Song::factory()->create(['title' => 'La más antigua']);
        $recent = Song::factory()->create(['title' => 'La más reciente']);

        $user->likedSongs()->attach($old->id, ['created_at' => now()->subDays(7)]);
        $user->likedSongs()->attach($recent->id, ['created_at' => now()]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/me/favorites')->assertOk();

        $response->assertJsonPath('data.0.id', $recent->id)
            ->assertJsonPath('data.1.id', $old->id);
    }

    public function test_favorites_are_paginated(): void
    {
        $user = User::factory()->create();
        $songs = Song::factory()->count(3)->create();

        foreach ($songs as $song) {
            $user->likedSongs()->attach($song->id);
        }

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/me/favorites?per_page=2')->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.last_page', 2);
    }

    public function test_favorites_expose_the_related_artist_and_album(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        $user->likedSongs()->attach($song->id);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/me/favorites')->assertOk();

        $this->assertNotNull($response->json('data.0.artist.id'));
        $this->assertNotNull($response->json('data.0.artist.name'));
        $this->assertNotNull($response->json('data.0.stream_url'));
    }

    public function test_guest_cannot_list_favorites(): void
    {
        $this->getJson('/api/v1/me/favorites')->assertUnauthorized();
    }

    public function test_favorites_are_empty_when_the_user_has_no_likes(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/me/favorites')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
