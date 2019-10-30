<?php

namespace Beerplop\Server\Model;

use Server\Model\Collection\WOLSoftModelCollection;

/**
 * Class SaveStateCollection
 *
 * @package Beerplop\Server\Model
 */
class SaveStateCollection extends WOLSoftModelCollection
{
    public    const COLLECTION_MODEL = SaveState::class;
    protected const TABLE = 'beerplop_savestate';

    /** @var string */
    protected $_primaryColumn = 'userId';
}
