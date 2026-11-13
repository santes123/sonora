<?php

namespace App\Console\Commands;

use App\Models\Album;
use App\Models\MediaAsset;
use App\Models\Playlist;
use App\Models\Song;
use App\Services\Media\MediaStorage;
use Illuminate\Console\Command;
use Throwable;

/**
 * Limpieza de medios huérfanos.
 *
 *  - Assets sin canción y con más de 24 h.
 *  - Carátulas no referenciadas por ninguna canción/álbum/playlist.
 *  - Con --deep, ficheros de audio en disco que no existen en la BD.
 */
class MediaGcCommand extends Command
{
    protected $signature = 'media:gc {--deep : Escanea también ficheros de audio no registrados} {--dry-run : Solo muestra lo que borraría}';

    protected $description = 'Elimina medios y carátulas huérfanas para recuperar espacio';

    public function handle(MediaStorage $storage): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $deleted = 0;

        MediaAsset::query()
            ->whereDoesntHave('songs')
            ->where('created_at', '<', now()->subDay())
            ->chunkById(100, function ($assets) use ($storage, $dryRun, &$deleted): void {
                foreach ($assets as $asset) {
                    $this->line(($dryRun ? '[dry-run] ' : '')."Asset huérfano: {$asset->path}");

                    if (! $dryRun) {
                        try {
                            $storage->delete($asset->path);
                        } catch (Throwable) {
                            // El fichero puede no existir; el registro se borra igual.
                        }

                        $asset->delete();
                    }

                    $deleted++;
                }
            });

        $referenced = Song::query()->whereNotNull('cover_path')->pluck('cover_path')
            ->merge(Album::query()->whereNotNull('cover_path')->pluck('cover_path'))
            ->merge(Playlist::withTrashed()->whereNotNull('cover_path')->pluck('cover_path'))
            ->unique()
            ->flip();

        foreach ($storage->allFiles('covers') as $path) {
            if ($referenced->has($path)) {
                continue;
            }

            if ($storage->lastModified($path) > now()->subDays(7)->getTimestamp()) {
                continue;
            }

            $this->line(($dryRun ? '[dry-run] ' : '')."Carátula huérfana: {$path}");

            if (! $dryRun) {
                $storage->delete($path);
            }

            $deleted++;
        }

        if ($this->option('deep')) {
            $known = MediaAsset::query()->pluck('path')->flip();

            foreach ($storage->allFiles('tracks') as $path) {
                if ($known->has($path) || $storage->lastModified($path) > now()->subDay()->getTimestamp()) {
                    continue;
                }

                $this->line(($dryRun ? '[dry-run] ' : '')."Fichero no registrado: {$path}");

                if (! $dryRun) {
                    $storage->delete($path);
                }

                $deleted++;
            }
        }

        $this->info(($dryRun ? 'Se borrarían ' : 'Borrados ').$deleted.' elementos.');

        return self::SUCCESS;
    }
}
