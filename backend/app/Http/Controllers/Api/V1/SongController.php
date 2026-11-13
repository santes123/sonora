<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Songs\DeleteSongAction;
use App\Actions\Songs\UploadSongAction;
use App\Data\UploadSongData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Songs\SongIndexRequest;
use App\Http\Requests\Songs\UploadSongRequest;
use App\Http\Resources\SongResource;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SongController extends Controller
{
    public function index(SongIndexRequest $request): AnonymousResourceCollection
    {
        $term = $request->string('q')->toString();
        $sort = $request->string('sort', 'newest')->toString();
        $userId = $request->user()?->id;
        $onlyLiked = $request->boolean('liked') || $request->boolean('favorites');

        $query = Song::query()->with([
            'artist',
            'album',
            'mediaAsset:id,path',
            'uploader:id,name',
        ]);

        if ($onlyLiked) {
            // JOIN por la pivote en lugar de un EXISTS: el índice
            // (user_id, created_at) resuelve el filtro *y* el orden en un
            // solo recorrido. Con `whereHas` el plan obligaba a un filesort
            // sobre el total de "me gusta" del usuario.
            $query->join('song_likes', 'song_likes.song_id', '=', 'songs.id')
                ->where('song_likes.user_id', $userId)
                ->select('songs.*');
        }

        $query->withIsLiked($userId)
            ->search($term)
            ->byArtist($request->integer('artist_id') ?: null)
            ->byAlbum($request->integer('album_id') ?: null);

        if ($sort === 'newest') {
            if ($term !== '') {
                $query->orderByRelevance($term);
            }

            // Con el filtro de favoritas, "más reciente" es la fecha del "me
            // gusta": coincide con el orden de `GET /api/v1/me/favorites` y
            // mantiene la consulta sobre el índice de la pivote.
            if ($onlyLiked) {
                $query->orderByDesc('song_likes.created_at');
            } else {
                $query->orderByDesc('created_at')->orderByDesc('id');
            }
        } elseif ($sort === 'title') {
            $query->orderBy('title_normalized');
        } elseif ($sort === 'artist') {
            $query->orderBy('artist_name_normalized')->orderBy('title_normalized');
        } else {
            $query->orderByDesc('duration_ms');
        }

        $songs = $query
            ->paginate($request->integer('per_page', 24))
            ->withQueryString();

        return SongResource::collection($songs);
    }

    public function show(Song $song): SongResource
    {
        $this->authorize('view', $song);

        $song->load(['artist', 'album', 'mediaAsset:id,path', 'uploader:id,name']);
        $song->loadIsLiked(request()->user()?->id);

        return new SongResource($song);
    }

    public function store(UploadSongRequest $request, UploadSongAction $action): JsonResponse
    {
        $result = $action->execute(
            new UploadSongData(
                file: $request->file('file'),
                title: $request->string('title')->toString() ?: null,
            ),
            $request->user(),
        );

        return (new SongResource($result->song))
            ->response()
            ->setStatusCode($result->deduplicated ? 200 : 201);
    }

    public function destroy(Song $song, DeleteSongAction $action): Response
    {
        $this->authorize('delete', $song);

        $action->execute($song);

        return response()->noContent();
    }
}
