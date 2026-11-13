<?php

namespace App\Services\Media;

use App\Data\AudioMetadata;

interface MetadataExtractor
{
    public function extract(string $absolutePath, ?string $originalName = null): AudioMetadata;
}
