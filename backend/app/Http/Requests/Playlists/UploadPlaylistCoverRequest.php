<?php

namespace App\Http\Requests\Playlists;

use Illuminate\Foundation\Http\FormRequest;

class UploadPlaylistCoverRequest extends FormRequest
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
        $maxKilobytes = (int) config('media.playlist_cover.max_source_kb', 8192);

        return [
            'file' => [
                'required',
                'file',
                'max:'.$maxKilobytes,
                'mimetypes:image/jpeg,image/png,image/webp,image/gif,image/avif',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $max = (int) config('media.playlist_cover.max_source_kb', 8192);
        $maxDimension = (int) config('media.playlist_cover.max_source_dimension', 2500);

        return [
            'file.required' => 'Selecciona una imagen para la portada.',
            'file.max' => "La imagen supera el límite de {$max} KB.",
            'file.mimetypes' => 'Formato no soportado. Se aceptan JPEG, PNG, WebP, GIF y AVIF.',
            'file.image' => "La imagen no es válida o supera los {$maxDimension} px por lado.",
        ];
    }
}
