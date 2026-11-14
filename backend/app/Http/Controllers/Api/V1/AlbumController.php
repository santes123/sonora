<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlbumResource;
use App\Models\Album;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AlbumController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'artist_id' => ['nullable', 'integer', 'exists:artists,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $albums = Album::query()
            ->with('artist')
            ->withCount('songs')
            ->when($request->integer('artist_id'), fn ($query, int $artistId) => $query->where('artist_id', $artistId))
            ->orderByDesc('year')
            ->orderBy('title_normalized')
            ->paginate($request->integer('per_page', 24))
            ->withQueryString();

        return AlbumResource::collection($albums);
    }

    public function show(Album $album): AlbumResource
    {
        $album->load([
            'artist',
            'songs' => fn ($query) => $query
                ->with(['artist', 'album', 'mediaAsset:id,path', 'uploader:id,name'])
                ->withIsLiked(request()->user()?->id)
                ->orderBy('disc_number')
                ->orderBy('track_number')
                ->orderBy('title_normalized'),
        ])->loadCount('songs');

        return new AlbumResource($album);
    }
}
