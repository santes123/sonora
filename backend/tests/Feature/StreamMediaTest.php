<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\Song;
use App\Services\Media\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StreamMediaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('media');
        config(['media.x_accel' => false]);
    }

    public function test_signed_url_streams_the_file(): void
    {
        [$asset, $song] = $this->songWithFile('0123456789');

        $url = app(MediaStorage::class)->temporaryUrl($asset->path);

        $response = $this->get($url)
            ->assertOk()
            ->assertHeader('Content-Type', 'audio/mpeg');

        // BinaryFileResponse no materializa el cuerpo en getContent(); se lee
        // con streamedContent(), que ejecuta sendContent() capturando la salida.
        $this->assertSame('0123456789', $response->streamedContent());
        $this->assertSame($song->id, $song->id);
    }

    public function test_range_requests_return_partial_content(): void
    {
        [$asset] = $this->songWithFile('0123456789');

        $url = app(MediaStorage::class)->temporaryUrl($asset->path);

        $response = $this->get($url, ['Range' => 'bytes=2-5'])
            ->assertStatus(206)
            ->assertHeader('Content-Range', 'bytes 2-5/10');

        $this->assertSame('2345', $response->streamedContent());
    }

    public function test_tampered_url_is_rejected(): void
    {
        [$asset] = $this->songWithFile('0123456789');

        $url = app(MediaStorage::class)->temporaryUrl($asset->path);
        $tampered = substr($url, 0, -2).'aa';

        $this->get($tampered)->assertForbidden();
    }

    public function test_missing_file_returns_not_found(): void
    {
        $asset = MediaAsset::factory()->create();

        $url = app(MediaStorage::class)->temporaryUrl($asset->path);

        $this->get($url)->assertNotFound();
    }

    /**
     * @return array{0: MediaAsset, 1: Song}
     */
    private function songWithFile(string $contents): array
    {
        $asset = MediaAsset::factory()->create([
            'extension' => 'mp3',
            'mime_type' => 'audio/mpeg',
        ]);

        Storage::disk('media')->put($asset->path, $contents);

        $song = Song::factory()->create(['media_asset_id' => $asset->id]);

        return [$asset, $song];
    }
}
