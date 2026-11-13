<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('albums', function (Blueprint $table) {
            $table->id();
            $table->foreignId('artist_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->string('title_normalized');
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('cover_path', 512)->nullable();
            $table->timestamps();

            $table->unique(['artist_id', 'title_normalized']);
            $table->index('title_normalized');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('albums');
    }
};
