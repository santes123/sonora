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

        $query = Song::query()
            ->with([
                'artist',
                'album',
                'mediaAsset:id,path',
                'uploader:id,name',
            ])
            ->search($term)
            ->byArtist($request->integer('artist_id') ?: null)
            ->byAlbum($request->integer('album_id') ?: null);

        if ($sort === 'newest') {
            if ($term !== '') {
                $query->orderByRelevance($term);
            }

            $query->orderByDesc('created_at')->orderByDesc('id');
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
