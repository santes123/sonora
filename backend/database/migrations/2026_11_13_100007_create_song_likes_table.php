<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('song_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('song_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['user_id', 'song_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('song_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('song_likes');
    }
};
