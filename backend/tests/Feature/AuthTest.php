<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
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

    public function test_register_validates_unique_email(): void
    {
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
