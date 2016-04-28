var utils = require('./_utils'),
  fs = require('fs'),
  uglify = require('uglify-js'),
  srcMap = require('source-map');

module.exports = function(options) {

  options = utils.extend({
    // folder where the library output is located
    base: 'dist/'
  }, options)

  var sourcePath = `${options.base}${global.library}.js`,
    outputPath = `${options.base}${global.library}.min.js`,
    sourceOutputPath = `${options.base}${global.library}.min.js.map`,

    output = uglify.minify(sourcePath, {
      outSourceMap: sourceOutputPath,
      root: `${options.base}`
    });

  /**
   * Create a promise based on the result of the uglify output
   */
  return new Promise(function(resolve, reject) {
    // write the result of the uglify script in the output folder
    fs.writeFile(outputPath, output.code, function(err) {
      if (err) {
        utils.print(err, 'error')
        reject(err)
      } else {
        utils.print('Library minified', 'confirm')
        utils.print(`Created file: ${outputPath}`, 'cool')
        // resolve()
      }
    });
    fs.writeFile(sourceOutputPath, output.map, function(err){ {
      if (err) {

      } else {
        resolve();
      }
    }})
  })

}