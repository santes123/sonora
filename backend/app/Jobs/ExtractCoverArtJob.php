<?php

namespace App\Jobs;

use App\Models\Song;
use App\Services\Media\CoverArtService;
use App\Services\Media\MediaStorage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Extrae la portada embebida con ffmpeg y la convierte a WebP.
 * Se ejecuta en la cola "media" para no bloquear la subida.
 */
final class ExtractCoverArtJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 120;

    /** @var list<int> */
    public array $backoff = [10, 60];

    public function __construct(private readonly int $songId) {}

    public function handle(MediaStorage $storage, CoverArtService $covers): void
    {
        $song = Song::query()->with(['album', 'mediaAsset'])->find($this->songId);

        if ($song === null || $song->cover_path !== null || $song->mediaAsset === null) {
            return;
        }

        $sourcePath = $storage->absolutePath($song->mediaAsset->path);
        $temporaryPath = null;

        try {
            if ($sourcePath === null) {
                // Driver remoto (S3/MinIO): se descarga a un temporal acotado.
                $temporaryPath = tempnam(sys_get_temp_dir(), 'sonora-cover-');

                if ($temporaryPath === false) {
                    return;
                }

                file_put_contents($temporaryPath, $storage->get($song->mediaAsset->path));
                $sourcePath = $temporaryPath;
            }

            $binary = $this->extractWithFfmpeg($sourcePath);

            if ($binary === null) {
                return;
            }

            $path = $covers->storeFromBinary($binary);

            if ($path === null) {
                return;
            }

            $song->forceFill(['cover_path' => $path])->saveQuietly();

            if ($song->album !== null && $song->album->cover_path === null) {
                $song->album->forceFill(['cover_path' => $path])->saveQuietly();
            }
        } finally {
            if ($temporaryPath !== null && is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }

    private function extractWithFfmpeg(string $sourcePath): ?string
    {
        $process = new Process([
            (string) config('media.ffmpeg', 'ffmpeg'),
            '-v', 'error',
            '-i', $sourcePath,
            '-map', '0:v:0',
            '-frames:v', '1',
            '-c:v', 'mjpeg',
            '-f', 'image2pipe',
            'pipe:1',
        ]);

        $process->setTimeout(60);

        try {
            $process->run();
        } catch (Throwable) {
            return null;
        }

        if (! $process->isSuccessful()) {
            return null;
        }

        $output = $process->getOutput();

        return $output !== '' ? $output : null;
    }
}
