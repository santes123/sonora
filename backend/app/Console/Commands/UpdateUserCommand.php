<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Admin\UpdateUserAction;
use Illuminate\Console\Command;

/**
 * Actualiza una cuenta existente: correo, nombre, contraseña o rol.
 *
 * El panel de administración solo da de alta cuentas; no las edita. Para
 * cambiar el correo (o resetear la contraseña) de la cuenta de arranque, esta
 * es la vía:
 *
 *   php artisan sonora:update-user \
 *       --email=admin@ejemplo.com --new-email=nuevo@ejemplo.com
 *
 * Si se omite --password, se genera una aleatoria y se muestra por pantalla.
 */
class UpdateUserCommand extends Command
{
    protected $signature = 'sonora:update-user
        {--email= : Correo actual de la cuenta (obligatorio)}
        {--new-email= : Nuevo correo}
        {--name= : Nuevo nombre}
        {--password= : Nueva contraseña}
        {--reset-password : Genera una contraseña nueva y la muestra por pantalla}
        {--role= : Nuevo rol (admin o user)}';

    protected $description = 'Actualiza una cuenta existente (correo, nombre, contraseña o rol)';

    public function handle(UpdateUserAction $action): int
    {
        $email = trim((string) $this->option('email'));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Falta --email o el correo no es válido.');

            return self::FAILURE;
        }

        $user = User::query()->where('email', mb_strtolower($email))->first();

        if ($user === null) {
            $this->error("No existe ninguna cuenta con el correo {$email}.");

            return self::FAILURE;
        }

        $changes = [];

        $newEmail = trim((string) $this->option('new-email'));

        if ($newEmail !== '') {
            if (! filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
                $this->error('El nuevo correo no es válido.');

                return self::FAILURE;
            }

            if (mb_strtolower($newEmail) !== mb_strtolower($email)
                && User::query()->where('email', mb_strtolower($newEmail))->exists()) {
                $this->error("Ya existe una cuenta con el correo {$newEmail}.");

                return self::FAILURE;
            }

            $changes['email'] = $newEmail;
        }

        $name = trim((string) $this->option('name'));

        if ($name !== '') {
            $changes['name'] = $name;
        }

        $role = trim((string) $this->option('role'));

        if ($role !== '') {
            if (! in_array($role, ['admin', 'user'], true)) {
                $this->error('El rol debe ser "admin" o "user".');

                return self::FAILURE;
            }

            $changes['role'] = $role;
        }

        // La contraseña solo se toca si se pide: si no, se deja como está.
        $password = (string) $this->option('password');
        $generated = false;

        if ($password !== '') {
            if (mb_strlen($password) < 8) {
                $this->error('La contraseña debe tener al menos 8 caracteres.');

                return self::FAILURE;
            }

            $changes['password'] = $password;
        } elseif ((bool) $this->option('reset-password')) {
            $password = $this->generatePassword();
            $generated = true;
            $changes['password'] = $password;
        }

        if ($changes === []) {
            $this->error('No hay nada que cambiar: indica --new-email, --name, --password, --reset-password o --role.');

            return self::FAILURE;
        }

        $user = $action->execute($user, $changes);

        $this->info("Cuenta actualizada: {$user->email} ({$user->role->value}).");

        if ($generated) {
            $this->line('');
            $this->line("  Contraseña: {$password}");
            $this->line('  Cámbiala al entrar: no se guarda en ningún sitio.');
        }

        return self::SUCCESS;
    }

    /**
     * Contraseña aleatoria legible: 20 caracteres de un alfabeto sin
     * confusiones (sin 0/O ni 1/l).
     */
    private function generatePassword(): string
    {
        $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $max = strlen($alphabet) - 1;
        $password = '';

        for ($i = 0; $i < 20; $i++) {
            $password .= $alphabet[random_int(0, $max)];
        }

        return $password;
    }
}
