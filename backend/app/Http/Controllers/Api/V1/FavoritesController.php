<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Likes\ListFavoriteSongsAction;
use App\Http\Controllers\Controller;
use App\Http\Resources\SongResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FavoritesController extends Controller
{
    /**
     * Canciones que le gustan al usuario autenticado, de más reciente a más
     * antigua.
     */
    public function index(Request $request, ListFavoriteSongsAction $action): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $songs = $action->execute(
            $request->user(),
            (int) ($validated['per_page'] ?? 24),
        );

        return SongResource::collection($songs);
    }
}
