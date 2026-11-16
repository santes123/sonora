<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\Playlist;
use App\Models\Song;
use App\Models\User;
use App\Services\Media\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Borrado lógico de canciones.
 *
 * Al eliminar una canción desaparece del catálogo y deja de reproducirse,
 * pero sigue en las playlists de otras personas, marcada como no disponible.
 */
class SongDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('media');
        config(['media.x_accel' => false]);
    }

    public function test_a_deleted_song_disappears_from_the_catalogue(): void
    {
        $song = $this->makeSong();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/songs')->assertOk()
            ->assertJsonPath('data.0.id', $song->id);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        $this->getJson('/api/v1/songs')->assertOk()
            ->assertJsonPath('data', []);

        $this->getJson("/api/v1/songs/{$song->id}")->assertNotFound();
    }

    public function test_a_deleted_song_stays_in_the_playlist_marked_as_unavailable(): void
    {
        $owner = User::factory()->create();
        $song = $this->makeSong();
        $playlist = Playlist::factory()->for($owner)->create();

        $playlist->items()->create(['song_id' => $song->id, 'position' => 0]);
        $playlist->recalculateStats();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        $this->getJson("/api/v1/playlists/{$playlist->id}")->assertOk()
            ->assertJsonPath('data.items.0.song.id', $song->id)
            ->assertJsonPath('data.items.0.song.is_deleted', true)
            ->assertJsonPath('data.items.0.song.stream_url', null);
    }

    public function test_a_deleted_song_cannot_be_streamed_with_an_old_signed_url(): void
    {
        [$asset, $song] = $this->songWithFile('contenido-audio');

        $url = app(MediaStorage::class)->temporaryUrl($asset->path, songId: $song->id);

        $this->get($url)->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        // La URL sigue siendo válida (la firma no cambia), pero el medio ya no
        // se sirve: la canción está eliminada.
        $this->get($url)->assertNotFound();
    }

    public function test_the_audio_file_is_kept_after_deleting(): void
    {
        [$asset, $song] = $this->songWithFile('contenido-audio');

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        Storage::disk('media')->assertExists($asset->path);
        $this->assertDatabaseHas('media_assets', ['id' => $asset->id]);
    }

    public function test_an_admin_can_restore_a_deleted_song(): void
    {
        $song = $this->makeSong();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        $this->postJson("/api/v1/songs/{$song->id}/restore")->assertOk()
            ->assertJsonPath('data.id', $song->id)
            ->assertJsonPath('data.is_deleted', false);

        $this->assertNull($song->fresh()->deleted_at);

        $this->getJson('/api/v1/songs')->assertOk()
            ->assertJsonPath('data.0.id', $song->id);
    }

    public function test_only_an_admin_can_restore_a_song(): void
    {
        $song = $this->makeSong();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/songs/{$song->id}/restore")->assertForbidden();

        $this->assertNotNull($song->fresh()->deleted_at);
    }

    public function test_a_restored_song_is_streamable_again(): void
    {
        [$asset, $song] = $this->songWithFile('contenido-audio');

        $url = app(MediaStorage::class)->temporaryUrl($asset->path, songId: $song->id);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();
        $this->postJson("/api/v1/songs/{$song->id}/restore")->assertOk();

        $this->get($url)->assertOk();
    }

    public function test_a_deleted_song_is_not_offered_for_offline_download(): void
    {
        $song = $this->makeSong();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/v1/songs/{$song->id}")->assertNoContent();

        $this->postJson('/api/v1/offline/urls', ['song_ids' => [$song->id]])->assertOk()
            ->assertJsonPath('data', []);
    }

    /**
     * @return array{0: MediaAsset, 1: Song}
     */
    private function songWithFile(string $contents = 'contenido-audio'): array
    {
        $asset = MediaAsset::factory()->create([
            'extension' => 'mp3',
            'mime_type' => 'audio/mpeg',
        ]);

        Storage::disk('media')->put($asset->path, $contents);

        $song = Song::factory()->create(['media_asset_id' => $asset->id]);

        return [$asset, $song];
    }

    private function makeSong(): Song
    {
        [, $song] = $this->songWithFile();

        return $song;
    }
}
