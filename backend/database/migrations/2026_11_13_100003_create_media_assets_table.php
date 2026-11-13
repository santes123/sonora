<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $table) {
            $table->id();

            // Huella del binario completo. Es la unidad de deduplicación y la
            // restricción única resuelve carreras entre subidas simultáneas.
            $table->char('hash', 64)->unique();

            $table->string('disk', 32)->default('media');
            $table->string('path', 512);

            // Metadatos técnicos obtenidos con ffprobe.
            $table->string('mime_type', 100);
            $table->string('extension', 16);
            $table->string('format', 32)->nullable();
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedBigInteger('duration_ms')->default(0);
            $table->unsignedInteger('bitrate')->nullable();
            $table->unsignedInteger('sample_rate')->nullable();
            $table->unsignedTinyInteger('channels')->nullable();

            $table->string('original_filename', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_assets');
    }
};
