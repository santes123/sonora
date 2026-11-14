<?php

namespace Tests\Feature;

use App\Models\Album;
use App\Models\Artist;
use App\Models\Song;
use App\Models\User;
use App\Services\Media\MetadataExtractor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeMetadataExtractor;
use Tests\TestCase;

class SongEditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('media');
        config(['media.x_accel' => false]);

        $this->app->instance(MetadataExtractor::class, new FakeMetadataExtractor([
            'title' => 'Cancion Original',
            'artist' => 'Artista Original',
            'album' => 'Album Original',
            'duration_ms' => 210_000,
        ]));
    }

    private function uploadSong(User $user): Song
    {
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->createWithContent('cancion.mp3', str_repeat('audio-data-', 200));

        $response = $this->post('/api/v1/songs', ['file' => $file], ['Accept' => 'application/json']);

        $response->assertCreated();

        return Song::query()->firstOrFail();
    }

    public function test_uploader_can_fix_the_title(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $response = $this->patchJson("/api/v1/songs/{$song->id}", [
            'title' => 'Titulo Corregido',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.title', 'Titulo Corregido');

        $this->assertDatabaseHas('songs', [
            'id' => $song->id,
            'title' => 'Titulo Corregido',
        ]);
    }

    public function test_editing_renormalizes_the_title_for_the_fulltext_index(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/songs/{$song->id}", ['title' => '  Canción Ñeñá  '])->assertOk();

        $song->refresh();

        $this->assertSame('Canción Ñeñá', $song->title);
        $this->assertNotSame($song->title, $song->title_normalized);
        $this->assertStringNotContainsString('  ', $song->title);
    }

    public function test_uploader_can_change_the_artist_and_the_denormalized_fields_follow(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $response = $this->patchJson("/api/v1/songs/{$song->id}", [
            'artist_name' => 'Artista Corregido',
        ]);

        $response->assertOk()->assertJsonPath('data.artist_name', 'Artista Corregido');

        $song->refresh();
        $artist = Artist::query()->where('name', 'Artista Corregido')->firstOrFail();

        $this->assertSame($artist->id, $song->artist_id);
        $this->assertSame('Artista Corregido', $song->artist_name);
        $this->assertSame($artist->name_normalized, $song->artist_name_normalized);
    }

    public function test_uploader_can_change_the_album_and_empty_string_removes_it(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/songs/{$song->id}", ['album_title' => 'Otro Album'])
            ->assertOk()
            ->assertJsonPath('data.album_title', 'Otro Album');

        $song->refresh();
        $this->assertNotNull($song->album_id);
        $this->assertSame('Otro Album', Album::query()->findOrFail($song->album_id)->title);

        $this->patchJson("/api/v1/songs/{$song->id}", ['album_title' => ''])
            ->assertOk()
            ->assertJsonPath('data.album_title', null);

        $song->refresh();
        $this->assertNull($song->album_id);
        $this->assertNull($song->album_title);
    }

    public function test_editing_only_the_given_fields_leaves_the_rest_untouched(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/songs/{$song->id}", ['genre' => 'Jazz'])->assertOk();

        $song->refresh();

        $this->assertSame('Jazz', $song->genre);
        $this->assertSame('Cancion Original', $song->title);
        $this->assertSame('Artista Original', $song->artist_name);
    }

    public function test_other_users_cannot_edit_the_song(): void
    {
        $owner = User::factory()->create();
        $song = $this->uploadSong($owner);

        Sanctum::actingAs(User::factory()->create());

        $this->patchJson("/api/v1/songs/{$song->id}", ['title' => 'Secuestrada'])
            ->assertForbidden();

        $this->assertDatabaseHas('songs', ['id' => $song->id, 'title' => 'Cancion Original']);
    }

    public function test_admin_can_edit_the_song_of_another_user(): void
    {
        $owner = User::factory()->create();
        $song = $this->uploadSong($owner);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson("/api/v1/songs/{$song->id}", ['title' => 'Corregida por admin'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Corregida por admin');
    }

    public function test_update_validates_the_input(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/songs/{$song->id}", ['title' => ''])->assertStatus(422);
        $this->patchJson("/api/v1/songs/{$song->id}", ['year' => 1800])->assertStatus(422);
        $this->patchJson("/api/v1/songs/{$song->id}", ['track_number' => 0])->assertStatus(422);
    }

    public function test_uploader_can_upload_a_cover(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $image = UploadedFile::fake()->image('caratula.jpg', 600, 600);

        $response = $this->post("/api/v1/songs/{$song->id}/cover", ['file' => $image], ['Accept' => 'application/json']);

        $response->assertOk();

        $song->refresh();

        $this->assertNotNull($song->cover_path);
        $this->assertStringStartsWith('covers/', $song->cover_path);
        $this->assertStringEndsWith('.webp', $song->cover_path);
        Storage::disk('media')->assertExists($song->cover_path);
    }

    public function test_cover_upload_rejects_non_images(): void
    {
        $user = User::factory()->create();
        $song = $this->uploadSong($user);

        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->createWithContent('cancion.mp3', str_repeat('no-image-', 50));

        $this->post("/api/v1/songs/{$song->id}/cover", ['file' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }

    public function test_other_users_cannot_upload_a_cover(): void
    {
        $owner = User::factory()->create();
        $song = $this->uploadSong($owner);

        Sanctum::actingAs(User::factory()->create());

        $image = UploadedFile::fake()->image('caratula.jpg', 600, 600);

        $this->post("/api/v1/songs/{$song->id}/cover", ['file' => $image], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_editing_requires_authentication(): void
    {
        $owner = User::factory()->create();
        $song = $this->uploadSong($owner);

        // `Sanctum::actingAs` deja al usuario en el guard de la petición, así
        // que hay que olvidarlo para probar el caso sin sesión.
        $this->app['auth']->forgetGuards();

        $this->patchJson("/api/v1/songs/{$song->id}", ['title' => 'Sin sesion'])->assertUnauthorized();
    }
}
