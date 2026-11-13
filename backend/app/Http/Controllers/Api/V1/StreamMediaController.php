<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Media\MediaStorage;
use App\Support\AudioFormats;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

/**
 * Entrega de medios con URL firmada.
 *
 * - Producción: responde X-Accel-Redirect y Nginx sirve el fichero (Range nativo).
 * - Local: BinaryFileResponse, que implementa Range/206 correctamente.
 */
class StreamMediaController extends Controller
{
    private const ALLOWED_EXTENSIONS = [
        'mp3', 'flac', 'm4a', 'mp4', 'aac', 'ogg', 'opus', 'wav',
        'webp', 'jpg', 'jpeg', 'png',
    ];

    public function __invoke(Request $request, string $token, MediaStorage $storage): Response
    {
        $path = $this->decodePath($token);

        abort_if($path === null, 404);
        abort_unless($storage->exists($path), 404);

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $headers = [
            'Content-Type' => AudioFormats::mimeForExtension($extension),
            'Cache-Control' => 'private, max-age=3600',
            'Accept-Ranges' => 'bytes',
            'X-Content-Type-Options' => 'nosniff',
        ];

        $xAccel = $storage->xAccelPath($path);

        if ($xAccel !== null) {
            return response('', 200, $headers + ['X-Accel-Redirect' => $xAccel]);
        }

        $absolutePath = $storage->absolutePath($path);

        abort_if($absolutePath === null || ! is_file($absolutePath), 404);

        $response = new BinaryFileResponse($absolutePath, 200, $headers);
        $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_INLINE);

        return $response;
    }

    private function decodePath(string $token): ?string
    {
        $decoded = base64_decode(strtr($token, '-_', '+/'), true);

        if (! is_string($decoded) || $decoded === '') {
            return null;
        }

        if (str_starts_with($decoded, '/') || str_contains($decoded, '..') || str_contains($decoded, '\\')) {
            return null;
        }

        if (preg_match('#^[A-Za-z0-9._/-]+$#', $decoded) !== 1) {
            return null;
        }

        $extension = strtolower(pathinfo($decoded, PATHINFO_EXTENSION));

        return in_array($extension, self::ALLOWED_EXTENSIONS, true) ? $decoded : null;
    }
}
