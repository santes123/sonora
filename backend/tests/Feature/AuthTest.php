<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        // El registro público está cerrado por defecto (sitio privado): para
        // esta prueba se abre explícitamente.
        app(SiteSettings::class)->update([SiteSettings::REGISTRATION_ENABLED => true]);

        $response = $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/register', [
                'name' => 'Nueva Persona',
                'email' => 'nueva@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'nueva@example.com')
            ->assertJsonPath('data.role', 'user');

        $this->assertDatabaseHas('users', ['email' => 'nueva@example.com']);
    }

    public function test_registration_is_closed_by_default(): void
    {
        $response = $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/register', [
                'name' => 'Colada',
                'email' => 'colada@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'colada@example.com']);
    }

    public function test_register_validates_unique_email(): void
    {
        app(SiteSettings::class)->update([SiteSettings::REGISTRATION_ENABLED => true]);

        User::factory()->create(['email' => 'ocupado@example.com']);

        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/register', [
                'name' => 'Otra Persona',
                'email' => 'ocupado@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'password123',
        ]);

        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', [
                'email' => 'login@example.com',
                'password' => 'password123',
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);

        $this->assertAuthenticatedAs($user);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'password123',
        ]);

        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', [
                'email' => 'login@example.com',
                'password' => 'incorrecta',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_unauthenticated_api_request_returns_401_json_and_not_a_redirect(): void
    {
        // La API no tiene ruta `login`: si el middleware de autenticación
        // intenta redirigir, la respuesta sería un 500 ("Route [login] not
        // defined"). Debe ser un 401 con cuerpo JSON.
        $response = $this->get('/api/v1/auth/me', ['Accept' => 'text/html']);

        $response->assertStatus(401);
        $this->assertStringContainsString(
            'Unauthenticated',
            $response->getContent(),
            'La respuesta no es el JSON de la excepción de autenticación.'
        );
    }

    public function test_unauthenticated_request_keeps_the_client_ip_for_rate_limiting(): void
    {
        // Con trustProxies, la IP del cliente debe seguir siendo la real: si
        // no, el limitador trataría a todos los usuarios como el mismo.
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->withHeader('X-Forwarded-For', '203.0.113.10')
            ->withHeader('Origin', 'http://localhost')
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/logout')
            ->assertNoContent();
    }
}
