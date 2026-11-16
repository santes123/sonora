<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSettingsRequest;
use App\Services\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;

/**
 * Ajustes del sitio, panel de administración.
 *
 * Solo los administradores; el middleware `admin` ya lo garantiza, pero los
 * formularios vuelven a comprobarlo (defensa en profundidad: un cambio de
 * middleware no debe abrir el endpoint).
 */
class SettingsController extends Controller
{
    public function index(SiteSettings $settings): JsonResponse
    {
        return response()->json($settings->all());
    }

    public function update(UpdateSettingsRequest $request, SiteSettings $settings): JsonResponse
    {
        return response()->json($settings->update($request->validated()));
    }
}
