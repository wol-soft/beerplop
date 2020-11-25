module.exports = function(grunt) {
    const fileExistentFilter = function (filepath) {
        if (!grunt.file.exists(filepath)) {
            grunt.fail.warn('Could not find: ' + filepath);
        } else {
            return true;
        }
    };

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';\n'
            },
            beerplopInit: {
                src: [
                    'node_modules/jquery/dist/jquery.min.js',
                    'node_modules/@babel/polyfill/dist/polyfill.min.js',
                    'build/Init/__init.js',
                    'vendor/wol-soft/wol-soft-core/src/js/*.js',
                    'vendor/wol-soft/wol-soft-core/src/User/client/js/*.js',
                ],
                dest: 'htdocs/dist/js/beerplop-init-<%= pkg.beerplopversion %>.min.js',
                nonull: true,
                filter: fileExistentFilter,
            },
            beerplop: {
                src: [
                    'node_modules/jquery/dist/jquery.min.js',
                    'node_modules/jquery-ui-dist/jquery-ui.min.js',
                    'node_modules/mustache/mustache.min.js',
                    'node_modules/popper.js/dist/umd/popper.js',
                    'node_modules/bootstrap-material-design/dist/js/bootstrap-material-design.min.js',
                    'node_modules/bootstrap-slider/dist/bootstrap-slider.min.js',
                    'node_modules/decimal.js/decimal.min.js',
                    'node_modules/compare-versions/index.js',
                    'node_modules/snackbarjs/dist/snackbar.min.js',
                    'node_modules/composed-value-registry/src/ComposedValueRegistry.js',
                    'build/Game/__init.js',
                    'build/Game/**/**/*.js',
                    'build/Game/**/*.js',
                ],
                dest: 'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>.min.js',
                nonull: true,
                filter: fileExistentFilter,
            },
            beerplopDeferred: {
                src: [
                    'node_modules/dragscroll/dragscroll.js',
                    'node_modules/highcharts/highcharts.js',
                    'node_modules/highcharts/highcharts-more.js',
                    'node_modules/highcharts/modules/sankey.js',
                    'node_modules/chance/dist/chance.min.js',
                    // TODO: Edge doesn't support the indexedDB getAll method yet...
                    'node_modules/indexeddb-getall-shim/IndexedDB-getAll-shim.js'
                ],
                dest: 'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>-deferred.min.js',
                nonull: true,
                filter: fileExistentFilter,
            },
            beerplopLobby: {
                src: [
                    'node_modules/jquery/dist/jquery.min.js',
                    'node_modules/popper.js/dist/umd/popper.js',
                    'node_modules/bootstrap-material-design/dist/js/bootstrap-material-design.min.js',
                    'node_modules/@babel/polyfill/dist/polyfill.min.js',
                    'build/Lobby/__init.js',
                    'build/Lobby/*.js',
                    'vendor/wol-soft/wol-soft-core/src/js/*.js',
                    'vendor/wol-soft/wol-soft-core/src/User/client/js/*.js'
                ],
                dest: 'htdocs/dist/js/beerplop-lobby-<%= pkg.beerplopversion %>.min.js',
                nonull: true,
                filter: fileExistentFilter,
            },
            beerplopTest: {
                src: [
                    'htdocs/dist/js/beerplop-init-<%= pkg.beerplopversion %>.min.js',
                    'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>-deferred.min.js',
                    'node_modules/mocha/mocha.js',
                    'node_modules/chai/chai.js',
                    'node_modules/sinon/pkg/sinon.js',
                ],
                dest: 'htdocs/dist/js/beerplop-test-<%= pkg.beerplopversion %>.js',
                nonull: true,
                filter: fileExistentFilter,
            },
            beerplopTestCases: {
                src: [
                    'tests/client/**/*.js'
                ],
                dest: 'htdocs/dist/js/beerplop<%= pkg.beerplopversion %>-testcases.js',
                nonull: true,
                filter: fileExistentFilter,
            },
        },
        terser: {
            options: {
                mangle: false,
            },
            beerplop: {
                name: 'Beerplop',
                files: {
                    'htdocs/dist/js/beerplop-init-<%= pkg.beerplopversion %>.min.js': ['<%= concat.beerplopInit.dest %>'],
                    'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>.min.js': ['<%= concat.beerplop.dest %>'],
                    'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>-deferred.min.js': ['<%= concat.beerplopDeferred.dest %>'],
                }
            },
        },
        babel: {
            options: {
                sourceMap: true,
                presets: [
                    '@babel/preset-env'
                ],
                plugins: [
                    '@babel/plugin-proposal-numeric-separator',
                ]
            },
            dist: {
                files: [
                    {
                        expand: true,
                        cwd: 'src/client/js',
                        src: [
                            '**/**/**/*.js',
                            '**/**/*.js',
                            '**/*.js',
                        ],
                        dest: 'build/',
                    },
                ],
            },
        },
        sass: {
            beerplop: {
                files: [{
                    expand: true,
                    cwd:    'src/client/sass',
                    src:    ['*.scss', '**/*.scss'],
                    dest:   'htdocs/client/style',
                    ext:    '.css'
                },
                {
                    expand: true,
                    cwd:    'vendor/wol-soft/wol-soft-core/src/User/client/sass',
                    src:    ['*.scss'],
                    dest:   'htdocs/client/style/user',
                    ext:    '.css'
                }]
            },
        },
        concat_css: {
            beerplop: {
                src: [
                    'node_modules/bootstrap-material-design/dist/css/bootstrap-material-design.min.css',
                    'node_modules/bootstrap-additional-columns/dist/bootstrap-additional-columns.min.css',
                    'node_modules/bootstrap-slider/dist/css/bootstrap-slider.min.css',
                    'node_modules/@fortawesome/fontawesome-free/css/all.css',
                    'node_modules/snackbarjs/dist/snackbar.min.css',
                    'htdocs/client/style/**/*.css',
                    'htdocs/client/style/*.css',
                ],
                dest: 'htdocs/dist/css/beerplop<%= pkg.beerplopversion%>.css',
                nonull: true,
            },
            beerplopTest: {
                src: [
                    'htdocs/dist/css/beerplop<%= pkg.beerplopversion%>.css',
                    'node_modules/mocha/mocha.css'
                ],
                dest: 'htdocs/dist/css/beerplop<%= pkg.beerplopversion%>-test.css',
                nonull: true,
            },
        },
        cssmin: {
            beerplop: {
                expand: true,
                cwd: 'htdocs/dist/css',
                src: ['beerplop<%= pkg.beerplopversion %>.css'],
                dest: 'htdocs/dist/css',
                ext: '.min.css',
                extDot: 'last'
            },
        },
        svgstore: {
            options: {
                prefix : 'svg-',
                includeTitleElement: false
            },
            beerplop : {
                files: {
                    'src/View/Img/Achievements/achievements.twig': ['src/View/Img/Achievements/*.svg'],
                    'src/View/Img/AutomatedBar/automated-bar.twig': ['src/View/Img/AutomatedBar/*.svg'],
                    'src/View/Img/Buildings/buildings.twig': ['src/View/Img/Buildings/*.svg'],
                    'src/View/Img/BeerFactory/beer-factory.twig': ['src/View/Img/BeerFactory/*.svg'],
                    'src/View/Img/UniqueBuilds/unique-builds.twig': ['src/View/Img/UniqueBuilds/*.svg'],
                    'src/View/Img/HolyUpgrades/holyUpgrades.twig': ['src/View/Img/HolyUpgrades/*.svg'],
                    'src/View/Img/SlotItems/slot-items.twig': ['src/View/Img/SlotItems/*.svg'],
                    'src/View/Img/BeerBlender/beerBlender.twig': ['src/View/Img/BeerBlender/*.svg'],
                    'src/View/Img/base.twig': ['src/View/Img/*.svg'],
                }
            }
        },
        copy: {
            beerplop: {
                files: [
                    {
                        expand: true,
                        src: ['node_modules/@fortawesome/fontawesome-free/webfonts/*'],
                        dest: 'htdocs/dist/webfonts/',
                        flatten: true,
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        src: ['src/client/fonts/*'],
                        dest: 'htdocs/dist/fonts/',
                        flatten: true,
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        cwd: 'vendor/wol-soft/wol-soft-core/htdocs/user/dist',
                        src: ['**/*'],
                        dest: 'htdocs/user/dist/',
                        flatten: false,
                        filter: 'isFile'
                    },
                ]
            },
        },
        clean: {
            beerplop: [
                'build',
                'htdocs/dist',
                'htdocs/client/style'
            ],
        },
        watch: {
            sass: {
                files : [
                    'src/client/sass/*.scss',
                    'src/client/sass/**/*.scss'
                ],
                tasks : ['build-style'],
            },
            img: {
                files : [
                    'src/View/Img/*.svg',
                    'src/View/Img/**/*.svg'
                ],
                tasks : ['svgstore:beerplop'],
            },
            js: {
                files : [
                    'src/client/js/**/*.js',
                ],
                tasks : ['build-script'],
            },
            test: {
                files : [
                    'tests/client/**/*.js',
                ],
                tasks : ['build-test-script'],
            },
            all: {
                files : [
                    'package.json',
                    'Gruntfile.js',
                ],
                tasks : ['build'],
            },
        }
    });

    grunt.loadNpmTasks('grunt-terser');
    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-concat-css');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-svgstore');

    grunt.registerTask(
        'build-style',
        [
            'sass:beerplop',
            'concat_css:beerplop',
            'concat_css:beerplopTest',
            'cssmin:beerplop',
        ]
    );

    grunt.registerTask(
        'build-script',
        [
            'babel',
            'concat:beerplop',
            'concat:beerplopInit',
            'concat:beerplopDeferred',
            'concat:beerplopLobby',
        ]
    );

    grunt.registerTask(
        'build-test-script',
        [
            'concat:beerplopTest',
            'concat:beerplopTestCases',
        ]
    );

    grunt.registerTask(
        'build',
        [
            'clean:beerplop',
            'build-script',
            'build-test-script',
            'build-style',
            'svgstore:beerplop',
            'terser:beerplop',
            'copy:beerplop',
        ]
    );

    grunt.registerTask(
        'start',
        [
            'build',
            'watch',
        ]
    );
};
