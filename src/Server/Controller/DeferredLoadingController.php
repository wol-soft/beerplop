<?php

namespace Beerplop\Controller;

use Parsedown;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\HTMLResponse;
use WOLSoftCore\Server\Router\Attribute\Route;
use WOLSoftCore\Server\Router\Attribute\RouteGroup;
use WOLSoftCore\Server\Utils\Translator;

/**
 * Class DeferredLoadingController
 *
 * @package Beerplop\Server\Controller
 */
#[RouteGroup('/deferred')]
class DeferredLoadingController extends Controller
{
    /**
     * Requires providing a version for a working cache
     */
    #[Route(Request::GET, '/client-templates/{regex("[\d.]+")|version}')]
    public function clientTemplatesAction($version): HTMLResponse
    {
        return (new HTMLResponse())
            ->setTemplate('View/Deferred/clientTemplates.twig')
            ->cache(60 * 60 * 24 * 30);
    }

    /**
     * Requires providing a version for a working cache
     */
    #[Route(Request::GET, '/images/{regex("[\d.]+")|version}')]
    public function imagesAction($version): HTMLResponse
    {
        return (new HTMLResponse())
            ->setTemplate('View/Deferred/svg.twig')
            ->cache(60 * 60 * 24 * 30);
    }

    /**
     * Requires providing a version for a working cache
     */
    #[Route(Request::GET, '/modals/{regex("[\d.]+")|version}')]
    public function modalsAction($version): HTMLResponse
    {
        return (new HTMLResponse())
            ->addVariable(
                'translator',
                Translator::getInstance(null, Translator::LNG_ENGLISH, __DIR__ . '/../../language/')
            )
            ->addVariable('app', $this->app)
            ->addVariable(
                'changelog',
                (new Parsedown())->text(
                    preg_replace(
                        '/#(\d+)/',
                        '<a href="https://github.com/wol-soft/beerplop-issues/issues/$1" target="_blank">#$1</a>',
                        file_get_contents(__DIR__ . '/../../Changelog.txt')
                    )
                )
            )
            ->setTemplate('View/Deferred/modal.twig')
            ->cache(60 * 60 * 24 * 30);
    }
}
