<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('songs', function (Blueprint $table) {
            // Borrado lógico: la canción desaparece del catálogo, pero sigue
            // existiendo para poder marcarla como "no disponible" en las
            // playlists de otras personas y saltar en la reproducción.
            $table->timestamp('deleted_at')->nullable()->after('cover_path');
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('songs', function (Blueprint $table) {
            $table->dropIndex(['deleted_at']);
            $table->dropColumn('deleted_at');
        });
    }
};
