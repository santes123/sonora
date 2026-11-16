<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ajustes del sitio: registro privado e indexación bloqueada.
 */
class SiteSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_are_closed_by_default(): void
    {
        $response = $this->getJson('/api/v1/settings');

        $response->assertOk()
            ->assertJsonPath('registration_enabled', false)
            ->assertJsonPath('allow_indexing', false);
    }

    public function test_settings_are_readable_without_authentication(): void
    {
        $this->getJson('/api/v1/settings')->assertOk();
    }

    public function test_admin_can_open_and_close_the_registration(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson('/api/v1/admin/settings', [
            'registration_enabled' => true,
        ])->assertOk()
            ->assertJsonPath('registration_enabled', true)
            ->assertJsonPath('allow_indexing', false);

        $this->assertDatabaseHas('settings', [
            'key' => SiteSettings::REGISTRATION_ENABLED,
            'value' => '1',
        ]);

        $this->getJson('/api/v1/settings')->assertOk()
            ->assertJsonPath('registration_enabled', true);
    }

    public function test_admin_can_allow_indexing(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson('/api/v1/admin/settings', [
            'allow_indexing' => true,
        ])->assertOk()
            ->assertJsonPath('allow_indexing', true);
    }

    public function test_regular_users_cannot_change_the_settings(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/admin/settings')->assertForbidden();
        $this->patchJson('/api/v1/admin/settings', ['allow_indexing' => true])->assertForbidden();

        $this->assertDatabaseMissing('settings', ['key' => SiteSettings::ALLOW_INDEXING]);
    }

    public function test_admin_settings_require_authentication(): void
    {
        $this->getJson('/api/v1/admin/settings')->assertUnauthorized();
        $this->patchJson('/api/v1/admin/settings', ['allow_indexing' => true])->assertUnauthorized();
    }

    public function test_settings_reject_invalid_values(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson('/api/v1/admin/settings', ['allow_indexing' => 'quiza'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('allow_indexing');
    }

    public function test_robots_txt_forbids_crawling_while_indexing_is_blocked(): void
    {
        $response = $this->get('/robots.txt');

        $response->assertOk();
        $this->assertStringContainsString('Disallow: /', $response->getContent());
        $this->assertStringContainsString('User-agent: *', $response->getContent());
    }

    public function test_robots_txt_allows_crawling_when_indexing_is_enabled(): void
    {
        app(SiteSettings::class)->update([SiteSettings::ALLOW_INDEXING => true]);

        $response = $this->get('/robots.txt');

        $response->assertOk();
        $this->assertStringContainsString('Allow: /', $response->getContent());
        $this->assertStringNotContainsString('Disallow', $response->getContent());
    }

    public function test_responses_carry_the_noindex_header_while_indexing_is_blocked(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }

    public function test_responses_lose_the_noindex_header_when_indexing_is_allowed(): void
    {
        app(SiteSettings::class)->update([SiteSettings::ALLOW_INDEXING => true]);

        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertHeaderMissing('X-Robots-Tag');
    }
}
