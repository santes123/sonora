<?php

namespace App\Data;

use Illuminate\Http\UploadedFile;

final readonly class UploadSongData
{
    public function __construct(
        public UploadedFile $file,
        public ?string $title = null,
    ) {}
}
