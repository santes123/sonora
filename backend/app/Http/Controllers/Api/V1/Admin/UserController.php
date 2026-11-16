<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Admin\CreateUserAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Gestión de cuentas del sitio (solo administradores).
 *
 * Es el sustituto del registro público cuando este está cerrado: el
 * administrador da de alta a quien quiera sin abrir la puerta a todos.
 */
class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $users = User::query()
            ->orderByDesc('created_at')
            ->paginate((int) ($validated['per_page'] ?? 50))
            ->withQueryString();

        return UserResource::collection($users);
    }

    public function store(CreateUserRequest $request, CreateUserAction $action): JsonResponse
    {
        $user = $action->execute(
            $request->string('name')->toString(),
            $request->string('email')->toString(),
            $request->string('password')->toString(),
            $request->string('role', 'user')->toString(),
        );

        return (new UserResource($user))->response()->setStatusCode(201);
    }
}
