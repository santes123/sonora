<?php

namespace App\Http\Resources\Concerns;

use App\Services\Media\MediaStorage;

trait ProvidesMediaUrls
{
    protected function mediaUrl(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        return app(MediaStorage::class)->temporaryUrl($path);
    }
}
