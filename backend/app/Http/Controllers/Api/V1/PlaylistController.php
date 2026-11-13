<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Playlists\AddSongToPlaylistAction;
use App\Actions\Playlists\CreatePlaylistAction;
use App\Actions\Playlists\DeletePlaylistAction;
use App\Actions\Playlists\RemoveSongFromPlaylistAction;
use App\Actions\Playlists\ReorderPlaylistAction;
use App\Actions\Playlists\UpdatePlaylistAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Playlists\AddPlaylistItemRequest;
use App\Http\Requests\Playlists\ReorderPlaylistRequest;
use App\Http\Requests\Playlists\StorePlaylistRequest;
use App\Http\Requests\Playlists\UpdatePlaylistRequest;
use App\Http\Resources\PlaylistResource;
use App\Models\Playlist;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PlaylistController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'mine' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Playlist::query()->with('user:id,name');

        if ($request->boolean('mine')) {
            $query->where('user_id', $request->user()->id);
        } else {
            $query->visibleTo($request->user());
        }

        $playlists = $query
            ->orderByDesc('updated_at')
            ->paginate($request->integer('per_page', 24))
            ->withQueryString();

        return PlaylistResource::collection($playlists);
    }

    public function store(StorePlaylistRequest $request, CreatePlaylistAction $action): JsonResponse
    {
        $playlist = $action->execute($request->user(), $request->validated());
        $playlist->load('user:id,name');

        return (new PlaylistResource($playlist))->response()->setStatusCode(201);
    }

    public function show(Playlist $playlist): PlaylistResource
    {
        $this->authorize('view', $playlist);

        return new PlaylistResource($this->loadDetails($playlist));
    }

    public function update(UpdatePlaylistRequest $request, Playlist $playlist, UpdatePlaylistAction $action): PlaylistResource
    {
        $this->authorize('update', $playlist);

        $playlist = $action->execute($playlist, $request->validated());

        return new PlaylistResource($this->loadDetails($playlist));
    }

    public function destroy(Playlist $playlist, DeletePlaylistAction $action): Response
    {
        $this->authorize('delete', $playlist);

        $action->execute($playlist);

        return response()->noContent();
    }

    public function addItem(AddPlaylistItemRequest $request, Playlist $playlist, AddSongToPlaylistAction $action): JsonResponse
    {
        $this->authorize('update', $playlist);

        $created = $action->execute($playlist, $request->integer('song_id'));

        return (new PlaylistResource($this->loadDetails($playlist)))
            ->response()
            ->setStatusCode($created ? 201 : 200);
    }

    public function removeItem(Playlist $playlist, Song $song, RemoveSongFromPlaylistAction $action): Response
    {
        $this->authorize('update', $playlist);

        $action->execute($playlist, $song->id);

        return response()->noContent();
    }

    public function reorder(ReorderPlaylistRequest $request, Playlist $playlist, ReorderPlaylistAction $action): PlaylistResource
    {
        $this->authorize('update', $playlist);

        /** @var list<int> $songIds */
        $songIds = $request->input('song_ids', []);

        $action->execute($playlist, $songIds);

        return new PlaylistResource($this->loadDetails($playlist));
    }

    private function loadDetails(Playlist $playlist): Playlist
    {
        $userId = request()->user()?->id;

        return $playlist->load([
            'user:id,name',
            // El estado "me gusta" es por usuario: sin `withIsLiked` las
            // canciones de la playlist saldrían siempre como no favoritas.
            'items.song' => fn ($query) => $query
                ->with(['artist', 'album', 'mediaAsset:id,path'])
                ->withIsLiked($userId),
        ]);
    }
}
