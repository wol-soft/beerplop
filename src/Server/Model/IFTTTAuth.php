<?php

namespace Beerplop\Model;

use Exception;
use WOLSoftCore\Server\Model\ObjectPluginModel;
use WOLSoftCore\Server\Traits\TimeAwareTrait;
use WOLSoftCore\User\Server\Model\User;

/**
 * Class IFTTTAuth
 *
 * @package Beerplop\Server\Model
 */
class IFTTTAuth extends ObjectPluginModel
{
    use TimeAwareTrait;

    public const BASE_MODEL = User::class;

    protected const TABLE    = 'beerplop_ifttt_auth';
    protected const DATABASE = 'beerplop';

    /** @var string */
    protected $_token = '';
    /** @var string */
    protected $_tokenRequestCode = '';

    /**
     * @return string
     */
    public function getToken(): string
    {
        return $this->_token;
    }

    /**
     * @return string
     */
    public function getTokenRequestCode(): ?string
    {
        return $this->_tokenRequestCode;
    }

    /**
     * @param string $tokenRequestCode
     *
     * @return $this
     */
    public function setTokenRequestCode(?string $tokenRequestCode): self
    {
        $this->_tokenRequestCode = $tokenRequestCode;

        return $this;
    }

    /**
     * @return $this
     *
     * @throws Exception
     */
    public function generateTokens(): self
    {
        $this->_token = bin2hex(random_bytes(32));
        $this->_tokenRequestCode = bin2hex(random_bytes(32));

        return $this;
    }
}
