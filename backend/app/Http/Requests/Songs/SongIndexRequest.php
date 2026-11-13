<?php

namespace App\Http\Requests\Songs;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SongIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:120'],
            'artist_id' => ['nullable', 'integer', 'exists:artists,id'],
            'album_id' => ['nullable', 'integer', 'exists:albums,id'],
            'liked' => ['nullable', 'boolean'],
            'favorites' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'sort' => ['nullable', Rule::in(['newest', 'title', 'artist', 'duration'])],
        ];
    }
}
