<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Offline\BuildDownloadUrlsAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Offline\DownloadUrlsRequest;
use App\Http\Resources\DownloadUrlResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OfflineController extends Controller
{
    /**
     * URLs firmadas para descargar canciones al dispositivo.
     *
     * El cliente pide una URL por canción y la guarda en la caché del
     * navegador. Se resuelve en lote para no multiplicar las peticiones
     * cuando se descarga una playlist entera.
     */
    public function urls(DownloadUrlsRequest $request, BuildDownloadUrlsAction $action): AnonymousResourceCollection
    {
        /** @var list<int> $songIds */
        $songIds = array_map('intval', (array) $request->validated('song_ids'));

        return DownloadUrlResource::collection($action->execute($songIds));
    }
}
