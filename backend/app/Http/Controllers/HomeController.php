<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

/**
 * Página de bienvenida.
 *
 * Existe como controlador (y no como closure en routes/web.php) para que
 * `php artisan route:cache` funcione en producción: una closure no se puede
 * serializar en el fichero de rutas cacheado.
 */
class HomeController extends Controller
{
    public function __invoke(): View
    {
        return view('welcome');
    }
}
