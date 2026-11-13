<?php

namespace Database\Factories;

use App\Models\Album;
use App\Models\Artist;
use App\Support\TextNormalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Album>
 */
class AlbumFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->words(3, true);

        return [
            'artist_id' => Artist::factory(),
            'title' => $title,
            'title_normalized' => TextNormalizer::normalize($title),
            'year' => fake()->numberBetween(1990, 2026),
        ];
    }
}
