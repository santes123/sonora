<?php

namespace App\Http\Requests\Playlists;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePlaylistRequest extends FormRequest
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
        return [
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_public' => ['sometimes', 'boolean'],
        ];
    }
}
