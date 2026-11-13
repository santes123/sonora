<?php

namespace Tests\Feature;

use App\Jobs\RecordListeningJob;
use App\Models\ListeningHistory;
use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ListeningHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_recording_a_listening_stores_the_song(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/history', ['song_id' => $song->id])
            ->assertStatus(202)
            ->assertJsonPath('data.status', 'queued');

        $this->assertDatabaseHas('listening_history', [
            'user_id' => $user->id,
            'song_id' => $song->id,
            'play_count' => 1,
        ]);
    }

    public function test_recording_the_same_song_twice_keeps_one_row_and_increments_the_counter(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/history', ['song_id' => $song->id])->assertStatus(202);
        $this->postJson('/api/v1/history', ['song_id' => $song->id])->assertStatus(202);

        $this->assertDatabaseCount('listening_history', 1);
        $this->assertDatabaseHas('listening_history', [
            'user_id' => $user->id,
            'song_id' => $song->id,
            'play_count' => 2,
        ]);
    }

    public function test_the_job_is_dispatched_to_the_queue(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        Sanctum::actingAs($user);

        Queue::fake();

        $this->postJson('/api/v1/history', ['song_id' => $song->id])->assertStatus(202);

        Queue::assertPushed(
            RecordListeningJob::class,
            fn (RecordListeningJob $job) => true,
        );
    }

    public function test_history_lists_songs_from_newest_to_oldest(): void
    {
        $user = User::factory()->create();
        $older = Song::factory()->create(['title' => 'La más antigua']);
        $newer = Song::factory()->create(['title' => 'La más reciente']);

        ListeningHistory::query()->create([
            'user_id' => $user->id,
            'song_id' => $older->id,
            'played_at' => now()->subDays(3),
            'play_count' => 1,
        ]);
        ListeningHistory::query()->create([
            'user_id' => $user->id,
            'song_id' => $newer->id,
            'played_at' => now(),
            'play_count' => 5,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/history')->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.0.play_count', 5)
            ->assertJsonPath('data.1.id', $older->id);
    }

    public function test_history_entries_carry_the_song_metadata_and_the_like_state(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create();
        $user->likedSongs()->attach($song->id);

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/history', ['song_id' => $song->id])->assertStatus(202);

        $response = $this->getJson('/api/v1/history')->assertOk();

        $response->assertJsonPath('data.0.id', $song->id)
            ->assertJsonPath('data.0.title', $song->title)
            ->assertJsonPath('data.0.is_liked', true)
            ->assertJsonPath('data.0.play_count', 1);

        $this->assertNotNull($response->json('data.0.artist.id'));
        $this->assertNotNull($response->json('data.0.artist.name'));
        $this->assertNotNull($response->json('data.0.played_at'));
    }

    public function test_history_only_shows_the_entries_of_the_own_user(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $mine = Song::factory()->create(['title' => 'Mía']);
        $theirs = Song::factory()->create(['title' => 'Suya']);

        ListeningHistory::query()->create([
            'user_id' => $user->id,
            'song_id' => $mine->id,
            'played_at' => now(),
            'play_count' => 1,
        ]);
        ListeningHistory::query()->create([
            'user_id' => $other->id,
            'song_id' => $theirs->id,
            'played_at' => now(),
            'play_count' => 1,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/history')->assertOk();

        $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id);
    }

    public function test_history_is_paginated(): void
    {
        $user = User::factory()->create();
        $songs = Song::factory()->count(3)->create();

        foreach ($songs as $song) {
            ListeningHistory::query()->create([
                'user_id' => $user->id,
                'song_id' => $song->id,
                'played_at' => now(),
                'play_count' => 1,
            ]);
        }

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/history?per_page=2')->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2);
    }

    public function test_clearing_the_history_only_removes_the_entries_of_the_user(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $song = Song::factory()->create();

        ListeningHistory::query()->create([
            'user_id' => $user->id,
            'song_id' => $song->id,
            'played_at' => now(),
            'play_count' => 1,
        ]);
        ListeningHistory::query()->create([
            'user_id' => $other->id,
            'song_id' => $song->id,
            'played_at' => now(),
            'play_count' => 1,
        ]);

        Sanctum::actingAs($user);

        $this->deleteJson('/api/v1/history')->assertNoContent();

        $this->assertDatabaseMissing('listening_history', ['user_id' => $user->id]);
        $this->assertDatabaseHas('listening_history', ['user_id' => $other->id]);
    }

    public function test_guest_cannot_access_the_history(): void
    {
        $this->getJson('/api/v1/history')->assertUnauthorized();
        $this->postJson('/api/v1/history', ['song_id' => 1])->assertUnauthorized();
        $this->deleteJson('/api/v1/history')->assertUnauthorized();
    }

    public function test_recording_an_unknown_song_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/history', ['song_id' => 99999])
            ->assertStatus(422)
            ->assertJsonValidationErrors('song_id');
    }

    public function test_recording_requires_a_song_id(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/history', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('song_id');
    }
}
