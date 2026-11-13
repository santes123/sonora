<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirect;
use Throwable;

/**
 * Google OAuth listo pero desactivado por defecto.
 * Se activa con GOOGLE_AUTH_ENABLED=true y credenciales válidas.
 */
class GoogleAuthController extends Controller
{
    public function redirect(): SymfonyRedirect
    {
        $this->ensureEnabled();

        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        $this->ensureEnabled();

        $frontend = rtrim((string) config('app.frontend_url'), '/');

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable) {
            return redirect()->away($frontend.'/auth/callback?error=google');
        }

        $email = mb_strtolower((string) $googleUser->getEmail());

        if ($email === '') {
            return redirect()->away($frontend.'/auth/callback?error=email');
        }

        $user = User::query()->where('google_id', $googleUser->getId())->first()
            ?? User::query()->where('email', $email)->first();

        if ($user === null) {
            $user = User::query()->create([
                'name' => $googleUser->getName() ?: Str::before($email, '@'),
                'email' => $email,
                'password' => null,
                'google_id' => $googleUser->getId(),
                'email_verified_at' => now(),
            ]);
        } elseif ($user->google_id === null) {
            $user->forceFill(['google_id' => $googleUser->getId()])->saveQuietly();
        }

        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        Auth::login($user, true);
        request()->session()->regenerate();

        return redirect()->away($frontend.'/auth/callback');
    }

    private function ensureEnabled(): void
    {
        abort_unless(
            (bool) config('services.google.client_id') && filter_var(env('GOOGLE_AUTH_ENABLED', false), FILTER_VALIDATE_BOOL),
            404,
            'Google OAuth no está configurado.'
        );
    }
}
