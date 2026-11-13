<?php

namespace Tests\Support;

use App\Data\AudioMetadata;
use App\Services\Media\MetadataExtractor;

final class FakeMetadataExtractor implements MetadataExtractor
{
    /**
     * @param  array<string, mixed>  $overrides
     */
    public function __construct(private readonly array $overrides = []) {}

    public function extract(string $absolutePath, ?string $originalName = null): AudioMetadata
    {
        $filename = $originalName ?? basename($absolutePath);
        $title = $this->overrides['title'] ?? pathinfo($filename, PATHINFO_FILENAME);

        return new AudioMetadata(
            title: (string) $title,
            artist: (string) ($this->overrides['artist'] ?? 'Artista de Prueba'),
            albumTitle: $this->overrides['album'] ?? 'Álbum de Prueba',
            albumArtist: $this->overrides['album_artist'] ?? null,
            trackNumber: $this->overrides['track'] ?? 1,
            discNumber: 1,
            year: $this->overrides['year'] ?? 2026,
            genre: 'Test',
            durationMs: $this->overrides['duration_ms'] ?? 180_000,
            bitrate: 192,
            sampleRate: 44_100,
            channels: 2,
            format: 'mp3',
            extension: 'mp3',
            mimeType: 'audio/mpeg',
            hasEmbeddedCover: false,
        );
    }
}
