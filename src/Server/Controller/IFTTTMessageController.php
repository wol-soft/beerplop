<?php

namespace Beerplop\Controller;

use Beerplop\Model\IFTTTAuth;
use Beerplop\Model\IFTTTMessage;
use Beerplop\Service\IFTTTService;
use DateTime;
use DateTimeZone;
use Exception;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\DBAL\DataFetcher;
use WOLSoftCore\Server\Exception\NoSessionException;
use WOLSoftCore\Server\Exception\PermissionDeniedException;
use WOLSoftCore\Server\Exception\RequiredParameterNotSetException;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\JSONResponse;
use WOLSoftCore\Server\Router\Attribute\Route;

/**
 * Class IFTTTMessageController
 *
 * @package Beerplop\Server\Controller
 */
class IFTTTMessageController extends Controller
{
    /**
     * @param Request $request
     *
     * @return JSONResponse
     *
     * @throws NoSessionException
     * @throws PermissionDeniedException
     * @throws RequiredParameterNotSetException
     * @throws Exception
     */
    #[Route(Request::POST, '/messages')]
    public function addMessagesAction(Request $request): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        if (!IFTTTAuth::create($this->app->getUser()->getId())->getId()) {
            throw new PermissionDeniedException();
        }

        $timezone = new DateTimeZone($request->requiredJson('timezone'));

        DataFetcher::getInstance('beerplop')->startTransaction();
        foreach ($request->requiredJson('messages') as $message) {
            IFTTTMessage::create()
                ->setMessage($message['message'])
                ->setChannel($message['channel'])
                ->setCreated((new DateTime($message['time']))->setTimezone($timezone))
                ->setUser($this->app->getUser())
                ->persist();
        }

        if (!DataFetcher::getInstance('beerplop')->commitTransaction()) {
            return (new JSONResponse())->setStatus(false)->setStatusCode(502);
        }

        (new IFTTTService())->notifyNewUserMessage($this->app->getUser()->getId());

        return new JSONResponse();
    }
}
