<?php

namespace App\Http\Controllers;

use App\Services\Settings\SiteSettings;
use Symfony\Component\HttpFoundation\Response;

/**
 * `robots.txt` dinámico.
 *
 * El sitio es privado: mientras el administrador no active la indexación, el
 * archivo prohíbe el rastreo por completo. Se genera en cada petición (con el
 * ajuste cacheado) para que cambiar la casilla surta efecto sin tocar nginx.
 */
class RobotsController extends Controller
{
    public function __invoke(SiteSettings $settings): Response
    {
        $body = $settings->indexingAllowed()
            ? "User-agent: *\nAllow: /\n"
            : "User-agent: *\nDisallow: /\n";

        return response($body, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'public, max-age=60',
        ]);
    }
}
