<?php

namespace Beerplop\Server\Model;

use Server\Model\WOLSoftModel;
use Server\Traits\TimeAwareTrait;
use User\Server\Traits\UserAwareTrait;

/**
 * Class SaveState
 *
 * @package Beerplop\Server\Model
 */
class SaveState extends WOLSoftModel
{
    use UserAwareTrait, TimeAwareTrait;

    protected const TABLE = 'beerplop_savestate';

    /** @var string */
    protected $_title = '';
    /** @var string */
    protected $_saveState = '';
    /** @var string */
    protected $_autosaveHash;
    /** @var string */
    protected $_plops;
    /** @var string */
    protected $_lobbyId;
    /** @var bool */
    protected $_notifiedOffline = false;

    /**
     * @return string
     */
    public function getTitle(): string
    {
        return $this->_title;
    }

    /**
     * @param string $title
     *
     * @return SaveState
     */
    public function setTitle(string $title)
    {
        $this->_title = $title;
        return $this;
    }

    /**
     * @return string
     */
    public function getSaveState(): string
    {
        return $this->_saveState;
    }

    /**
     * @param string $saveState
     *
     * @return SaveState
     */
    public function setSaveState(string $saveState)
    {
        $this->_saveState = $saveState;
        return $this;
    }

    /**
     * @return string
     */
    public function getAutosaveHash(): string
    {
        return $this->_autosaveHash;
    }

    /**
     * @return SaveState
     */
    public function generateAutosaveHash()
    {
        $this->_autosaveHash = md5(time() . rand());
        return $this;
    }

    /**
     * @return string
     */
    public function getPlops(): string
    {
        return $this->_plops;
    }

    /**
     * @param string $plops
     *
     * @return SaveState
     */
    public function setPlops(string $plops)
    {
        $this->_plops = $plops;
        return $this;
    }

    /**
     * @return string
     */
    public function getLobbyId(): ?string
    {
        return $this->_lobbyId;
    }

    /**
     * @param string $lobbyId
     *
     * @return SaveState
     */
    public function setLobbyId(string $lobbyId)
    {
        $this->_lobbyId = $lobbyId;
        return $this;
    }

    /**
     * @return bool
     */
    public function isDemoSaveState():bool
    {
        return $this->_userId == 1;
    }

    /**
     * @return bool
     */
    public function isNotifiedOffline(): bool
    {
        return $this->_notifiedOffline;
    }

    /**
     * @param bool $notifiedOffline
     *
     * @return SaveState
     */
    public function setNotifiedOffline(bool $notifiedOffline): self
    {
        $this->_notifiedOffline = $notifiedOffline;
        return $this;
    }

    /**
     * @inheritdoc
     */
    public function toArray(bool $withAllData = true, int $depth = 1): array
    {
        return array_merge(parent::toArray($withAllData, $depth), ['demoSaveState' => $this->isDemoSaveState()]);
    }
}
