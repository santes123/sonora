import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Trash2 } from 'lucide-react'
import { SongCard } from './SongCard'
import { InlineConfirm } from './InlineConfirm'
import { useToast } from '../context/ToastContext'
import { api, firstError } from '../lib/api'

/**
 * Carrusel "Escuchado recientemente".
 *
 * El historial se registra en el servidor cuando el audio empieza a sonar, así
 * que el carrusel refleja lo que el usuario ha escuchado de verdad. No se
 * muestra si el usuario todavía no ha escuchado nada.
 */
export function RecentlyPlayed() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: () => api.history(12),
    // El historial cambia con cada reproducción: se relee al montar la
    // página en lugar de esperar a que caduque la caché.
    staleTime: 10_000,
    refetchOnMount: 'always',
  })

  const clear = useMutation({
    mutationFn: () => api.clearHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] })
      toast.success('Historial vaciado.')
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const entries = data?.data ?? []

  if (isLoading || entries.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="recently-played-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="recently-played-heading" className="text-xl font-bold text-white">
          Escuchado recientemente
        </h2>

        <div className="flex items-center gap-3">
          <span className="text-ink-400 inline-flex items-center gap-1.5 text-xs">
            <History className="size-3.5" aria-hidden="true" />
            {entries.length}
          </span>

          <InlineConfirm
            question="¿Vaciar el historial?"
            confirmLabel="Sí, vaciar"
            onConfirm={() => clear.mutate()}
            disabled={clear.isPending}
            icon={<Trash2 className="size-3.5" aria-hidden="true" />}
            triggerLabel="Vaciar"
            triggerClassName="text-ink-400 hover:text-red-300 inline-flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {entries.map((entry, index) => (
          <SongCard key={entry.id} song={entry} queue={entries} index={index} />
        ))}
      </div>
    </section>
  )
}
