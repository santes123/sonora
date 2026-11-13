import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Heart, Loader2, SearchX } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { SongList } from '../components/SongList'
import { PageLoader } from '../components/Spinner'
import { api, firstError } from '../lib/api'
import { cn, pluralize } from '../lib/format'
import type { SongQuery } from '../types'

type Sort = NonNullable<SongQuery['sort']>

const sortOptions: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'title', label: 'Título A-Z' },
  { value: 'artist', label: 'Artista A-Z' },
  { value: 'duration', label: 'Duración' },
]

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const term = params.get('q')?.trim() ?? ''
  const sortParam = params.get('sort') as Sort | null
  const sort: Sort = sortOptions.some((option) => option.value === sortParam)
    ? (sortParam as Sort)
    : 'newest'
  const onlyLiked = params.get('liked') === '1'

  const query = useInfiniteQuery({
    queryKey: ['songs', 'search', term, sort, onlyLiked],
    queryFn: ({ pageParam }) =>
      api.songs({
        q: term,
        sort,
        liked: onlyLiked ? 1 : undefined,
        page: pageParam,
        per_page: 30,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.current_page < lastPage.meta.last_page
        ? lastPage.meta.current_page + 1
        : undefined,
    enabled: term.length > 0,
  })

  const songs = query.data?.pages.flatMap((page) => page.data) ?? []
  const total = query.data?.pages[0]?.meta.total ?? 0

  const updateSort = (value: Sort) => {
    const next = new URLSearchParams(params)
    next.set('sort', value)
    setParams(next, { replace: true })
  }

  const toggleOnlyLiked = () => {
    const next = new URLSearchParams(params)

    if (onlyLiked) {
      next.delete('liked')
    } else {
      next.set('liked', '1')
    }

    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Buscar</h1>
          <p className="text-ink-300 mt-1 text-sm">
            {term
              ? `${pluralize(total, 'resultado', 'resultados')} para “${term}”.`
              : 'Busca por título, artista o álbum.'}
          </p>
        </div>

        {term ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleOnlyLiked}
              aria-pressed={onlyLiked}
              className={cn(
                'btn-outline',
                onlyLiked && 'border-accent text-accent-soft bg-accent/10',
              )}
            >
              <Heart className={cn('size-4', onlyLiked && 'fill-current')} aria-hidden="true" />
              Solo mis favoritas
            </button>

            <label htmlFor="sort" className="text-ink-300 text-sm">
              Ordenar por
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(event) => updateSort(event.target.value as Sort)}
              className="field w-auto py-2"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {!term ? (
        <EmptyState
          icon={SearchX}
          title="¿Qué quieres escuchar?"
          description="Usa el buscador superior. Ignoramos acentos y mayúsculas: “corazon” encuentra “Corazón”."
        />
      ) : query.isLoading ? (
        <PageLoader label="Buscando canciones" />
      ) : query.isError ? (
        <EmptyState
          icon={SearchX}
          title="La búsqueda ha fallado"
          description={firstError(query.error)}
          action={
            <button type="button" onClick={() => query.refetch()} className="btn-primary">
              Reintentar
            </button>
          }
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description={
            onlyLiked
              ? `No tienes favoritas que coincidan con “${term}”.`
              : `No encontramos nada para “${term}”. Prueba con otro título, artista o álbum.`
          }
        />
      ) : (
        <>
          <SongList
            songs={songs}
            label={onlyLiked ? `Tus favoritas para ${term}` : `Resultados para ${term}`}
          />

          {query.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="btn-outline"
              >
                {query.isFetchingNextPage ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Cargar más
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
