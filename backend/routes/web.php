<?php

use App\Http\Controllers\HomeController;
use App\Http\Controllers\RobotsController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class);

// `robots.txt` lo genera la aplicación: el contenido depende del ajuste de
// indexación, que el administrador puede cambiar sin tocar la configuración
// de nginx.
Route::get('/robots.txt', RobotsController::class)->name('robots');
