<?php

namespace App\Http\Requests\Playlists;

use Illuminate\Foundation\Http\FormRequest;

class AddPlaylistItemRequest extends FormRequest
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
            'song_id' => ['required', 'integer', 'exists:songs,id'],
        ];
    }
}
