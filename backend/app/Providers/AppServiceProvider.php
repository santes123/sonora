<?php

namespace App\Providers;

use App\Services\Media\FfprobeMetadataExtractor;
use App\Services\Media\LocalMediaStorage;
use App\Services\Media\MediaStorage;
use App\Services\Media\MetadataExtractor;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(MediaStorage::class, static fn () => new LocalMediaStorage(
            Storage::disk((string) config('media.disk', 'media'))
        ));

        $this->app->bind(MetadataExtractor::class, FfprobeMetadataExtractor::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Detecta N+1 en desarrollo y tests; en producción se desactiva por coste.
        Model::preventLazyLoading(! app()->isProduction());

        RateLimiter::for('api', static fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('auth', static fn (Request $request) => Limit::perMinute(8)
            ->by(Str::lower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('uploads', static fn (Request $request) => Limit::perHour(120)
            ->by($request->user()?->id ?: $request->ip()));
    }
}
