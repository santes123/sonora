<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlaylistCoverTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('media');
        config(['media.x_accel' => false]);
    }

    public function test_owner_can_upload_a_playlist_cover(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $response = $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('portada.png', $this->pngBytes()),
        ], ['Accept' => 'application/json'])->assertOk();

        $playlist->refresh();

        $this->assertNotNull($playlist->cover_path);
        $this->assertStringStartsWith('covers/', $playlist->cover_path);
        $this->assertNotNull($response->json('data.cover_url'));
        $this->assertTrue(Storage::disk('media')->exists($playlist->cover_path));
    }

    public function test_the_uploaded_cover_is_converted_to_webp(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('portada.png', $this->pngBytes()),
        ], ['Accept' => 'application/json'])->assertOk();

        $playlist->refresh();

        $contents = Storage::disk('media')->get($playlist->cover_path);

        // Firma RIFF....WEBP de los ficheros WebP.
        $this->assertSame('RIFF', substr($contents, 0, 4));
        $this->assertSame('WEBP', substr($contents, 8, 4));
        $this->assertStringEndsWith('.webp', $playlist->cover_path);
    }

    public function test_uploading_a_cover_replaces_the_previous_one(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('una.png', $this->pngBytes(64, 64, 139, 92, 246)),
        ], ['Accept' => 'application/json'])->assertOk();

        $first = $playlist->refresh()->cover_path;

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('otra.png', $this->pngBytes(96, 96, 244, 114, 182)),
        ], ['Accept' => 'application/json'])->assertOk();

        $playlist->refresh();

        $this->assertNotSame($first, $playlist->cover_path);
        $this->assertTrue(Storage::disk('media')->exists($playlist->cover_path));
    }

    public function test_other_users_cannot_upload_a_cover(): void
    {
        $playlist = Playlist::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('portada.png', $this->pngBytes()),
        ], ['Accept' => 'application/json'])->assertForbidden();

        $this->assertNull($playlist->refresh()->cover_path);
    }

    public function test_guest_cannot_upload_a_cover(): void
    {
        $playlist = Playlist::factory()->create();

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('portada.png', $this->pngBytes()),
        ], ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_uploading_requires_a_file(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_non_image_files_are_rejected(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent('notas.txt', 'no soy una imagen'),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');

        $this->assertNull($playlist->refresh()->cover_path);
    }

    public function test_images_above_the_dimension_limit_are_rejected(): void
    {
        $user = User::factory()->create();
        $playlist = Playlist::factory()->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $limit = (int) config('media.playlist_cover.max_source_dimension', 2500);

        // Una imagen mayor que el límite se rechaza sin llegar a decodificarse
        // en memoria: es la defensa contra las decompression bombs.
        $this->post("/api/v1/playlists/{$playlist->id}/cover", [
            'file' => UploadedFile::fake()->createWithContent(
                'enorme.png',
                $this->pngBytes($limit + 10, $limit + 10),
            ),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');

        $this->assertNull($playlist->refresh()->cover_path);
    }

    /**
     * Genera bytes PNG reales con GD.
     */
    private function pngBytes(int $width = 64, int $height = 64, int $r = 139, int $g = 92, int $b = 246): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, $r, $g, $b));

        ob_start();
        imagepng($image);
        $bytes = ob_get_clean();

        imagedestroy($image);

        return $bytes;
    }
}
