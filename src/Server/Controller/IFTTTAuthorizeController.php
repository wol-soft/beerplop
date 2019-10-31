<?php

namespace Beerplop\Controller;

use Beerplop\Model\IFTTTAuth;
use Exception;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\Exception\NoSessionException;
use WOLSoftCore\Server\Exception\NotFoundException;
use WOLSoftCore\Server\Exception\PermissionDeniedException;
use WOLSoftCore\Server\Exception\RequiredParameterNotSetException;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\HTMLResponse;
use WOLSoftCore\Server\Model\Response\HTTPResponse;
use WOLSoftCore\Server\Model\Response\JSONResponse;
use WOLSoftCore\Server\Utils\ActivityStreamLogger;
use WOLSoftCore\Server\Utils\Translator;

/**
 * Class IFTTTAuthorizeController
 *
 * @package Beerplop\Server\Controller
 */
class IFTTTAuthorizeController extends Controller
{
    /**
     * @Route GET /ifttt/authorize
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

        if ($request->get('client_id') !== $this->app->getConf()->oAuthClientId) {
            throw new PermissionDeniedException();
        }

        $this->app->setSessionEntry('IFTTT-redirect-URI', $request->requiredGet('redirect_uri'));
        $this->app->setSessionEntry('IFTTT-state', $request->requiredGet('state'));

        return (new HTMLResponse())
            ->setTemplate('View/authorizeIFTTT.twig')
            ->addVariable('app', $this->app)
            ->addVariable(
                'translator',
                Translator::getInstance(null, Translator::LNG_ENGLISH, __DIR__ . '/../../language/')
            );
    }

    /**
     * @Route POST /ifttt/authorize
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
     * @Route GET /ifttt/authorized
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
     * @Route POST /ifttt/token
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
        if ($request->post('client_id') !== $this->app->getConf()->oAuthClientId ||
            $request->post('client_secret') !== $this->app->getConf()->oAuthClientSecret
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
