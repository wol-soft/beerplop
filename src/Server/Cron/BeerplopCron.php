<?php

use Beerplop\Service\SaveStateService;
use Jobby\Jobby;
use WOLSoftCore\Server\App;
use WOLSoftCore\Server\Utils\ActivityStreamLogger;

$confPath = __DIR__ . '/../../../config/Conf.php';

require_once __DIR__ . '/../../../vendor/autoload.php';
require_once $confPath;

$jobby = new Jobby();

// initialize the app object
App::getInstance('beerplop');

$jobby->add('NotifyOfflineSaveStates', [
    'closure' => function () use ($confPath) {
        // as the cron is executed in a separate process the config needs to be included again
        require_once $confPath;

        $notifiedSaveStates = (new SaveStateService())->notifyOfflineSaveStates();

        if ($notifiedSaveStates > 0) {
            ActivityStreamLogger::getInstance()->log("[CRON] Notified $notifiedSaveStates offline save states");
        }

        return true;
    },
    // Clean up every night
    'schedule' => '*/10 * * * *',
    'output'   => Conf::getInstance()->activityStreamLog,
]);

$jobby->run();
