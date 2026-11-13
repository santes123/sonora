<?php

namespace Database\Factories;

use App\Models\Artist;
use App\Support\TextNormalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Artist>
 */
class ArtistFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->name();

        return [
            'name' => $name,
            'name_normalized' => TextNormalizer::normalize($name),
        ];
    }
}
