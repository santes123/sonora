<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@sonora.local'],
            [
                'name' => 'Administrador',
                'password' => 'password',
                'role' => UserRole::Admin,
                'email_verified_at' => now(),
            ],
        );

        // Si ya existía sin rol admin, lo aseguramos.
        if (! $admin->isAdmin()) {
            $admin->forceFill(['role' => UserRole::Admin])->saveQuietly();
        }
    }
}
