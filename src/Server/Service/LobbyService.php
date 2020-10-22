<?php

namespace Beerplop\Service;

use WOLSoftCore\Server\DBAL\DataFetcher;
use WOLSoftCore\Server\Model\WOLSoftApplication;

/**
 * Class LobbyService
 *
 * @package Beerplop\Server\Service
 */
class LobbyService extends WOLSoftApplication
{
    /**
     * @param string $lobbyId
     *
     * @return array
     */
    public function getRanking(string $lobbyId): array
    {
        return (array) DataFetcher::getInstance('beerplop')->fetchAll(
            'SELECT `name`, `plops`, `active` FROM `beerplop_savestate`
                JOIN `user` ON `user`.`id` = `userId`
                WHERE `lobbyId` = :lobbyId
                ORDER BY `plops` DESC',
            [':lobbyId' => $lobbyId]
        );
    }

    /**
     * Check if an user is associated with a lobby
     *
     * @param int    $userId
     * @param string $lobbyId
     *
     * @return bool
     */
    public function isUserInLobby(int $userId, string $lobbyId): bool
    {
        return DataFetcher::getInstance('beerplop')->fetchOne(
            'SELECT COUNT(`id`) FROM `beerplop_savestate` WHERE `userId` = :userId AND `lobbyId` = :lobbyId',
            [':userId' => $userId, ':lobbyId' => $lobbyId]
        ) > 0;
    }
}
