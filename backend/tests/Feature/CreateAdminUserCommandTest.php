<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Comando de arranque en frío: crea la primera cuenta de administrador.
 *
 * El registro público está cerrado, así que es la única forma de entrar en
 * una instalación recién estrenada.
 */
class CreateAdminUserCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_an_admin_account(): void
    {
        $this->artisan('sonora:create-admin', [
            '--name' => 'Administrador',
            '--email' => 'admin@sonora.local',
            '--password' => 'contrasena-larga',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'admin@sonora.local')->firstOrFail();

        $this->assertSame('Administrador', $user->name);
        $this->assertTrue($user->isAdmin());
        $this->assertTrue(Hash::check('contrasena-larga', $user->password));
    }

    public function test_it_generates_a_password_when_it_is_omitted(): void
    {
        $this->artisan('sonora:create-admin', [
            '--email' => 'admin@sonora.local',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'admin@sonora.local')->firstOrFail();

        $this->assertNotSame('', $user->password);
        $this->assertTrue($user->isAdmin());
    }

    public function test_it_lowercases_the_email(): void
    {
        $this->artisan('sonora:create-admin', [
            '--email' => 'Admin@Sonora.Local',
            '--password' => 'contrasena-larga',
        ])->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'admin@sonora.local']);
    }

    public function test_it_refuses_a_duplicate_email(): void
    {
        User::factory()->create(['email' => 'admin@sonora.local']);

        $this->artisan('sonora:create-admin', [
            '--email' => 'admin@sonora.local',
            '--password' => 'contrasena-larga',
        ])->assertFailed();

        $this->assertSame(1, User::query()->where('email', 'admin@sonora.local')->count());
    }

    public function test_it_requires_a_valid_email(): void
    {
        $this->artisan('sonora:create-admin', [
            '--email' => 'no-es-un-correo',
            '--password' => 'contrasena-larga',
        ])->assertFailed();

        $this->assertSame(0, User::query()->count());
    }

    public function test_it_refuses_a_short_password(): void
    {
        $this->artisan('sonora:create-admin', [
            '--email' => 'admin@sonora.local',
            '--password' => 'corta',
        ])->assertFailed();

        $this->assertSame(0, User::query()->count());
    }
}
