<?php

namespace App\Actions\Songs;

use App\Data\UpdateSongData;
use App\Models\Song;
use App\Services\Catalog\CatalogResolver;
use App\Support\TextNormalizer;

/**
 * Corrige los metadatos de una canción ya subida.
 *
 * Solo cambia lo que viene en la petición: la presencia del campo decide si
 * se toca (ver `UpdateSongData`). Los campos desnormalizados
 * (`artist_name`, `album_title` y sus versiones normalizadas) se recalculan
 * siempre que cambie el artista o el álbum, para que el FULLTEXT y los
 * listados por artista no se queden desfasados.
 */
final class UpdateSongAction
{
    public function __construct(
        private readonly CatalogResolver $catalog,
    ) {}

    public function execute(Song $song, UpdateSongData $data): Song
    {
        $attributes = [];

        if ($data->has('title')) {
            $title = trim((string) $data->string('title'));

            if ($title === '') {
                throw new \InvalidArgumentException('El título no puede quedar vacío.');
            }

            $attributes['title'] = mb_substr($title, 0, 255);
            $attributes['title_normalized'] = TextNormalizer::normalize($title);
        }

        if ($data->has('artist_name')) {
            $artist = $this->catalog->resolveArtist($data->string('artist_name'));

            $attributes['artist_id'] = $artist->id;
            $attributes['artist_name'] = $artist->name;
            $attributes['artist_name_normalized'] = $artist->name_normalized;
        }

        if ($data->has('album_title')) {
            // Título vacío = la canción se queda sin álbum.
            $album = $this->catalog->resolveAlbum($data->string('album_title'), null, $song->artist);

            $attributes['album_id'] = $album?->id;
            $attributes['album_title'] = $album?->title;
            $attributes['album_title_normalized'] = $album?->title_normalized;
        }

        if ($data->has('track_number')) {
            $attributes['track_number'] = $data->integer('track_number');
        }

        if ($data->has('disc_number')) {
            $attributes['disc_number'] = $data->integer('disc_number');
        }

        if ($data->has('year')) {
            $attributes['year'] = $data->integer('year');
        }

        if ($data->has('genre')) {
            $genre = trim((string) $data->string('genre'));
            $attributes['genre'] = $genre === '' ? null : mb_substr($genre, 0, 100);
        }

        if ($attributes === []) {
            return $song;
        }

        $song->forceFill($attributes)->save();

        return $song->load(['artist', 'album', 'mediaAsset:id,path', 'uploader:id,name']);
    }
}
