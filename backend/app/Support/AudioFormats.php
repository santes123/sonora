<?php

namespace App\Support;

/**
 * Mapeos entre MIME, extensión y tipo de contenido para los formatos aceptados.
 * La extensión se deriva del MIME real detectado, nunca solo del nombre.
 */
final class AudioFormats
{
    /** @var array<string, string> */
    private const EXTENSION_BY_MIME = [
        'audio/mpeg' => 'mp3',
        'audio/mp3' => 'mp3',
        'audio/flac' => 'flac',
        'audio/x-flac' => 'flac',
        'audio/mp4' => 'm4a',
        'audio/x-m4a' => 'm4a',
        'audio/aac' => 'aac',
        'audio/x-hx-aac-adts' => 'aac',
        'audio/ogg' => 'ogg',
        'application/ogg' => 'ogg',
        'audio/opus' => 'opus',
        'audio/wav' => 'wav',
        'audio/x-wav' => 'wav',
        'audio/wave' => 'wav',
    ];

    /** @var array<string, string> */
    private const MIME_BY_EXTENSION = [
        'mp3' => 'audio/mpeg',
        'flac' => 'audio/flac',
        'm4a' => 'audio/mp4',
        'mp4' => 'audio/mp4',
        'aac' => 'audio/aac',
        'ogg' => 'audio/ogg',
        'opus' => 'audio/ogg',
        'wav' => 'audio/wav',
        'webp' => 'image/webp',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
    ];

    public static function extensionFor(?string $mime, ?string $clientExtension = null): string
    {
        $mime = strtolower((string) $mime);

        if (isset(self::EXTENSION_BY_MIME[$mime])) {
            return self::EXTENSION_BY_MIME[$mime];
        }

        $clientExtension = strtolower((string) $clientExtension);

        if (in_array($clientExtension, config('media.allowed_extensions', []), true)) {
            return $clientExtension;
        }

        return 'mp3';
    }

    public static function mimeForExtension(string $extension): string
    {
        return self::MIME_BY_EXTENSION[strtolower($extension)] ?? 'application/octet-stream';
    }

    public static function isAllowedMime(?string $mime): bool
    {
        return in_array(strtolower((string) $mime), config('media.allowed_mimes', []), true);
    }
}
