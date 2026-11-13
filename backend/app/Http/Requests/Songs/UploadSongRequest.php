<?php

namespace App\Http\Requests\Songs;

use Illuminate\Foundation\Http\FormRequest;

class UploadSongRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maxKilobytes = (int) config('media.max_upload_mb', 256) * 1024;
        $mimes = implode(',', config('media.allowed_mimes', []));

        return [
            'file' => ['required', 'file', 'max:'.$maxKilobytes, 'mimetypes:'.$mimes],
            'title' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $max = (int) config('media.max_upload_mb', 256);

        return [
            'file.required' => 'Selecciona un archivo de audio.',
            'file.max' => "El archivo supera el límite de {$max} MB.",
            'file.mimetypes' => 'Formato no soportado. Se aceptan MP3, FLAC, M4A, AAC, OGG y WAV.',
        ];
    }
}
