<?php

namespace App\Http\Requests\History;

use Illuminate\Foundation\Http\FormRequest;

class RecordListeningRequest extends FormRequest
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

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'song_id.required' => 'Indica la canción que se ha escuchado.',
            'song_id.exists' => 'Esa canción no existe.',
        ];
    }
}
