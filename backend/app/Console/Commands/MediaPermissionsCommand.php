<?php

namespace App\Console\Commands;

use App\Services\Media\MediaStorage;
use FilesystemIterator;
use Generator;
use Illuminate\Console\Command;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Normaliza los permisos del disco de medios.
 *
 * Nginx corre en un contenedor (y usuario) distinto al de PHP-FPM y necesita
 * atravesar los directorios y leer los ficheros para servir X-Accel-Redirect.
 * Este comando repara medios creados con versiones anteriores (directorios
 * 0700) y es idempotente: solo cambia lo que está mal.
 */
class MediaPermissionsCommand extends Command
{
    private const DIRECTORY_MODE = 0755;

    private const FILE_MODE = 0644;

    protected $signature = 'media:permissions {--dry-run : Solo muestra los cambios}';

    protected $description = 'Ajusta los permisos de medios para que Nginx pueda servirlos con X-Accel';

    public function handle(MediaStorage $storage): int
    {
        $root = $storage->absolutePath('');

        if ($root === null || ! is_dir($root)) {
            $this->error('No se pudo localizar el disco de medios.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $changed = 0;
        $failed = 0;

        foreach ($this->paths($root) as $path => $mode) {
            if ((fileperms($path) & 0777) === $mode) {
                continue;
            }

            $changed++;

            if ($dryRun) {
                $this->line("[dry-run] {$mode}: {$path}");

                continue;
            }

            clearstatcache(true, $path);

            if (! @chmod($path, $mode)) {
                $this->warn("No se pudo cambiar: {$path}");
                $failed++;
            }
        }

        $this->info(($dryRun ? 'Se ajustarían ' : 'Ajustados ')."{$changed} elementos.");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    /** @return Generator<string, int> */
    private function paths(string $root): Generator
    {
        yield $root => self::DIRECTORY_MODE;

        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        );

        /** @var SplFileInfo $item */
        foreach ($items as $item) {
            // El disco no escribe enlaces simbólicos; si aparece uno, no se
            // sigue para no cambiar permisos fuera del árbol de medios.
            if ($item->isLink()) {
                continue;
            }

            yield $item->getPathname() => $item->isDir() ? self::DIRECTORY_MODE : self::FILE_MODE;
        }
    }
}
