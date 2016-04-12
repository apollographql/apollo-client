var gulp = require('gulp'),
    sizereport = require('gulp-sizereport'),
    browserify = require('gulp-browserify'),
    UglifyJS = require('uglify-js');

gulp.task('default', function () {
  return gulp.src('./lib/src/index.js')
    .pipe(browserify({
      ignoreGlobals: true,
    }))
    .pipe(sizereport({
      gzip: true,
      total: false,
      minifier: function (contents) {
        return UglifyJS.minify(contents, { fromString: true }).code;
      },
      '*': {
        'maxSize': 100000,
        'maxGzippedSize': 2500,
        'maxMinifiedSize': 5500,
        'maxMinifiedGzippedSize': 2500
      },
    }))
    .pipe(gulp.dest('dist'));
});
