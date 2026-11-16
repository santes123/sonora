<?php

namespace App\Services\Settings;

use App\Models\Setting;

/**
 * Ajustes del sitio, legibles y modificables desde la interfaz de
 * administración sin rehacer la imagen ni reiniciar el servidor.
 *
 * Los valores por defecto son restrictivos a propósito: el registro público
 * está cerrado y los motores de búsqueda no pueden indexar nada. Ambos se
 * pueden activar desde el panel de administración cuando haga falta.
 */
final class SiteSettings
{
    /** Permite que cualquiera cree una cuenta. */
    public const REGISTRATION_ENABLED = 'registration_enabled';

    /** Permite que los motores de búsqueda indexen el sitio. */
    public const ALLOW_INDEXING = 'allow_indexing';

    /** @var array<string, bool> */
    public const DEFAULTS = [
        self::REGISTRATION_ENABLED => false,
        self::ALLOW_INDEXING => false,
    ];

    /**
     * Ajustes actuales, con los valores por defecto para los que falten.
     *
     * @return array<string, bool>
     */
    public function all(): array
    {
        $stored = Setting::all_cached();

        $values = [];

        foreach (self::DEFAULTS as $key => $default) {
            $raw = $stored[$key] ?? null;

            $values[$key] = $raw === null ? $default : filter_var($raw, FILTER_VALIDATE_BOOLEAN);
        }

        return $values;
    }

    public function registrationEnabled(): bool
    {
        return $this->all()[self::REGISTRATION_ENABLED];
    }

    public function indexingAllowed(): bool
    {
        return $this->all()[self::ALLOW_INDEXING];
    }

    /**
     * Guarda los ajustes indicados y devuelve el estado completo.
     *
     * @param  array<string, bool>  $values
     * @return array<string, bool>
     */
    public function update(array $values): array
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue;
            }

            Setting::put($key, $value ? '1' : '0');
        }

        return $this->all();
    }
}
