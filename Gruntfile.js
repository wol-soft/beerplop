module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';\n'
            },
            beerplopInit: {
                src: [
                    'node_modules/jquery/dist/jquery.min.js',
                    'src/client/js/Init/__init.js',
                    'vendor/wol-soft/wol-soft-core/src/js/*.js',
                    'vendor/wol-soft/wol-soft-core/src/User/client/js/*.js',
                ],
                dest: 'htdocs/dist/js/beerplop-init-<%= pkg.beerplopversion %>.min.js'
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
                    'src/client/js/Game/__init.js',
                    'src/client/js/Game/**/**/*.js',
                    'src/client/js/Game/**/*.js',
                ],
                dest: 'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>.min.js'
            },
            beerplopDeferred: {
                src: [
                    'node_modules/dragscroll/dragscroll.js',
                    'node_modules/highcharts/highcharts.js',
                    'node_modules/highcharts/highcharts-more.js',
                    'node_modules/highcharts/modules/sankey.js',
                    'node_modules/chance/dist/chance.min.js',
                ],
                dest: 'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>-deferred.min.js'
            },
            beerplopLobby: {
                src: [
                    'node_modules/jquery/dist/jquery.min.js',
                    'node_modules/popper.js/dist/umd/popper.js',
                    'node_modules/bootstrap-material-design/dist/js/bootstrap-material-design.min.js',
                    'src/client/js/Lobby/__init.js',
                    'src/client/js/Lobby/*.js',
                    'vendor/wol-soft/wol-soft-core/src/js/*.js',
                    'vendor/wol-soft/wol-soft-core/src/User/client/js/*.js'
                ],
                dest: 'htdocs/dist/js/beerplop-lobby-<%= pkg.beerplopversion %>.min.js'
            },
            beerplopTest: {
                src: [
                    'htdocs/dist/js/beerplop-init-<%= pkg.beerplopversion %>.min.js',
                    'htdocs/dist/js/beerplop-game-<%= pkg.beerplopversion %>-deferred.min.js',
                    'node_modules/mocha/mocha.js',
                    'node_modules/chai/chai.js',
                    'node_modules/sinon/pkg/sinon.js',
                ],
                dest: 'htdocs/dist/js/beerplop-test-<%= pkg.beerplopversion %>.min.js'
            },
            beerplopTestCases: {
                src: [
                    'tests/client/**/*.js'
                ],
                dest: 'htdocs/dist/js/beerplop<%= pkg.beerplopversion %>-testcases.min.js'
            },
        },
        uglify: {
            options: {
                banner:
                    '<% var subtask = uglify[grunt.task.current.target]; %>' +
                    '/*! <%= pkg.name %> <%= subtask.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
                mangle: false
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
                    'htdocs/apps/user/client/style/login.css',
                    'src/style/messages.css'
                ],
                dest: 'htdocs/dist/css/beerplop<%= pkg.beerplopversion%>.css'
            },
            beerplopTest: {
                src: [
                    'htdocs/dist/css/beerplop<%= pkg.beerplopversion%>.css',
                    'node_modules/mocha/mocha.css'
                ],
                dest: 'htdocs/dist/css/beerplop<%= pkg.beerplopversion%>-test.css'
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

    grunt.loadNpmTasks('grunt-contrib-uglify-es');
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
            'uglify:beerplop',
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
