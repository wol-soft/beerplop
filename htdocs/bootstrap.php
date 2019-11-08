<?php

use WOLSoftCore\Server\App;

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/Conf.php';

return App::getInstance('beerplop')->run();
