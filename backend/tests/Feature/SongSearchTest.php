<?php

namespace Tests\Feature;

use App\Models\Song;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SongSearchTest extends TestCase
{
    /*
     * No usamos RefreshDatabase aquí: el índice FULLTEXT de InnoDB no ve las
     * filas insertadas dentro de la misma transacción del test. Truncar deja
     * los datos comprometidos, que es lo que evaluará MATCH ... AGAINST.
     */
    use DatabaseTruncation;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create());
    }

    public function test_search_ignores_accents(): void
    {
        Song::factory()->create([
            'title' => 'Corazón Salvaje',
            'title_normalized' => 'corazon salvaje',
            'artist_name' => 'Los Corazones',
            'artist_name_normalized' => 'los corazones',
        ]);

        $this->getJson('/api/v1/songs?q=corazon')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Corazón Salvaje');
    }

    public function test_search_normalizes_the_query(): void
    {
        Song::factory()->create([
            'title' => 'Cancion del Sur',
            'title_normalized' => 'cancion del sur',
        ]);

        $this->getJson('/api/v1/songs?q='.urlencode('canción'))
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_short_queries_use_prefix_search(): void
    {
        Song::factory()->create([
            'title' => 'Abismo',
            'title_normalized' => 'abismo',
        ]);

        Song::factory()->create([
            'title' => 'Otra Cosa',
            'title_normalized' => 'otra cosa',
        ]);

        $this->getJson('/api/v1/songs?q=ab')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Abismo');
    }

    public function test_songs_can_be_sorted_by_title(): void
    {
        Song::factory()->create(['title' => 'Zeta', 'title_normalized' => 'zeta']);
        Song::factory()->create(['title' => 'Alfa', 'title_normalized' => 'alfa']);

        $this->getJson('/api/v1/songs?sort=title')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Alfa');
    }

    public function test_search_requires_authentication(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/songs')->assertUnauthorized();
    }
}
