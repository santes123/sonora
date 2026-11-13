<?php

namespace App\Data;

use App\Models\Song;

final readonly class UploadSongResult
{
    public function __construct(
        public Song $song,
        public bool $deduplicated,
    ) {}
}
