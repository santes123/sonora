<?php

namespace App\Services\Admin;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Crea una cuenta de usuario a petición de un administrador.
 *
 * Es el camino que queda cuando el registro público está cerrado: el
 * administrador da de alta a quien quiera, sin abrir el registro a todo el
 * mundo.
 */
final class CreateUserAction
{
    public function execute(string $name, string $email, string $password, string $role = 'user'): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => mb_strtolower($email),
            'password' => Hash::make($password),
            'role' => $role === 'admin' ? 'admin' : 'user',
        ]);
    }
}
