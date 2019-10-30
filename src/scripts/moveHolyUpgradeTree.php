<?php

/**
 * Script to move the coordinates of all holy upgrades.
 *
 * Usage:
 *
 * php moveHolyUpgradeTree.php <pixelRight> <pixelBottom>
 */

$file = './../client/js/Game/Model/HolyUpgradeStorage.js';

file_put_contents(
    $file,
    preg_replace_callback(
        '/coordinates: \[(?<left>\d+), (?<top>\d+)\]/',
        function ($matches) use ($argv) {
            return 'coordinates: [' . ($matches['left'] + $argv[1]) . ', ' . ($matches['top'] + $argv[2]) . ']';
        },
        file_get_contents($file)
    )
);
