<?php

namespace App\Services\Media;

use App\Data\AudioMetadata;
use App\Support\AudioFormats;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Extractor principal basado en ffprobe (rápido y fiable con MP3/FLAC/M4A/OGG).
 *
 * Si ffprobe falla o no está instalado, delega en FilenameMetadataExtractor
 * para no perder la subida. El procesado de carátula va aparte y en cola.
 */
final class FfprobeMetadataExtractor implements MetadataExtractor
{
    public function __construct(
        private readonly FilenameMetadataExtractor $fallback,
    ) {}

    public function extract(string $absolutePath, ?string $originalName = null): AudioMetadata
    {
        $fallback = $this->fallback->extract($absolutePath, $originalName);

        $process = new Process([
            (string) config('media.ffprobe', 'ffprobe'),
            '-v', 'error',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            $absolutePath,
        ]);

        $process->setTimeout((float) config('media.ffprobe_timeout', 30));

        try {
            $process->run();
        } catch (Throwable $exception) {
            Log::warning('ffprobe no se pudo ejecutar; se usan metadatos del nombre.', [
                'file' => $originalName ?? basename($absolutePath),
                'error' => $exception->getMessage(),
            ]);

            return $fallback;
        }

        if (! $process->isSuccessful()) {
            Log::warning('ffprobe devolvió un error; se usan metadatos del nombre.', [
                'file' => $originalName ?? basename($absolutePath),
                'error' => trim($process->getErrorOutput()),
            ]);

            return $fallback;
        }

        $data = json_decode($process->getOutput(), true);

        if (! is_array($data)) {
            return $fallback;
        }

        $streams = is_array($data['streams'] ?? null) ? $data['streams'] : [];
        $format = is_array($data['format'] ?? null) ? $data['format'] : [];

        $audioStream = $this->firstAudioStream($streams);

        if ($audioStream === null) {
            return $fallback;
        }

        $formatTags = $this->lowercaseKeys($format['tags'] ?? []);
        $streamTags = $this->lowercaseKeys($audioStream['tags'] ?? []);
        // Los tags del stream (ID3v2) tienen prioridad sobre los del contenedor.
        $tags = $streamTags + $formatTags;

        $mime = $this->detectMime($absolutePath, $fallback->mimeType);
        $extension = AudioFormats::extensionFor($mime, $fallback->extension);

        $title = $this->tag($tags, ['title', 'tit2', '©nam'])
            ?? $fallback->title;

        $artist = $this->tag($tags, ['artist', 'tpe1', '©art', 'performer'])
            ?? $fallback->artist;

        $albumArtist = $this->tag($tags, ['album_artist', 'albumartist', 'tpe2', 'aART']);

        $durationMs = (int) round(((float) ($format['duration'] ?? 0)) * 1000);

        if ($durationMs <= 0) {
            $durationMs = (int) round(((float) ($audioStream['duration'] ?? 0)) * 1000);
        }

        $bitrate = (int) ($format['bit_rate'] ?? $audioStream['bit_rate'] ?? 0);

        return new AudioMetadata(
            title: $title,
            artist: $artist,
            albumTitle: $this->tag($tags, ['album', 'talb', '©alb']),
            albumArtist: $albumArtist,
            trackNumber: $this->number($this->tag($tags, ['track', 'trck', 'trkn'])),
            discNumber: $this->number($this->tag($tags, ['disc', 'disk', 'tpos'])),
            year: $this->year($this->tag($tags, ['date', 'year', 'tyer', 'tdrc', '©day'])),
            genre: $this->tag($tags, ['genre', 'tcon', '©gen']),
            durationMs: max(0, $durationMs),
            bitrate: $bitrate > 0 ? intdiv($bitrate, 1000) : null,
            sampleRate: isset($audioStream['sample_rate']) ? (int) $audioStream['sample_rate'] : null,
            channels: isset($audioStream['channels']) ? (int) $audioStream['channels'] : null,
            format: $this->formatName($format, $extension),
            extension: $extension,
            mimeType: $mime,
            hasEmbeddedCover: $this->hasCoverStream($streams),
        );
    }

    /** @param array<int, array<string, mixed>> $streams */
    private function firstAudioStream(array $streams): ?array
    {
        foreach ($streams as $stream) {
            if (($stream['codec_type'] ?? null) === 'audio') {
                return $stream;
            }
        }

        return null;
    }

    /** @param array<int, array<string, mixed>> $streams */
    private function hasCoverStream(array $streams): bool
    {
        foreach ($streams as $stream) {
            if (($stream['codec_type'] ?? null) !== 'video') {
                continue;
            }

            if (($stream['disposition']['attached_pic'] ?? 0) === 1) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $tags */
    private function tag(array $tags, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $tags[strtolower($key)] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }

            if (is_int($value) || is_float($value)) {
                return (string) $value;
            }
        }

        return null;
    }

    private function number(?string $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (preg_match('/\d+/', $value, $matches) !== 1) {
            return null;
        }

        $number = (int) $matches[0];

        return $number > 0 ? $number : null;
    }

    private function year(?string $value): ?int
    {
        if ($value === null || preg_match('/(\d{4})/', $value, $matches) !== 1) {
            return null;
        }

        $year = (int) $matches[1];

        return $year >= 1900 && $year <= (int) date('Y') + 1 ? $year : null;
    }

    /** @param array<string, mixed> $format */
    private function formatName(array $format, string $fallback): string
    {
        $name = (string) ($format['format_name'] ?? '');

        if ($name === '') {
            return $fallback;
        }

        return explode(',', $name)[0];
    }

    private function detectMime(string $path, string $fallback): string
    {
        $detected = @(new \finfo(FILEINFO_MIME_TYPE))->file($path);

        return is_string($detected) && AudioFormats::isAllowedMime($detected)
            ? $detected
            : $fallback;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function lowercaseKeys(array $values): array
    {
        $result = [];

        foreach ($values as $key => $value) {
            $result[strtolower((string) $key)] = $value;
        }

        return $result;
    }
}
