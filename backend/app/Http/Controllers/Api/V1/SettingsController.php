<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;

/**
 * Ajustes públicos del sitio.
 *
 * Solo se expone lo que la interfaz necesita antes de iniciar sesión (por
 * ejemplo, si el registro está abierto). No hay nada sensible aquí: la
 * contraseña de la base de datos y el resto de secretos no salen de `.env`.
 */
class SettingsController extends Controller
{
    public function __invoke(SiteSettings $settings): JsonResponse
    {
        return response()->json($settings->all());
    }
}
