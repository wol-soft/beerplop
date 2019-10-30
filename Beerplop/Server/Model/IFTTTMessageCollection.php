<?php

namespace Beerplop\Server\Model;

use Server\Model\Collection\WOLSoftModelCollection;

/**
 * Class IFTTTMessageCollection
 *
 * @package Beerplop\Server\Model
 */
class IFTTTMessageCollection extends WOLSoftModelCollection
{
    public    const COLLECTION_MODEL = IFTTTMessage::class;
    protected const TABLE = 'beerplop_ifttt_message';

    /** @var string */
    protected $_primaryColumn = 'userId';
}
