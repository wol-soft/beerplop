<?php

namespace Beerplop\Service;

use WOLSoftCore\Server\Model\WOLSoftApplication;

/**
 * Class SaveStateService
 *
 * @package Beerplop\Server\Service
 */
class SaveStateService extends WOLSoftApplication
{
    // the trigger time after which a save state is considered offline
    const OFFLINE_TRIGGER_TIME = 25;

    /**
     * Trigger the notification of all inactive but IFTTT connected save states
     *
     * @return int
     */
    public function notifyOfflineSaveStates(): int
    {
        $this->app->getDataFetcher()->query(
            'INSERT INTO `beerplop_ifttt_message` (userId, message, channel) 
                SELECT bss.userId, CONCAT_WS("", "Save state \"", bss.title, "\" offline"), "Save state"
                  FROM beerplop_savestate AS bss
                RIGHT JOIN beerplop_ifttt_auth AS bia ON bia.id = bss.`userId`
                WHERE notifiedOffline = FALSE
                  AND bss.modified < DATE_SUB(CURRENT_TIME(), INTERVAL ' . self::OFFLINE_TRIGGER_TIME . ' MINUTE)'
        );

        $notifiedOfflineSaveStates = $this->app->getDataFetcher()->getRowCount();

        $userIds = $this->app->getDataFetcher()->fetchColumn(
            'SELECT DISTINCT userId FROM beerplop_savestate AS bss
                RIGHT JOIN beerplop_ifttt_auth AS bia ON bia.id = bss.`userId`
                WHERE notifiedOffline = FALSE
                  AND bss.modified < DATE_SUB(CURRENT_TIME(), INTERVAL ' . self::OFFLINE_TRIGGER_TIME . ' MINUTE)'
        );

        $this->app->getDataFetcher()->query(
            'UPDATE beerplop_savestate SET notifiedOffline = TRUE
                WHERE notifiedOffline = FALSE
                  AND id > 0
                  AND modified < DATE_SUB(CURRENT_TIME(), INTERVAL ' . self::OFFLINE_TRIGGER_TIME . ' MINUTE)'
        );

        $iftttService = new IFTTTService();
        foreach ($userIds as $userId) {
            $iftttService->notifyNewUserMessage($userId);
        }

        return $notifiedOfflineSaveStates;
    }
}
