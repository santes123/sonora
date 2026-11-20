<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Comando de administración: actualizar una cuenta existente.
 *
 * El panel da de alta cuentas pero no las edita: cambiar el correo de la
 * cuenta de arranque se hace desde consola.
 */
class UpdateUserCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_changes_the_email(): void
    {
        User::factory()->create(['email' => 'viejo@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'viejo@sonora.local',
            '--new-email' => 'nuevo@sonora.local',
        ])->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'nuevo@sonora.local']);
        $this->assertDatabaseMissing('users', ['email' => 'viejo@sonora.local']);
    }

    public function test_it_lowercases_the_new_email(): void
    {
        User::factory()->create(['email' => 'viejo@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'viejo@sonora.local',
            '--new-email' => 'Nuevo@Sonora.Local',
        ])->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'nuevo@sonora.local']);
    }

    public function test_it_changes_the_password(): void
    {
        User::factory()->create(['email' => 'admin@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'admin@sonora.local',
            '--password' => 'contrasena-nueva',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'admin@sonora.local')->firstOrFail();

        $this->assertTrue(Hash::check('contrasena-nueva', $user->password));
    }

    public function test_it_keeps_the_password_when_it_is_not_requested(): void
    {
        User::factory()->create([
            'email' => 'admin@sonora.local',
            'password' => Hash::make('contrasena-original'),
        ]);

        $this->artisan('sonora:update-user', [
            '--email' => 'admin@sonora.local',
            '--new-email' => 'otro@sonora.local',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'otro@sonora.local')->firstOrFail();

        $this->assertTrue(Hash::check('contrasena-original', $user->password));
    }

    public function test_it_generates_a_password_when_reset_is_requested(): void
    {
        User::factory()->create(['email' => 'admin@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'admin@sonora.local',
            '--reset-password' => true,
        ])->assertSuccessful();

        $user = User::query()->where('email', 'admin@sonora.local')->firstOrFail();

        $this->assertNotSame('', $user->password);
    }

    public function test_it_changes_the_name_and_the_role(): void
    {
        User::factory()->create(['email' => 'admin@sonora.local', 'role' => 'user']);

        $this->artisan('sonora:update-user', [
            '--email' => 'admin@sonora.local',
            '--name' => 'Administrador',
            '--role' => 'admin',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'admin@sonora.local')->firstOrFail();

        $this->assertSame('Administrador', $user->name);
        $this->assertTrue($user->isAdmin());
    }

    public function test_it_fails_when_the_account_does_not_exist(): void
    {
        $this->artisan('sonora:update-user', [
            '--email' => 'no-existe@sonora.local',
            '--new-email' => 'nuevo@sonora.local',
        ])->assertFailed();
    }

    public function test_it_refuses_a_duplicate_email(): void
    {
        User::factory()->create(['email' => 'uno@sonora.local']);
        User::factory()->create(['email' => 'dos@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'uno@sonora.local',
            '--new-email' => 'dos@sonora.local',
        ])->assertFailed();

        $this->assertDatabaseHas('users', ['email' => 'uno@sonora.local']);
    }

    public function test_it_requires_a_valid_email(): void
    {
        $this->artisan('sonora:update-user', [
            '--email' => 'no-es-un-correo',
            '--new-email' => 'nuevo@sonora.local',
        ])->assertFailed();
    }

    public function test_it_fails_when_there_is_nothing_to_change(): void
    {
        User::factory()->create(['email' => 'admin@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'admin@sonora.local',
        ])->assertFailed();
    }

    public function test_it_refuses_a_short_password(): void
    {
        User::factory()->create(['email' => 'admin@sonora.local']);

        $this->artisan('sonora:update-user', [
            '--email' => 'admin@sonora.local',
            '--password' => 'corta',
        ])->assertFailed();
    }
}
