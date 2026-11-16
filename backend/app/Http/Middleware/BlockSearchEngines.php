<?php

namespace App\Http\Middleware;

use App\Services\Settings\SiteSettings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marca las respuestas como no indexables mientras el sitio lo prohiba.
 *
 * `robots.txt` es la señal que respetan todos los rastreadores, pero la
 * cabecera `X-Robots-Tag` es la que aplican los que ignoran el archivo (o que
 * ya lo tienen en caché). Con el sitio cerrado, la respuesta lleva
 * `noindex, nofollow`.
 *
 * El ajuste se lee de la caché (un minuto), así que el coste por petición es
 * una lectura de Redis.
 */
class BlockSearchEngines
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! app(SiteSettings::class)->indexingAllowed()) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        }

        return $response;
    }
}
