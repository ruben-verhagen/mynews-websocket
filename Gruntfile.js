module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        shell: {
            options: {
                stout: true
            },
            npm_install: {
                command: 'npm install'
            }
        },

        clean : {
            common : {
                src : [
                    "node_modules/sites-node-common"
                ]
            }
        },

        mochaTest: {
            test: {
                options: {
                    reporter: 'nyan',
                    mocha: require('mocha')
                },
                src: ['test/*.js']
            }
        }
    });

    grunt.registerTask('default', ['mochaTest:test']);
    grunt.registerTask('test', ['mochaTest:test']);
    grunt.registerTask('install', ['shell:npm_install', 'clean:common', 'shell:npm_install']);

}
