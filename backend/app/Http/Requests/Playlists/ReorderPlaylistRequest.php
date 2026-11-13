<?php

namespace App\Http\Requests\Playlists;

use Illuminate\Foundation\Http\FormRequest;

class ReorderPlaylistRequest extends FormRequest
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
            'song_ids' => ['present', 'array', 'max:1000'],
            'song_ids.*' => ['integer', 'distinct', 'exists:songs,id'],
        ];
    }
}
