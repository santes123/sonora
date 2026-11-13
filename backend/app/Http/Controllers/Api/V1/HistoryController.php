<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\History\ListListeningHistoryAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\History\RecordListeningRequest;
use App\Http\Resources\HistoryResource;
use App\Jobs\RecordListeningJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class HistoryController extends Controller
{
    /**
     * Historial de reproducción del usuario, de más reciente a más antigua.
     */
    public function index(Request $request, ListListeningHistoryAction $action): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $history = $action->execute(
            $request->user(),
            (int) ($validated['per_page'] ?? 24),
        );

        return HistoryResource::collection($history);
    }

    /**
     * Registra una reproducción.
     *
     * Responde 202: la escritura se encola para que el reproductor no espere
     * a la base de datos. El cliente no debe bloquear el audio por esto.
     */
    public function store(RecordListeningRequest $request): JsonResponse
    {
        RecordListeningJob::dispatch(
            $request->user()->id,
            (int) $request->validated('song_id'),
        );

        return response()->json(['data' => ['status' => 'queued']], 202);
    }

    /**
     * Vacía el historial del usuario.
     */
    public function destroy(Request $request): Response
    {
        $request->user()->listeningHistory()->delete();

        return response()->noContent();
    }
}
