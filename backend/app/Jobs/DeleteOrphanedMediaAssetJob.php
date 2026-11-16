<?php

namespace App\Jobs;

use App\Models\MediaAsset;
use App\Models\Song;
use App\Services\Media\MediaStorage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Borra el binario solo si ya no queda ninguna canción que lo referencie.
 * Se hace en cola para no chocar con una subida concurrente del mismo hash.
 */
final class DeleteOrphanedMediaAssetJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(private readonly int $mediaAssetId) {}

    public function handle(MediaStorage $storage): void
    {
        // `withTrashed`: una canción eliminada lógicamente sigue referenciando
        // su medio (para poder restaurarla), así que no está huérfano.
        if (Song::withTrashed()->where('media_asset_id', $this->mediaAssetId)->exists()) {
            return;
        }

        $asset = MediaAsset::query()->find($this->mediaAssetId);

        if ($asset === null) {
            return;
        }

        $storage->delete($asset->path);
        $asset->delete();
    }
}
