<?php

namespace Database\Factories;

use App\Models\Artist;
use App\Models\MediaAsset;
use App\Models\Song;
use App\Models\User;
use App\Support\TextNormalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Song>
 */
class SongFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->sentence(3);
        $artistName = fake()->name();
        $albumTitle = fake()->words(2, true);

        return [
            'media_asset_id' => MediaAsset::factory(),
            'uploader_id' => User::factory(),
            'artist_id' => Artist::factory()->state([
                'name' => $artistName,
                'name_normalized' => TextNormalizer::normalize($artistName),
            ]),
            'album_id' => null,
            'title' => $title,
            'title_normalized' => TextNormalizer::normalize($title),
            'artist_name' => $artistName,
            'artist_name_normalized' => TextNormalizer::normalize($artistName),
            'album_title' => $albumTitle,
            'album_title_normalized' => TextNormalizer::normalize($albumTitle),
            'track_number' => fake()->numberBetween(1, 20),
            'disc_number' => 1,
            'year' => fake()->numberBetween(1990, 2026),
            'genre' => fake()->randomElement(['Rock', 'Pop', 'Jazz', 'Electrónica']),
            'duration_ms' => fake()->numberBetween(60_000, 420_000),
        ];
    }
}
