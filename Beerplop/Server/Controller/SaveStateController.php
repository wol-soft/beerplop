<?php

namespace Beerplop\Server\Controller;

use Beerplop\Server\Model\SaveState;
use Beerplop\Server\Model\SaveStateCollection;
use Beerplop\Server\Service\LobbyService;
use Server\Controller\Controller;
use Server\Exception\NoSessionException;
use Server\Exception\PermissionDeniedException;
use Server\Exception\RequiredParameterNotSetException;
use Server\Model\Request\Request;
use Server\Model\Response\JSONResponse;

/**
 * Class SaveStateController
 *
 * @package Beerplop\Server\Controller
 */
class SaveStateController extends Controller
{
    /**
     * @Route POST /apps/beerplop/save
     *
     * @param Request $request
     *
     * @return JSONResponse
     * @throws PermissionDeniedException
     * @throws RequiredParameterNotSetException
     * @throws NoSessionException
     */
    public function createSaveState(Request $request): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        $response = new JSONResponse();

        if ((new SaveStateCollection($this->app->getUser()->getId()))->count() >= 5) {
            return $response->setStatusCode(400);
        }

        $saveState = SaveState::create()
            ->setUserId($this->app->getUser()->getId())
            ->setTitle($request->requiredJson('title'))
            ->setSaveState($request->requiredJson('saveState'))
            ->generateAutosaveHash();

        if ($saveState->persist() === true) {
            return $response
                ->setStatusCode(201)
                ->addData('id', $saveState->getId())
                ->addData('autoSaveKey', $saveState->getAutosaveHash());
        }

        return $response->setStatusCode(400);
    }

    /**
     * @Route PUT /apps/beerplop/save/{int|$id}
     *
     * @param Request $request
     * @param int     $saveStateId
     *
     * @return JSONResponse
     * @throws PermissionDeniedException
     * @throws RequiredParameterNotSetException
     * @throws NoSessionException
     */
    public function updateSaveState(Request $request, int $saveStateId): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        $saveState = SaveState::create($saveStateId);

        if (empty($saveState->getId()) || $saveState->getUserId() !== $this->app->getUser()->getId()) {
            throw new PermissionDeniedException();
        }

        if ($saveState->getAutosaveHash() !== $request->requiredJson('autoSaveKey')) {
            return (new JSONResponse())->setStatusCode(409);
        }

        $saveState
            ->setSaveState($request->requiredJson('saveState'))
            ->setNotifiedOffline(false)
            ->setPlops(sprintf("%0.0f", $request->requiredJson('plops')));

        $response = new JSONResponse();

        if ($saveState->persist() === true) {
            return $this->_rankingResponseDecorator($response->setStatusCode(200), $saveState);
        }

        return $response->setStatusCode(400);
    }

    /**
     * @Route GET /apps/beerplop/save
     *
     * @return JSONResponse
     * @throws NoSessionException
     * @throws PermissionDeniedException
     */
    public function loadAvailableSaveStates(): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            return (new JSONResponse())->setStatusCode(403);
        }

        return (new JSONResponse())
            ->setData((new SaveStateCollection($this->app->getUser()->getId()))->toArray());
    }

    /**
     * @Route GET /apps/beerplop/save/{int|$id}
     *
     * @param Request $request
     * @param int     $saveStateId
     *
     * @return JSONResponse
     * @throws PermissionDeniedException
     * @throws NoSessionException
     */
    public function loadSaveState(Request $request, int $saveStateId): JSONResponse
    {
        $saveState = SaveState::create($saveStateId);

        if (!$saveState->isDemoSaveState()) {
            if (!$this->app->isUserLoggedIn()) {
                throw new NoSessionException();
            }

            if (empty($saveState->getId()) || $saveState->getUserId() !== $this->app->getUser()->getId()) {
                throw new PermissionDeniedException();
            }
        }

        if (!$saveState->isDemoSaveState()) {
            $saveState->generateAutosaveHash()->persist();
        }

        return $this->_rankingResponseDecorator(
            (new JSONResponse())->setData($saveState->toArray()),
            $saveState
        );
    }

    /**
     * @Route DELETE /apps/beerplop/save/{int|$id}
     *
     * @param Request $request
     * @param int     $saveStateId
     *
     * @return JSONResponse
     * @throws PermissionDeniedException
     * @throws NoSessionException
     */
    public function deleteSaveState(Request $request, int $saveStateId): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        $saveState = SaveState::create($saveStateId);

        if (empty($saveState->getId()) || $saveState->getUserId() !== $this->app->getUser()->getId()) {
            throw new PermissionDeniedException();
        }

        return (new JSONResponse())->setStatusCode($saveState->delete() === true ? 200 : 400);
    }

    /**
     * @param JSONResponse $response
     * @param SaveState    $saveState
     *
     * @return JSONResponse
     */
    private function _rankingResponseDecorator(JSONResponse $response, SaveState $saveState): JSONResponse
    {
        if ($saveState->getLobbyId()) {
            $response->addData('ranking', (new LobbyService())->getRanking($saveState->getLobbyId()));
        }

        return $response;
    }
}
