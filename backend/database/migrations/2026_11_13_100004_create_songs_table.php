<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('songs', function (Blueprint $table) {
            $table->id();

            // Un asset -> una canción en el catálogo compartido.
            $table->foreignId('media_asset_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('uploader_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('artist_id')->constrained()->restrictOnDelete();
            $table->foreignId('album_id')->nullable()->constrained()->nullOnDelete();

            $table->string('title');
            $table->string('title_normalized');

            // Desnormalización deliberada: evita JOINs en el FULLTEXT y en listados.
            $table->string('artist_name');
            $table->string('artist_name_normalized');
            $table->string('album_title')->nullable();
            $table->string('album_title_normalized')->nullable();

            $table->unsignedSmallInteger('track_number')->nullable();
            $table->unsignedSmallInteger('disc_number')->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('genre', 100)->nullable();
            $table->unsignedBigInteger('duration_ms')->default(0);
            $table->string('cover_path', 512)->nullable();

            $table->timestamps();

            $table->index('created_at');
            $table->index(['artist_id', 'title_normalized']);
            $table->index(['album_id', 'disc_number', 'track_number']);
            $table->index('title_normalized');

            $table->fullText(
                ['title_normalized', 'artist_name_normalized', 'album_title_normalized'],
                'songs_fulltext'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('songs');
    }
};
