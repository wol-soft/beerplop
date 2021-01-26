<?php

use WOLSoftCore\Server\Utils\Singleton;

class Conf extends Singleton
{
    protected function __construct()
    {
        $packageConfig         = json_decode(file_get_contents(__DIR__ . '/../package.json'));
        $this->beerplopversion = $packageConfig->beerplopversion;
        $this->userversion     = $packageConfig->userversion;
    }

    // Login server/database
    public $databases = [
        'core' => [
            'database' => 'wol-soft-core',
            'host'     => 'beerplop-mysql',
            'port'     => 3306,
            'user'     => 'beerplop',
            'password' => 'beerplop',
        ],
        'beerplop' => [
            'database' => 'beerplop',
            'host'     => 'beerplop-mysql',
            'port'     => 3306,
            'user'     => 'beerplop',
            'password' => 'beerplop',
        ],
    ];

    public $redis = [
        'host'   => 'beerplop-redis',
        'port'   => '6379',
        'prefix' => 'beerplop',
        'db'     => 1,
    ];

    // nodeJS server for remote connection and data tunneling
    public $nodeServer = [
        'host' => 'http://localhost',
        'port' => 8081
    ];

    // environment (DEV/TEST/STG/PROD)
    public $environment        = 'DEV';

    // don't fill this version fields, they are filled dynamically
    public $beerplopversion = '';
    public $userversion     = '';

    public $registrationEnabled = true;
    public $passwordResetSender = 'Beerplop';

    // profiling, logging etc.
    public $queryLog          = false;
    public $queryLogFile      = '/var/log/wolsoft/querylog.log';
    public $profile           = false;
    public $profileLogFile    = '/var/log/wolsoft/profiling.log';
    public $profileDatabase   = false;

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
    public $routingCache      = false;

    public $baseURL = 'http://localhost:8080';
}
