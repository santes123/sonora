<?php

namespace App\Services\Media;

use Intervention\Image\ImageManager;
use RuntimeException;

/**
 * Convierte cualquier imagen embebida en una carátula WebP acotada.
 *
 * Defensas: límite de bytes, límite de dimensiones (decompression bombs) y
 * re-codificado completo, de modo que nunca se sirve el binario original.
 */
final class CoverArtService
{
    public function __construct(
        private readonly MediaStorage $storage,
    ) {}

    public function storeFromBinary(string $binary): ?string
    {
        $maxBytes = (int) config('media.cover.max_source_kb', 10240) * 1024;

        if ($binary === '' || strlen($binary) > $maxBytes) {
            return null;
        }

        $info = @getimagesizefromstring($binary);

        if ($info === false) {
            return null;
        }

        [$width, $height] = $info;
        $maxDimension = (int) config('media.cover.max_source_dimension', 4000);

        if ($width < 1 || $height < 1 || $width > $maxDimension || $height > $maxDimension) {
            return null;
        }

        $size = (int) config('media.cover.size', 800);
        $quality = (int) config('media.cover.quality', 82);

        try {
            $encoded = ImageManager::gd()
                ->read($binary)
                ->cover($size, $size)
                ->toWebp($quality)
                ->toString();
        } catch (RuntimeException) {
            return null;
        }

        $hash = hash('sha256', $encoded);
        $path = sprintf('covers/%s/%s/%s.webp', substr($hash, 0, 2), substr($hash, 2, 2), $hash);

        $this->storage->putContents($encoded, $path);

        return $path;
    }
}
