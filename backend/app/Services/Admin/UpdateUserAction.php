<?php

namespace App\Services\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Actualiza una cuenta existente (correo, nombre, contraseña o rol).
 *
 * El panel de administración da de alta cuentas, pero no las edita: no hay
 * ningún endpoint público para tocar el correo de alguien. Este action cubre
 * el caso desde consola, que es donde se hace la administración de verdad.
 */
final class UpdateUserAction
{
    /**
     * @param  array{name?: string|null, email?: string|null, password?: string|null, role?: string|null}  $changes
     */
    public function execute(User $user, array $changes): User
    {
        if (array_key_exists('name', $changes) && $changes['name'] !== null) {
            $user->name = $changes['name'];
        }

        if (array_key_exists('email', $changes) && $changes['email'] !== null) {
            $user->email = mb_strtolower($changes['email']);
        }

        if (array_key_exists('password', $changes) && $changes['password'] !== null) {
            $user->password = Hash::make($changes['password']);
        }

        if (array_key_exists('role', $changes) && $changes['role'] !== null) {
            $user->role = $changes['role'] === 'admin' ? UserRole::Admin : UserRole::User;
        }

        $user->save();

        return $user;
    }
}
