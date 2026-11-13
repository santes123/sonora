<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Likes\LikeSongAction;
use App\Actions\Likes\UnlikeSongAction;
use App\Http\Controllers\Controller;
use App\Http\Resources\SongResource;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SongLikeController extends Controller
{
    /**
     * Marca la canción como favorita del usuario autenticado.
     *
     * Idempotente: repetir el "me gusta" no es un error. La primera vez
     * devuelve 201 (recurso creado) y las siguientes 200 (ya existía).
     */
    public function store(Request $request, Song $song, LikeSongAction $action): JsonResponse
    {
        $created = $action->execute($request->user(), $song);

        return (new SongResource($this->withLikeState($song, true)))
            ->response()
            ->setStatusCode($created ? 201 : 200);
    }

    /**
     * Quita la canción de las favoritas del usuario autenticado.
     */
    public function destroy(Request $request, Song $song, UnlikeSongAction $action): JsonResponse
    {
        $action->execute($request->user(), $song);

        return (new SongResource($this->withLikeState($song, false)))->response();
    }

    /**
     * Devuelve la canción con las relaciones que necesita `SongResource` y con
     * el estado "me gusta" ya resuelto, para que el cliente pueda pintar el
     * corazón sin una segunda petición.
     */
    private function withLikeState(Song $song, bool $liked): Song
    {
        $song->load(['artist', 'album', 'mediaAsset:id,path']);
        $song->setAttribute('is_liked', $liked);

        return $song;
    }
}
