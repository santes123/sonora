<?php

namespace App\Actions\Songs;

use App\Data\AudioMetadata;
use App\Data\UploadSongData;
use App\Data\UploadSongResult;
use App\Jobs\ExtractCoverArtJob;
use App\Models\Album;
use App\Models\Artist;
use App\Models\MediaAsset;
use App\Models\Song;
use App\Models\User;
use App\Services\Media\MediaStorage;
use App\Services\Media\MetadataExtractor;
use App\Support\TextNormalizer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Subida de una canción con deduplicación por SHA-256.
 *
 * Orden deliberado:
 *  1. Hash en streaming (no carga el archivo en memoria).
 *  2. Si ya existe, se devuelve sin tocar disco ni metadatos.
 *  3. Se extraen metadatos y se guarda el binario con ruta determinista.
 *  4. Transacción corta: asset + artista + álbum + canción.
 *  5. La carátula se procesa en cola.
 */
final class UploadSongAction
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly MetadataExtractor $extractor,
    ) {}

    public function execute(UploadSongData $data, User $user): UploadSongResult
    {
        $sourcePath = $data->file->getRealPath();

        if ($sourcePath === false) {
            throw new RuntimeException('No se pudo acceder al archivo temporal de subida.');
        }

        $hash = hash_file('sha256', $sourcePath);

        if ($hash === false) {
            throw new RuntimeException('No se pudo calcular el hash del archivo.');
        }

        $existing = $this->findByHash($hash);

        if ($existing !== null) {
            return new UploadSongResult($existing, true);
        }

        $metadata = $this->extractor->extract($sourcePath, $data->file->getClientOriginalName());
        $path = $this->pathFor($hash, $metadata->extension);

        $this->storage->putFromPath($sourcePath, $path);

        try {
            $song = DB::transaction(function () use ($hash, $path, $metadata, $data, $user): Song {
                $now = now();

                // insertOrIgnore + select evita carreras con subidas simultáneas
                // del mismo archivo o del mismo artista/álbum.
                MediaAsset::query()->insertOrIgnore([
                    'hash' => $hash,
                    'disk' => config('media.disk', 'media'),
                    'path' => $path,
                    'mime_type' => $metadata->mimeType,
                    'extension' => $metadata->extension,
                    'format' => $metadata->format,
                    'size_bytes' => (int) $data->file->getSize(),
                    'duration_ms' => $metadata->durationMs,
                    'bitrate' => $metadata->bitrate,
                    'sample_rate' => $metadata->sampleRate,
                    'channels' => $metadata->channels,
                    'original_filename' => mb_substr($data->file->getClientOriginalName(), 0, 255),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $asset = MediaAsset::query()->where('hash', $hash)->firstOrFail();

                $artist = $this->resolveArtist($metadata->artist);
                $album = $this->resolveAlbum($metadata, $artist);

                $title = $data->title !== null && trim($data->title) !== ''
                    ? trim($data->title)
                    : $metadata->title;

                return Song::query()->create([
                    'media_asset_id' => $asset->id,
                    'uploader_id' => $user->id,
                    'artist_id' => $artist->id,
                    'album_id' => $album?->id,
                    'title' => mb_substr($title, 0, 255),
                    'title_normalized' => TextNormalizer::normalize($title),
                    'artist_name' => $artist->name,
                    'artist_name_normalized' => $artist->name_normalized,
                    'album_title' => $album?->title,
                    'album_title_normalized' => $album?->title_normalized,
                    'track_number' => $metadata->trackNumber,
                    'disc_number' => $metadata->discNumber,
                    'year' => $metadata->year,
                    'genre' => $metadata->genre !== null ? mb_substr($metadata->genre, 0, 100) : null,
                    'duration_ms' => $metadata->durationMs,
                    'cover_path' => null,
                ]);
            });
        } catch (UniqueConstraintViolationException $exception) {
            // Otra petición ganó la carrera insertando el mismo asset/canción.
            $existing = $this->findByHash($hash);

            if ($existing !== null) {
                return new UploadSongResult($existing, true);
            }

            throw $exception;
        }

        ExtractCoverArtJob::dispatch($song->id);

        return new UploadSongResult(
            $song->load(['artist', 'album', 'mediaAsset', 'uploader']),
            false,
        );
    }

    private function findByHash(string $hash): ?Song
    {
        return Song::query()
            ->with(['artist', 'album', 'mediaAsset', 'uploader'])
            ->whereHas('mediaAsset', static fn ($query) => $query->where('hash', $hash))
            ->first();
    }

    private function resolveArtist(?string $name): Artist
    {
        $name = trim((string) $name);
        $name = $name !== '' ? $name : 'Artista desconocido';
        $normalized = TextNormalizer::normalize($name);
        $normalized = $normalized !== '' ? $normalized : 'artista desconocido';

        $now = now();

        Artist::query()->insertOrIgnore([
            'name' => mb_substr($name, 0, 255),
            'name_normalized' => mb_substr($normalized, 0, 255),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Artist::query()->where('name_normalized', $normalized)->firstOrFail();
    }

    private function resolveAlbum(AudioMetadata $metadata, Artist $songArtist): ?Album
    {
        $title = trim((string) $metadata->albumTitle);

        if ($title === '') {
            return null;
        }

        $albumArtist = $metadata->albumArtist !== null && trim($metadata->albumArtist) !== ''
            ? $this->resolveArtist($metadata->albumArtist)
            : $songArtist;

        $normalized = TextNormalizer::normalize($title);
        $now = now();

        Album::query()->insertOrIgnore([
            'artist_id' => $albumArtist->id,
            'title' => mb_substr($title, 0, 255),
            'title_normalized' => mb_substr($normalized, 0, 255),
            'year' => $metadata->year,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Album::query()
            ->where('artist_id', $albumArtist->id)
            ->where('title_normalized', $normalized)
            ->firstOrFail();
    }

    private function pathFor(string $hash, string $extension): string
    {
        return sprintf(
            'tracks/%s/%s/%s.%s',
            substr($hash, 0, 2),
            substr($hash, 2, 2),
            $hash,
            $extension,
        );
    }
}
