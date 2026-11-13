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

    /**
     * Convierte una imagen binaria en una carátula WebP acotada.
     *
     * @param  array{max_source_kb?: int, max_source_dimension?: int, size?: int, quality?: int}  $limits
     *                                                                                                     Límites de la operación. Si no se pasan, se usan los de
     *                                                                                                     `media.cover`, que son los de las carátulas extraídas del audio.
     */
    public function storeFromBinary(string $binary, array $limits = []): ?string
    {
        $limits += [
            'max_source_kb' => (int) config('media.cover.max_source_kb', 10240),
            'max_source_dimension' => (int) config('media.cover.max_source_dimension', 6000),
            'size' => (int) config('media.cover.size', 800),
            'quality' => (int) config('media.cover.quality', 82),
        ];

        $maxBytes = $limits['max_source_kb'] * 1024;

        if ($binary === '' || strlen($binary) > $maxBytes) {
            return null;
        }

        $info = @getimagesizefromstring($binary);

        if ($info === false) {
            return null;
        }

        [$width, $height] = $info;
        $maxDimension = $limits['max_source_dimension'];

        if ($width < 1 || $height < 1 || $width > $maxDimension || $height > $maxDimension) {
            return null;
        }

        $size = $limits['size'];
        $quality = $limits['quality'];

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
