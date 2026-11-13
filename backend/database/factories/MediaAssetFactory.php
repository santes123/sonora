<?php

namespace Database\Factories;

use App\Models\MediaAsset;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MediaAsset>
 */
class MediaAssetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $hash = bin2hex(random_bytes(32));
        $extension = fake()->randomElement(['mp3', 'flac', 'm4a', 'ogg']);

        return [
            'hash' => $hash,
            'disk' => 'media',
            // Closures: `path` y `mime_type` deben derivar de la `extension`
            // final (puede venir sobreescrita por el test), no de la aleatoria.
            'path' => fn (array $attributes): string => sprintf(
                'tracks/%s/%s/%s.%s',
                substr($attributes['hash'], 0, 2),
                substr($attributes['hash'], 2, 2),
                $attributes['hash'],
                $attributes['extension'],
            ),
            'mime_type' => fn (array $attributes): string => $attributes['extension'] === 'mp3'
                ? 'audio/mpeg'
                : 'audio/'.$attributes['extension'],
            'extension' => $extension,
            'format' => $extension,
            'size_bytes' => fake()->numberBetween(1_000_000, 40_000_000),
            'duration_ms' => fake()->numberBetween(60_000, 420_000),
            'bitrate' => fake()->numberBetween(128, 320),
            'sample_rate' => 44_100,
            'channels' => 2,
            'original_filename' => 'cancion.'.$extension,
        ];
    }
}
