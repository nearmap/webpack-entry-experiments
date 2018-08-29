/* eslint-env node */
const {getOptions} = require('loader-utils');
const vm = require('vm');


/**
 * Return the dependencies and exports of the `code` passed.
 *
 * The code is executed in node and all the dependencies are
 * captrued and replaced with placeholder strings.
 *
 * e.g.
 * ```
 * import foo from './foobar.js';
 * export default `<html><head><script src=${foo}></head></html>'
 * ```
 * returns
 * ```
 * {
 *   exports: '<html><head><script src="@./foobar.js@"></head></html>',
 *   dependencies: ['./foobar.js']
 * }
 * ```
 */
const getDepsAndTemplate = (code, filename)=> {
  const dependencies = [];
  const sandbox = {
    require: (resourcePath)=> {
      dependencies.push(resourcePath);
      return `@${resourcePath}@`;
    },
    module: {},
    exports: {}
  };

  const script = new vm.Script(code, {
    filename,
    displayErrors: true
  });
  sandbox.module.exports = sandbox.exports;
  script.runInNewContext(sandbox);

  const {exports} = sandbox.module;
  return {dependencies, exports};
};


/**
 * Implement the webpack loader interface for handling entrypoint modules
 * pre-processed by `html-loader``
 *
 * This loader splits the code into two part: the module and the template code.
 * Code splitting is done by running the `source`, capturing all imports,
 * and extracting the exported template.
 * The imports are turned into JS module code and the template code is
 * sent to the `entry-transform-plugin`.
 */
module.exports = function(source, map, meta) {
  const callback = this.async();

  const options = getOptions(this);

  const {dependencies, exports} = getDepsAndTemplate(source, this.resourcePath);

  const content = [
    ...dependencies.map((dep)=> `import ${JSON.stringify(dep)};`)
  ].join('\n');


  const template = (exports.default || exports).toString();

  this.foo({name: options.file, template});

  callback(null, content, map, meta);
};
