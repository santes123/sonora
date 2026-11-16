<?php

namespace App\Http\Requests\Admin;

use App\Services\Settings\SiteSettings;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            SiteSettings::REGISTRATION_ENABLED => ['sometimes', 'boolean'],
            SiteSettings::ALLOW_INDEXING => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            SiteSettings::REGISTRATION_ENABLED.'.boolean' => 'El valor no es válido.',
            SiteSettings::ALLOW_INDEXING.'.boolean' => 'El valor no es válido.',
        ];
    }
}
