<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\Song;
use App\Models\User;
use App\Services\Media\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MediaGcTest extends TestCase
{
    use RefreshDatabase;

    public function test_gc_deletes_orphan_media_assets_older_than_one_day(): void
    {
        $storage = $this->app->make(MediaStorage::class);
        $orphanPath = 'tracks/test/orphan.mp3';
        $storage->putContents('dummy-audio', $orphanPath);

        $orphanAsset = MediaAsset::factory()->create([
            'path' => $orphanPath,
            'created_at' => now()->subDays(2),
        ]);

        $recentAsset = MediaAsset::factory()->create([
            'created_at' => now()->subHours(2),
        ]);

        $this->artisan('media:gc')
            ->assertSuccessful();

        $this->assertDatabaseMissing('media_assets', ['id' => $orphanAsset->id]);
        $this->assertDatabaseHas('media_assets', ['id' => $recentAsset->id]);
        $this->assertFalse($storage->exists($orphanPath));
    }

    public function test_gc_does_not_delete_media_assets_linked_to_songs(): void
    {
        $user = User::factory()->create();
        $song = Song::factory()->create(['uploader_id' => $user->id]);
        $asset = $song->mediaAsset;
        $asset->update(['created_at' => now()->subDays(3)]);

        $this->artisan('media:gc')
            ->assertSuccessful();

        $this->assertDatabaseHas('media_assets', ['id' => $asset->id]);
    }

    public function test_gc_dry_run_does_not_delete_records(): void
    {
        $orphanAsset = MediaAsset::factory()->create([
            'created_at' => now()->subDays(2),
        ]);

        $this->artisan('media:gc --dry-run')
            ->assertSuccessful();

        $this->assertDatabaseHas('media_assets', ['id' => $orphanAsset->id]);
    }
}
