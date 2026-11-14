<?php

namespace App\Data;

/**
 * Metadatos corregibles de una canción.
 *
 * La edición es parcial, así que la clave es la presencia del campo, no su
 * valor: una clave ausente significa "no lo toques" y una clave presente con
 * valor null significa "vacíalo" (quitar el álbum, el género, el año...).
 *
 * Confundir ambos casos con un `?string` a null era un error real: al enviar
 * `album_title: ""` (que Laravel convierte a null) la canción se quedaba con
 * su álbum, porque null significaba "no tocar".
 */
final readonly class UpdateSongData
{
    /**
     * @param  array<string, mixed>  $changes  solo las claves presentes en la petición
     */
    public function __construct(
        public array $changes = [],
    ) {}

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->changes);
    }

    public function string(string $key): ?string
    {
        $value = $this->changes[$key] ?? null;

        return $value === null ? null : (string) $value;
    }

    public function integer(string $key): ?int
    {
        $value = $this->changes[$key] ?? null;

        return $value === null ? null : (int) $value;
    }
}
