'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    tslint: {
      options: {
        // can be a configuration object or a filepath to tslint.json
        configuration: grunt.file.readJSON('tslint.json'),
      },
      files: {
        src: ['src/**/*.ts', 'test/**/*.ts', '!test/fixtures/**/*.ts'],
      },
    },
  });

  grunt.loadNpmTasks('grunt-tslint');
};
