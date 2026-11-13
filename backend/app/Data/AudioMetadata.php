<?php

namespace App\Data;

/**
 * Metadatos técnicos extraídos del archivo de audio.
 * DTO inmutable: no depende de Eloquent ni de HTTP.
 */
final readonly class AudioMetadata
{
    public function __construct(
        public string $title,
        public string $artist,
        public ?string $albumTitle,
        public ?string $albumArtist,
        public ?int $trackNumber,
        public ?int $discNumber,
        public ?int $year,
        public ?string $genre,
        public int $durationMs,
        public ?int $bitrate,
        public ?int $sampleRate,
        public ?int $channels,
        public string $format,
        public string $extension,
        public string $mimeType,
        public bool $hasEmbeddedCover,
    ) {}
}
