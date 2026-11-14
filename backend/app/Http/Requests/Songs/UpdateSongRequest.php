<?php

namespace App\Http\Requests\Songs;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSongRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La autorización fina (uploader o admin) la hace la Policy del modelo.
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'artist_name' => ['sometimes', 'required', 'string', 'max:255'],
            // Cadena vacía = la canción se queda sin álbum.
            'album_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'track_number' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:9999'],
            'disc_number' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:9999'],
            'year' => ['sometimes', 'nullable', 'integer', 'min:1900', 'max:2100'],
            'genre' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'El título no puede quedar vacío.',
            'artist_name.required' => 'El nombre del artista no puede quedar vacío.',
            'album_title.max' => 'El nombre del álbum es demasiado largo.',
            'track_number.min' => 'El número de pista debe ser 1 o mayor.',
            'disc_number.min' => 'El número de disco debe ser 1 o mayor.',
            'year.min' => 'El año debe estar entre 1900 y 2100.',
            'year.max' => 'El año debe estar entre 1900 y 2100.',
            'genre.max' => 'El género es demasiado largo.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validatedData(): array
    {
        return $this->validated();
    }
}
