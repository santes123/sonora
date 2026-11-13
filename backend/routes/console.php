<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('media:gc --deep')
    ->dailyAt('03:15')
    ->withoutOverlapping();

Schedule::command('queue:prune-failed --hours=168')
    ->weekly()
    ->withoutOverlapping();
