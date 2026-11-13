<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listening_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('song_id')->constrained()->cascadeOnDelete();
            $table->timestamp('played_at');
            $table->unsignedInteger('play_count')->default(1);
            $table->timestamps();

            // Una fila por canción y usuario: el crecimiento de la tabla está
            // acotado por el número de canciones distintas que el usuario ha
            // escuchado, no por el número de reproducciones. Reproducir mil
            // veces la misma canción sigue dejando una sola fila.
            $table->unique(['user_id', 'song_id']);

            // Recorrido del carrusel "Escuchado recientemente": filtra por
            // usuario y ya viene ordenado por fecha, sin filesort.
            $table->index(['user_id', 'played_at']);

            // Índice de la clave ajena para el borrado en cascada.
            $table->index('song_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listening_history');
    }
};
