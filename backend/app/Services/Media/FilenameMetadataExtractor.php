<?php

namespace App\Services\Media;

use App\Data\AudioMetadata;
use App\Support\AudioFormats;

/**
 * Extractor de último recurso: deriva los metadatos del nombre del archivo.
 * Nunca falla, de forma que una subida válida no se pierde porque falte ffprobe.
 */
final class FilenameMetadataExtractor implements MetadataExtractor
{
    public function extract(string $absolutePath, ?string $originalName = null): AudioMetadata
    {
        $filename = $originalName ?: basename($absolutePath);
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION)) ?: 'mp3';
        $mime = AudioFormats::mimeForExtension($extension);
        $size = @filesize($absolutePath) ?: 0;

        $title = pathinfo($filename, PATHINFO_FILENAME);
        $title = trim((string) preg_replace('/[_\-]+/', ' ', $title)) ?: 'Sin título';

        // Estimación conservadora (128 kbps) cuando no hay ffprobe disponible.
        $durationMs = $size > 0 ? (int) round(($size * 8) / 128_000 * 1000) : 0;

        return new AudioMetadata(
            title: $title,
            artist: 'Artista desconocido',
            albumTitle: null,
            albumArtist: null,
            trackNumber: null,
            discNumber: null,
            year: null,
            genre: null,
            durationMs: $durationMs,
            bitrate: null,
            sampleRate: null,
            channels: null,
            format: $extension,
            extension: AudioFormats::extensionFor($mime, $extension),
            mimeType: $mime,
            hasEmbeddedCover: false,
        );
    }
}
