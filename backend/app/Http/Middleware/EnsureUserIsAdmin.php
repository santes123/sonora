<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restringe una ruta a los administradores.
 *
 * El sitio es privado: el registro público está cerrado y las acciones
 * delicadas (dar de alta cuentas, cambiar los ajustes del sitio) solo
 * corresponde al administrador.
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        abort_unless(
            $user !== null && $user->isAdmin(),
            403,
            'Solo un administrador puede hacer esto.',
        );

        return $next($request);
    }
}
