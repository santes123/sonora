<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Alta de cuentas desde el panel de administración.
 *
 * Es el camino que queda cuando el registro público está cerrado: el
 * administrador da de alta a quien quiera, sin abrir el registro a todos.
 */
class AdminUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_a_user(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->postJson('/api/v1/admin/users', [
            'name' => 'Persona Invitada',
            'email' => 'invitada@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
            'role' => 'user',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'invitada@example.com')
            ->assertJsonPath('data.role', 'user')
            ->assertJsonPath('data.name', 'Persona Invitada');

        $this->assertDatabaseHas('users', [
            'email' => 'invitada@example.com',
            'role' => 'user',
        ]);
    }

    public function test_the_created_user_can_log_in(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Persona Invitada',
            'email' => 'invitada@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
        ])->assertCreated();

        // `Sanctum::actingAs` deja al administrador en el guard de la
        // petición (y cambia el guard por defecto): hay que restaurarlo
        // para poder iniciar sesión de verdad.
        $this->app['auth']->forgetGuards();
        config(['auth.defaults.guard' => 'web']);

        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', [
                'email' => 'invitada@example.com',
                'password' => 'secreto123',
            ])->assertOk()
            ->assertJsonPath('data.email', 'invitada@example.com');
    }

    public function test_admin_can_create_another_admin(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/v1/admin/users', [
            'name' => 'CoinAdministrator',
            'email' => 'coadmin@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
            'role' => 'admin',
        ])->assertCreated()
            ->assertJsonPath('data.role', 'admin');
    }

    public function test_the_email_is_lowercased(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Mayusculas',
            'email' => 'MAYUSCULAS@Example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
        ])->assertCreated()
            ->assertJsonPath('data.email', 'mayusculas@example.com');
    }

    public function test_regular_users_cannot_create_users(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Intruso',
            'email' => 'intruso@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'intruso@example.com']);
    }

    public function test_creating_users_requires_authentication(): void
    {
        $this->postJson('/api/v1/admin/users', [
            'name' => 'Anonimo',
            'email' => 'anonimo@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
        ])->assertUnauthorized();
    }

    public function test_the_email_must_be_unique(): void
    {
        User::factory()->create(['email' => 'ocupado@example.com']);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Duplicado',
            'email' => 'ocupado@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_the_password_must_be_confirmed_and_valid(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Sin confirmar',
            'email' => 'sin-confirmar@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'otra-cosa',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Corta',
            'email' => 'corta@example.com',
            'password' => 'corta',
            'password_confirmation' => 'corta',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_the_role_must_be_known(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Rol raro',
            'email' => 'raro@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
            'role' => 'superusuario',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_admin_can_list_the_users(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $other = User::factory()->create(['name' => 'Persona Listada']);

        Sanctum::actingAs($admin);

        // El orden es por fecha de alta, que en una prueba cae entera en el
        // mismo segundo: se comprueba el contenido, no la posición.
        $response = $this->getJson('/api/v1/admin/users')->assertOk();

        $emails = array_column($response->json('data'), 'email');

        $this->assertContains($other->email, $emails);
        $this->assertContains($admin->email, $emails);
        $this->assertCount(2, $emails);
    }

    public function test_regular_users_cannot_list_the_users(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/admin/users')->assertForbidden();
    }
}
