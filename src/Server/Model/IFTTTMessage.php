<?php

namespace Beerplop\Model;

use WOLSoftCore\Server\Model\WOLSoftModel;
use WOLSoftCore\Server\Traits\CreatedAwareTrait;
use WOLSoftCore\User\Server\Traits\UserAwareTrait;

/**
 * Class IFTTTMessage
 *
 * @package Beerplop\Server\Model
 */
class IFTTTMessage extends WOLSoftModel
{
    use CreatedAwareTrait, UserAwareTrait;

    protected const TABLE = 'beerplop_ifttt_message';

    /** @var string */
    protected $_message = '';
    /** @var string */
    protected $_channel = '';

    /**
     * @return string
     */
    public function getMessage(): string
    {
        return $this->_message;
    }

    /**
     * @param string $message
     *
     * @return $this
     */
    public function setMessage(string $message): self
    {
        $this->_message = $message;

        return $this;
    }

    /**
     * @return string
     */
    public function getChannel(): string
    {
        return $this->_channel;
    }

    /**
     * @param string $channel
     *
     * @return $this
     */
    public function setChannel(string $channel): self
    {
        $this->_channel = $channel;

        return $this;
    }
}
