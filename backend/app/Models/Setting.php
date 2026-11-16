<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Ajuste del sitio (clave/valor).
 *
 * Los ajustes se guardan en la base de datos para poder cambiarlos desde la
 * interfaz de administración sin rehacer la imagen ni reiniciar el servidor.
 */
class Setting extends Model
{
    public const CACHE_KEY = 'sonora:settings';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    /**
     * Lee todos los ajustes con la caché de la aplicación (un minuto).
     *
     * @return array<string, string|null>
     */
    public static function all_cached(): array
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinute(), function (): array {
            return self::query()->pluck('value', 'key')->all();
        });
    }

    /**
     * Guarda un ajuste y vacía la caché.
     */
    public static function put(string $key, ?string $value): void
    {
        self::query()->updateOrCreate(['key' => $key], ['value' => $value]);

        Cache::forget(self::CACHE_KEY);
    }
}
