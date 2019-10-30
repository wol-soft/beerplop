<?php

namespace Beerplop\Server;

use Server\App;
use Server\Interfaces\ApplicationBootstrapInterface;
use Server\Model\Request\Request;

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
        $app->getConf()->applicationHomeRoute = '/apps/beerplop/plop';

        $app->setSessionEntry('login-redirect', $request->getRouter()->getRoute());
        $app->getExceptionHandler()->redirectToLoginOnNoSessionException('/apps/user/login');
    }
}
