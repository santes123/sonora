<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Admin\CreateUserAction;
use Illuminate\Console\Command;

/**
 * Crea la primera cuenta de administrador.
 *
 * El registro público está cerrado (el sitio es privado), así que en un
 * arranque limpio no hay forma de entrar: este comando es la única vía para
 * crear la cuenta inicial.
 *
 *   php artisan sonora:create-admin --name=Administrador \
 *       --email=admin@ejemplo.com --password=una-contrasena-larga
 *
 * Si se omite la contraseña, se genera una aleatoria y se muestra por
 * pantalla (no se guarda en ningún sitio).
 */
class CreateAdminUserCommand extends Command
{
    protected $signature = 'sonora:create-admin
        {--name= : Nombre de la cuenta (por defecto "Administrador")}
        {--email= : Correo electrónico (obligatorio)}
        {--password= : Contraseña (si se omite, se genera una)}';

    protected $description = 'Crea una cuenta de administrador (arranque en frío)';

    public function handle(CreateUserAction $action): int
    {
        $email = trim((string) $this->option('email'));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Falta --email o el correo no es válido.');

            return self::FAILURE;
        }

        if (User::query()->where('email', mb_strtolower($email))->exists()) {
            $this->error("Ya existe una cuenta con el correo {$email}.");

            return self::FAILURE;
        }

        $password = (string) $this->option('password');
        $generated = false;

        if ($password === '') {
            $password = $this->generatePassword();
            $generated = true;
        }

        if (mb_strlen($password) < 8) {
            $this->error('La contraseña debe tener al menos 8 caracteres.');

            return self::FAILURE;
        }

        $name = trim((string) $this->option('name'));
        $name = $name === '' ? 'Administrador' : $name;

        $user = $action->execute($name, $email, $password, 'admin');

        $this->info("Cuenta creada: {$user->email} (administrador).");

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
