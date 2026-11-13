<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('playlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('cover_path', 512)->nullable();
            $table->boolean('is_public')->default(false);

            // Contadores desnormalizados: evitan COUNT/SUM por cada listado.
            $table->unsignedInteger('songs_count')->default(0);
            $table->unsignedBigInteger('duration_ms')->default(0);

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['is_public', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playlists');
    }
};
