<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\BlockSearchEngines;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Cookies de sesión Sanctum para la SPA (mismo origen).
        $middleware->statefulApi();
        $middleware->throttleApi();
        $middleware->api(append: [AssignRequestId::class]);

        // Rutas de administración: solo para administradores.
        $middleware->alias(['admin' => EnsureUserIsAdmin::class]);

        // Sitio privado: mientras el administrador no active la indexación,
        // todas las respuestas llevan `X-Robots-Tag: noindex, nofollow`.
        $middleware->append(BlockSearchEngines::class);

        // El único que alcanza PHP-FPM es nuestro propio nginx (el del host
        // o el contenedor `web`), que añade X-Forwarded-Proto y
        // X-Forwarded-For. Sin esto, Laravel creería que la petición llega
        // en http plano desde 127.0.0.1: las cookies de sesión no serían
        // "secure" y el rate limit por IP trataría a todos los usuarios como
        // el mismo.
        $middleware->trustProxies(at: '*');

        // La API no tiene página de login: una petición no autenticada debe
        // responder 401 JSON. Sin esto, Laravel intenta redirigir a la ruta
        // `login`, que no existe, y responde 500.
        $middleware->redirectGuestsTo(static fn (Request $request): ?string => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            static fn (Request $request): bool => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
