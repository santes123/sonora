<?php

namespace Tests\Feature;

use App\Http\Requests\Offline\DownloadUrlsRequest;
use App\Models\MediaAsset;
use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OfflineDownloadUrlsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('media');
        config(['media.x_accel' => false]);
    }

    public function test_authenticated_user_can_request_signed_urls_for_songs(): void
    {
        $user = User::factory()->create();
        $songs = Song::factory()->count(2)->create();
        Sanctum::actingAs($user);

        $response = $this->post('/api/v1/offline/urls', [
            'song_ids' => $songs->pluck('id')->all(),
        ], ['Accept' => 'application/json'])->assertOk();

        $response->assertJsonCount(2, 'data');
        $response->assertJsonStructure([
            'data' => [
                ['song_id', 'url', 'bytes'],
            ],
        ]);

        $first = $response->json('data.0');

        $this->assertSame($songs->first()->id, $first['song_id']);
        $this->assertStringContainsString('/api/v1/media/', $first['url']);
        $this->assertGreaterThan(0, $first['bytes']);
    }

    public function test_the_response_keeps_the_requested_order(): void
    {
        $songs = Song::factory()->count(3)->create();
        Sanctum::actingAs(User::factory()->create());

        $ids = $songs->pluck('id')->reverse()->values()->all();

        $response = $this->post('/api/v1/offline/urls', [
            'song_ids' => $ids,
        ], ['Accept' => 'application/json'])->assertOk();

        $returned = array_column($response->json('data'), 'song_id');

        $this->assertSame($ids, $returned);
    }

    public function test_the_signed_url_can_be_used_to_stream_the_file(): void
    {
        $asset = MediaAsset::factory()->create([
            'extension' => 'mp3',
            'mime_type' => 'audio/mpeg',
        ]);

        Storage::disk('media')->put($asset->path, '0123456789');

        $song = Song::factory()->create(['media_asset_id' => $asset->id]);

        Sanctum::actingAs(User::factory()->create());

        $url = $this->post('/api/v1/offline/urls', [
            'song_ids' => [$song->id],
        ], ['Accept' => 'application/json'])->assertOk()->json('data.0.url');

        // La URL es relativa al mismo origen: se resuelve contra el host de
        // la API y sirve el fichero con soporte de Range.
        $response = $this->get($url)->assertOk();

        $this->assertSame('0123456789', $response->streamedContent());
    }

    public function test_songs_are_skipped_when_the_file_is_not_stored(): void
    {
        $song = Song::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $response = $this->post('/api/v1/offline/urls', [
            'song_ids' => [$song->id],
        ], ['Accept' => 'application/json'])->assertOk();

        // La canción existe y tiene medio asociado, así que recibe su URL:
        // el 404 arrives al descargar, no al pedir el permiso.
        $this->assertCount(1, $response->json('data'));
        $this->assertStringContainsString('/api/v1/media/', $response->json('data.0.url'));
    }

    public function test_guest_cannot_request_signed_urls(): void
    {
        $song = Song::factory()->create();

        $this->post('/api/v1/offline/urls', [
            'song_ids' => [$song->id],
        ], ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_song_ids_are_required(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->post('/api/v1/offline/urls', [], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('song_ids');
    }

    public function test_unknown_song_ids_are_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->post('/api/v1/offline/urls', [
            'song_ids' => [999999],
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('song_ids.0');
    }

    public function test_duplicated_song_ids_are_rejected(): void
    {
        $song = Song::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->post('/api/v1/offline/urls', [
            'song_ids' => [$song->id, $song->id],
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('song_ids.1');
    }

    public function test_the_batch_size_is_capped(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $ids = range(1, DownloadUrlsRequest::MAX_SONGS + 1);

        $this->post('/api/v1/offline/urls', [
            'song_ids' => $ids,
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('song_ids');
    }
}
