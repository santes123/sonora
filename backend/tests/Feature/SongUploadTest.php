<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\Song;
use App\Models\User;
use App\Services\Media\MetadataExtractor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeMetadataExtractor;
use Tests\TestCase;

class SongUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('media');
        config(['media.x_accel' => false]);

        $this->app->instance(MetadataExtractor::class, new FakeMetadataExtractor([
            'title' => 'Canción de Prueba',
            'artist' => 'Los Prueba',
            'album' => 'Álbum de Prueba',
            'duration_ms' => 210_000,
        ]));
    }

    public function test_authenticated_user_can_upload_a_song(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->createWithContent('cancion.mp3', str_repeat('audio-data-', 200));

        $response = $this->post('/api/v1/songs', ['file' => $file], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Canción de Prueba')
            ->assertJsonPath('data.artist_name', 'Los Prueba')
            ->assertJsonPath('data.album_title', 'Álbum de Prueba');

        $this->assertDatabaseCount('songs', 1);
        $this->assertDatabaseCount('media_assets', 1);
        $this->assertDatabaseHas('artists', ['name_normalized' => 'los prueba']);
        $this->assertCount(1, Storage::disk('media')->allFiles('tracks'));
    }

    public function test_uploading_the_same_file_twice_is_deduplicated(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $content = str_repeat('same-binary-', 500);

        $first = $this->post('/api/v1/songs', [
            'file' => UploadedFile::fake()->createWithContent('original.mp3', $content),
        ], ['Accept' => 'application/json']);

        $second = $this->post('/api/v1/songs', [
            'file' => UploadedFile::fake()->createWithContent('copia.mp3', $content),
        ], ['Accept' => 'application/json']);

        $first->assertCreated();
        $second->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertDatabaseCount('songs', 1);
        $this->assertDatabaseCount('media_assets', 1);
        $this->assertCount(1, Storage::disk('media')->allFiles('tracks'));
    }

    public function test_upload_requires_authentication(): void
    {
        $file = UploadedFile::fake()->createWithContent('cancion.mp3', 'contenido');

        $this->post('/api/v1/songs', ['file' => $file], ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_upload_rejects_non_audio_files(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $file = UploadedFile::fake()->createWithContent('notas.txt', 'no soy audio');

        $this->post('/api/v1/songs', ['file' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_uploader_can_delete_song_and_orphan_media_is_removed(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/songs', [
            'file' => UploadedFile::fake()->createWithContent('borrar.mp3', str_repeat('delete-me-', 100)),
        ], ['Accept' => 'application/json'])->assertCreated();

        $songId = $response->json('data.id');

        $this->deleteJson("/api/v1/songs/{$songId}")->assertNoContent();

        $this->assertDatabaseMissing('songs', ['id' => $songId]);
        $this->assertDatabaseCount('media_assets', 0);
        $this->assertCount(0, Storage::disk('media')->allFiles('tracks'));
    }

    public function test_other_users_cannot_delete_a_song(): void
    {
        $song = Song::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertForbidden();
    }

    public function test_deleting_a_song_updates_playlist_counters(): void
    {
        $owner = User::factory()->create();
        $song = Song::factory()->create([
            'duration_ms' => 120_000,
            'uploader_id' => $owner->id,
        ]);
        $playlist = Playlist::factory()->for($owner)->create();

        $playlist->items()->create(['song_id' => $song->id, 'position' => 0]);
        $playlist->recalculateStats();

        $this->assertSame(1, $playlist->fresh()->songs_count);

        Sanctum::actingAs($owner);

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        $playlist->refresh();

        $this->assertSame(0, $playlist->songs_count);
        $this->assertSame(0, $playlist->duration_ms);
    }
}
