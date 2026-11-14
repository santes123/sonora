<?php

namespace App\Services\Catalog;

use App\Models\Album;
use App\Models\Artist;
use App\Support\TextNormalizer;

/**
 * Resuelve (o crea) las entidades de catálogo associate a una canción.
 *
 * Artistas y álbumes son entidades normalizadas (con su propia tabla) porque
 * el catálogo se comparte entre usuarios: si dos canciones del mismo artista
 * tuvieran dos filas distintas, los listados y la búsqueda se partirían.
 *
 * Live en un servicio propio, y no dentro de la acción de subida, para que la
 * edición de metadatos aplique exactamente las mismas reglas que la subida
 * (mismo normalizado, mismo "artista desconocido", mismo behaviour cuando
 * el álbum no tiene artista propio).
 */
final class CatalogResolver
{
    /**
     * Devuelve el artista con ese nombre, creándolo si no existe.
     */
    public function resolveArtist(?string $name): Artist
    {
        $name = trim((string) $name);
        $name = $name !== '' ? $name : 'Artista desconocido';
        $normalized = TextNormalizer::normalize($name);
        $normalized = $normalized !== '' ? $normalized : 'artista desconocido';

        $now = now();

        Artist::query()->insertOrIgnore([
            'name' => mb_substr($name, 0, 255),
            'name_normalized' => mb_substr($normalized, 0, 255),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Artist::query()->where('name_normalized', $normalized)->firstOrFail();
    }

    /**
     * Devuelve el álbum con ese título para el artista dado, creándolo si no
     * existe. Si el título viene vacío, la canción se queda sin álbum.
     */
    public function resolveAlbum(?string $title, ?string $albumArtist, Artist $songArtist, ?int $year = null): ?Album
    {
        $title = trim((string) $title);

        if ($title === '') {
            return null;
        }

        $albumArtistName = trim((string) $albumArtist);
        $owner = $albumArtistName !== ''
            ? $this->resolveArtist($albumArtistName)
            : $songArtist;

        $normalized = TextNormalizer::normalize($title);
        $now = now();

        Album::query()->insertOrIgnore([
            'artist_id' => $owner->id,
            'title' => mb_substr($title, 0, 255),
            'title_normalized' => mb_substr($normalized, 0, 255),
            'year' => $year,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return Album::query()
            ->where('artist_id', $owner->id)
            ->where('title_normalized', $normalized)
            ->firstOrFail();
    }
}
