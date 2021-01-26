<?php

namespace Beerplop\Service;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Psr7\Request;
use WOLSoftCore\Server\Model\WOLSoftApplication;

/**
 * Class IFTTTService
 *
 * @package Beerplop\Server\Service
 */
class IFTTTService extends WOLSoftApplication
{
    /**
     * Notify IFTTT about new user messages
     *
     * @param int $userId
     */
    public function notifyNewUserMessage(int $userId): void
    {
        $request = new Request(
            'POST',
            'https://realtime.ifttt.com/v1/notifications',
            [
                'IFTTT-Service-Key' => $this->app->getConf()->iftttServiceKey,
                'X-Request-ID' => uniqid(),
                'Content-Type' => 'application/json',
            ],
            json_encode([
                'data' => [
                    [
                        'user_id' => (string) $userId,
                    ],
                ],
            ]),
        );

        try {
            (new Client())->send($request);
        } catch (GuzzleException $e) {
            $this->app->log($e->getMessage());
        }
    }
}
