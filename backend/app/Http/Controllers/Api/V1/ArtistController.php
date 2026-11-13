<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ArtistResource;
use App\Models\Artist;
use App\Support\TextNormalizer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ArtistController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $term = TextNormalizer::normalize($request->string('q')->toString());

        $artists = Artist::query()
            ->withCount('songs')
            ->when($term !== '', fn ($query) => $query->where('name_normalized', 'like', $term.'%'))
            ->orderBy('name_normalized')
            ->paginate($request->integer('per_page', 24))
            ->withQueryString();

        return ArtistResource::collection($artists);
    }
}
