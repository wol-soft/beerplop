<p align="center">
  <a href="https://wol-soft.de/apps/beerplop/plop" target="_blank">
    <img alt="Beerplop" width="100" src="https://raw.githubusercontent.com/wol-soft/beerplop/master/src/View/Img/main-beer.svg?sanitize=true">
  </a>
</p>

# Beerplop

Repository for the incremental game Beerplop.

If you encounter a bug, have a feature request or an idea for an improvement just open an issue or start contributing to Beerplop.

Some links:

- [Beerplop game](https://wol-soft.de/apps/beerplop/plop)
- [Beerplop wiki](https://wol-soft.de/apps/beerplop/wiki)

Happy coding, Cheers!

## Development

To have a running Beerplop instance ready to develop execute the following steps:

* clone the repository
* switch to the root directory of the project
* run `docker-compose up --build` (installation: https://docs.docker.com/compose/install/)

During the first start up some containers may throw errors because not all required dependencies are yet available. They will continue to restart until the containers which install the dependencies are finished (beerplop-composer).
To check if everything is finished switch to a second terminal and execute `docker ps`. You should see six running containers (Status **Up**):

Container name | Exposed port | Purpose
--- | --- | ---
beerplop-grunt | | (Re-)building client side components
beerplop-node | 8081 | Providing NodeJS server for socket connections (eg. lobby)
beerplop-apache | 8080 | Providing the apache webserver to handle HTTP requests
beerplop-php | | PHP-FPM to execute PHP scripts
beerplop-mysql | 8082 | Database for users, save states etc.
beerplop-redis | 8083 | Backend caching
**Containers used on start up:** | | 
beerplop-composer | | install dependencies

Beerplop is now available at http://localhost:8080

To develop simply modify files, the directory you cloned the project into is linked with the docker container. If you change scripts, styles or images the application will be rebuild in the `beerplop-grunt` container automatically. Simply refresh the page to see your changes.

Some technical stuff is documented in the [wiki](https://wol-soft.de/apps/beerplop/wiki) at *Technical stuff*

### Tests

To execute the tests in your browser visit http://localhost:8080/test after all containers are started. Alternatively you can execute `node tests\bootstrap.js` (either in a container or from your host system, then requires installed NodeJS). Currently the tests load a Beerplop page in the background and afterwards operate on the DOM.

### Recover

If something breaks completely, shutdown your containers, clear everything with `docker system prune -f && docker volume prune -f` and rebuild the application with `docker-compose up --build`.

## Contribute

Contributions are welcome! Help to discuss or fix open [issues](https://github.com/wol-soft/beerplop/issues) or develop your own ideas to bring more content into Beerplop or to improve the current gameplay.
Increase the code quality by refactoring code or adding more tests.

Please provide a short description of your changes in the changelog file at `src/Changelog.txt`.

If you plan to develop a large new feature or to change fundamental elements/mechanics please open an issue before to discuss the change.