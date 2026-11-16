<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Alta de cuenta.
     *
     * El registro público está cerrado por defecto (es un sitio privado). Si
     * el administrador lo abre desde el panel, la casilla de la interfaz
     * reaparece; si no, este endpoint responde 403 y no hay ningún menú
     * público que lo use.
     */
    public function register(RegisterRequest $request, SiteSettings $settings): JsonResponse
    {
        abort_unless(
            $settings->registrationEnabled(),
            403,
            'El registro está cerrado. Pide al administrador que cree tu cuenta.',
        );

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => mb_strtolower($request->string('email')->toString()),
            'password' => $request->string('password')->toString(),
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function login(LoginRequest $request): UserResource
    {
        $credentials = $request->only('email', 'password');

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'Credenciales incorrectas.',
            ]);
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = $request->user();
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return new UserResource($user);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($user);
    }
}
