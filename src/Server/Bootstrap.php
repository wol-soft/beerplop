<?php

namespace Beerplop;

use WOLSoftCore\Server\App;
use WOLSoftCore\Server\Interfaces\ApplicationBootstrapInterface;
use WOLSoftCore\Server\Model\Request\Request;

/**
 * Class Bootstrap
 *
 * @package Beerplop\Server
 */
class Bootstrap implements ApplicationBootstrapInterface
{
    /**
     * @inheritdoc
     */
    public function initApplication(App $app, Request $request): void
    {
        $app->getConf()->applicationHomeRoute = '/plop';

        $app->setSessionEntry('login-redirect', $request->getRouter()->getRoute());
        $app->getExceptionHandler()->redirectToLoginOnNoSessionException('user/login');
    }
}
