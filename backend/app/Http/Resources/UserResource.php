<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ProvidesMediaUrls;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    use ProvidesMediaUrls;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role?->value,
            'avatar_url' => $this->mediaUrl($this->avatar_path),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
