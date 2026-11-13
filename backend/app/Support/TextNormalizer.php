<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Normalización única de texto para búsqueda y deduplicación.
 *
 * Se aplica tanto al almacenar (columnas *_normalized) como al consultar, de
 * forma que "Canción", "cancion" y "CANCION" coinciden.
 */
final class TextNormalizer
{
    public static function normalize(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $normalized = Str::ascii($value);
        $normalized = Str::lower($normalized);
        // Mantiene letras (incluidas no latinas) y números; el resto separa.
        $normalized = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $normalized) ?? '';
        $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? '';

        return trim($normalized);
    }

    /**
     * Convierte una búsqueda libre en una expresión BOOLEAN MODE segura.
     *
     * Los términos de menos de 3 caracteres no pueden usar el índice FULLTEXT
     * (innodb_ft_min_token_size); el scope de búsqueda cae a prefijo LIKE.
     */
    public static function toBooleanQuery(?string $query): ?string
    {
        $normalized = self::normalize($query);

        if ($normalized === '') {
            return null;
        }

        $tokens = array_filter(
            explode(' ', $normalized),
            static fn (string $token): bool => mb_strlen($token) >= 3
        );

        if ($tokens === []) {
            return null;
        }

        return implode(' ', array_map(
            static fn (string $token): string => '+'.$token.'*',
            $tokens
        ));
    }
}
