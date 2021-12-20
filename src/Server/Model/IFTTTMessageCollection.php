<?php

namespace Beerplop\Model;

use WOLSoftCore\Server\Model\Collection\WOLSoftModelCollection;

/**
 * Class IFTTTMessageCollection
 *
 * @package Beerplop\Server\Model
 */
class IFTTTMessageCollection extends WOLSoftModelCollection
{
    public const COLLECTION_MODEL = IFTTTMessage::class;

    protected const TABLE    = 'beerplop_ifttt_message';
    protected const DATABASE = 'beerplop';

    protected string $primaryColumn = 'userId';
}
