<?php

namespace Beerplop\Server\Controller;

use Beerplop\Server\Model\IFTTTAuth;
use Exception;
use Server\Controller\Controller;
use Server\Exception\NoSessionException;
use Server\Exception\NotFoundException;
use Server\Exception\PermissionDeniedException;
use Server\Exception\RequiredParameterNotSetException;
use Server\Model\Request\Request;
use Server\Model\Response\HTMLResponse;
use Server\Model\Response\HTTPResponse;
use Server\Model\Response\JSONResponse;
use Server\Utils\ActivityStreamLogger;
use Server\Utils\Translator;

/**
 * Class IFTTTAuthorizeController
 *
 * @package Beerplop\Server\Controller
 */
class IFTTTAuthorizeController extends Controller
{
    private const OAUTH_CLIENT_ID     = '2bfe9862daa69fef2384ded645c152cf10f24823f1ac3ef25e4e1c4416a96126';
    private const OAUTH_CLIENT_SECRET = 'e8ee40927e01f6d0371e8b31aea494a6c601b2214d16f2c3d61148c6060dbc0a';

    /**
     * @Route GET /apps/beerplop/ifttt/authorize
     *
     * @param Request $request
     *
     * @return HTMLResponse
     *
     * @throws NoSessionException
     * @throws PermissionDeniedException
     * @throws RequiredParameterNotSetException
     */
    public function showIFTTTAuthorizeAction(Request $request): HTMLResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            ActivityStreamLogger::getInstance()->log('Initialized IFTTT authorization without session');

            throw new NoSessionException();
        }

        ActivityStreamLogger::getInstance()->log('Initialized IFTTT authorization', $this->app->getUser()->getId());

        if ($request->get('client_id') !== self::OAUTH_CLIENT_ID) {
            throw new PermissionDeniedException();
        }

        $this->app->setSessionEntry('IFTTT-redirect-URI', $request->requiredGet('redirect_uri'));
        $this->app->setSessionEntry('IFTTT-state', $request->requiredGet('state'));

        return (new HTMLResponse())
            ->setTemplate('Beerplop/View/authorizeIFTTT.twig')
            ->addVariable('translator', Translator::getInstance(null, Translator::LNG_ENGLISH, 'Beerplop'))
            ->addVariable('app', $this->app);
    }

    /**
     * @Route POST /apps/beerplop/ifttt/authorize
     *
     * @return HTTPResponse
     *
     * @throws NoSessionException
     * @throws Exception
     */
    public function authorizeIFTTTAction(): HTTPResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        $iftttAuth = IFTTTAuth::create($this->app->getUser()->getId())
            ->setId($this->app->getUser()->getId())
            ->generateTokens();

        if (!$iftttAuth->persist()) {
            return (new HTTPResponse())->setStatusCode(502);
        }

        return (new HTTPResponse())->setRedirectTo(
            $this->app->getSessionEntry('IFTTT-redirect-URI') . "?code={$iftttAuth->getTokenRequestCode()}&state=" .
                $this->app->getSessionEntry('IFTTT-state')
        );
    }

    /**
     * @Route GET /apps/beerplop/ifttt/authorized
     *
     * @return JSONResponse
     *
     * @throws NoSessionException
     * @throws Exception
     */
    public function authorizedIFTTTAction(): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        $iftttAuth = IFTTTAuth::create($this->app->getUser()->getId());

        if (!$iftttAuth->getId() || $iftttAuth->getTokenRequestCode() !== null) {
            return (new JSONResponse())->setStatus(false);
        }

        return new JSONResponse();
    }

    /**
     * @Route POST /apps/beerplop/ifttt/token
     *
     * @param Request $request
     *
     * @return JSONResponse
     *
     * @throws PermissionDeniedException
     * @throws NotFoundException
     * @throws RequiredParameterNotSetException
     */
    public function tokenAction(Request $request): JSONResponse
    {
        if ($request->post('client_id') !== self::OAUTH_CLIENT_ID ||
            $request->post('client_secret') !== self::OAUTH_CLIENT_SECRET
        ) {
            $this->app->log('Tried IFTTT connection with invalid credentials');

            throw new PermissionDeniedException();
        }

        /** @var IFTTTAuth $iftttAuth */
        $iftttAuth = IFTTTAuth::create()->findBy('tokenRequestCode', $request->requiredPost('code'));

        if (!$iftttAuth->getId()) {
            throw new NotFoundException();
        }

        $iftttAuth->setTokenRequestCode(null)->persist();

        ActivityStreamLogger::getInstance()->log('Completed IFTTT authorization', $iftttAuth->getId());

        return (new JSONResponse())->setResponse(json_encode([
            'token_type' => 'Bearer',
            'access_token' => $iftttAuth->getToken(),
        ]));
    }
}
