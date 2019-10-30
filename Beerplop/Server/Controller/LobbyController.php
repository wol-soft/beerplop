<?php

namespace Beerplop\Server\Controller;

use Beerplop\Server\Model\SaveState;
use Beerplop\Server\Service\LobbyService;
use Server\Controller\Controller;
use Server\Exception\NoSessionException;
use Server\Model\Request\Request;
use Server\Model\Response\HTMLResponse;
use Server\Model\Response\JSONResponse;
use Server\Utils\Translator;

/**
 * Class LobbyController
 *
 * @package Beerplop\Server\Controller
 */
class LobbyController extends Controller
{
    /**
     * @Route GET /apps/beerplop/lobby
     *
     * @return HTMLResponse
     * @throws NoSessionException
     */
    public function createLobby(): HTMLResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        return (new HTMLResponse())
            ->addVariable('app', $this->app)
            ->addVariable('isAdmin', true)
            ->addVariable('translator', Translator::getInstance(null, Translator::LNG_ENGLISH, 'Beerplop'))
            ->setTemplate('Beerplop/View/lobby.twig');
    }

    /**
     * @Route GET /apps/beerplop/lobby/{regex("[\w-]+")|$lobbyId}
     *
     * @param Request $request
     * @param string  $lobbyId
     *
     * @return HTMLResponse
     * @throws NoSessionException
     */
    public function joinLobby(Request $request, string $lobbyId): HTMLResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        return (new HTMLResponse())
            ->addVariable('app', $this->app)
            ->addVariable('isAdmin', false)
            ->addVariable('lobbyId', $lobbyId)
            ->addVariable('translator', Translator::getInstance(null, Translator::LNG_ENGLISH, 'Beerplop'))
            ->setTemplate('Beerplop/View/lobby.twig');
    }

    /**
     * @Route POST /apps/beerplop/lobby/{regex("[\w-]+")|$lobbyId}/save
     *
     * @param Request $request
     * @param string  $lobbyId
     *
     * @return JSONResponse
     */
    public function createSaveStatesForLobby(Request $request, string $lobbyId): JSONResponse
    {
        $saveStateList = [];
        foreach ($request->requiredJson('players') as $userId) {
            $saveState = SaveState::create()
                ->setLobbyId($lobbyId)
                ->setTitle($request->requiredJson('title'))
                ->setUserId($userId);

            if ($saveState->persist() !== true) {
                return (new JSONResponse())->setStatusCode(400);
            }

            $saveStateList[$userId] = $saveState->getId();
        }

        return (new JSONResponse())
            ->setData($saveStateList);
    }

    /**
     * @Route GET /apps/beerplop/lobby/{regex("[\w-]+")|$lobbyId}/ranking
     *
     * @param Request $request
     * @param string  $lobbyId
     *
     * @return JSONResponse
     */
    public function getLobbyRanking(Request $request, string $lobbyId): JSONResponse
    {
        $lobbyService = new LobbyService();

        if ($lobbyService->isUserInLobby($this->app->getUser()->getId(), $lobbyId)) {
            return (new JSONResponse())->addData('ranking', $lobbyService->getRanking($lobbyId));
        }

        return (new JSONResponse())->setStatusCode(403);
    }
}
