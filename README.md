# Beerplop

To have a running Beerplop instance ready to develop execute the following steps:

* clone the repository
* switch to the root directory of the project
* run `composer update` (installation: https://getcomposer.org/download/)
* run `npn install` (installation: https://www.npmjs.com/get-npm)
* run `grunt build`
* run `docker-compose up --build` (installation: https://docs.docker.com/compose/install/)

Beerplop is now available at http://localhost

To develop simply modify files, the directory you cloned the project into is linked with the docker container. If you modify JavaScript files or stylings don't forget to rebuild the application with `grunt build`.