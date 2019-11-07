<?php

use WOLSoftCore\Server\Utils\Singleton;

class Conf extends Singleton
{
    protected function __construct()
    {
        $packageConfig         = json_decode(file_get_contents(__DIR__ . '/../package.json'));
        $this->beerplopversion = $packageConfig->beerplopversion;
    }

    // Login server/database
    public $host         = 'beerplop-mysql';
    public $port         = '3306';
    public $user         = 'beerplop';
    public $password     = 'beerplop';
    public $database     = 'beerplop';

    public $redisHost    = 'beerplop-redis';
    public $redisPort    = '6379';
    public $redisEnabled = true;
    public $redisPrefix  = '';

    // nodeJS server for remote connection and data tunneling
    public $nodeServer = [
        'host' => 'http://localhost',
        'port' => 8081
    ];

    // environment (DEV/TEST/STG/PROD)
    public $environment        = 'DEV';

    // don't fill this version fields, they are filled dynamically
    public $beerplopversion    = '';

    public $registrationEnabled = true;

    // profiling, logging etc.
    public $queryLog          = false;
    public $queryLogFile      = '/var/log/wolsoft/querylog.log';
    public $profile           = false;
    public $profileLogFile    = '/var/log/wolsoft/profiling.log';
    public $profileDatabase   = false;
    public $activityStreamLog = false;

    public $applicationHomeRoute = '';

    public $iftttAccessToken  = '';
    public $iftttServiceKey   = '';
    public $oAuthClientId     = '';
    public $oAuthClientSecret = '';

    public $gtm_id = '';

    // define the roles a new registered user should have
    public $defaultRoles = [];

    public $defaultHeader = [];

    public $applicationPath   = '/var/www/beerplop/src';
    public $templateCachePath = false;
}
