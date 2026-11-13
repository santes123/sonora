<?php

namespace App\Http\Requests\Offline;

use Illuminate\Foundation\Http\FormRequest;

class DownloadUrlsRequest extends FormRequest
{
    /**
     * Tope de canciones por petición. Descargar una playlist entera no debe
     * poder convertirse en una petición que genere miles de URLs firmadas.
     */
    public const MAX_SONGS = 200;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'song_ids' => ['required', 'array', 'min:1', 'max:'.self::MAX_SONGS],
            'song_ids.*' => ['required', 'integer', 'distinct', 'exists:songs,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'song_ids.required' => 'Indica las canciones que quieres descargar.',
            'song_ids.max' => 'No se pueden descargar más de '.self::MAX_SONGS.' canciones a la vez.',
            'song_ids.*.exists' => 'Alguna de las canciones no existe.',
        ];
    }
}
