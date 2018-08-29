/* eslint-env node */
const {getOptions} = require('loader-utils');
const {transform, parse} = require('@babel/core');
const traverse = require('@babel/traverse').default;


/**
 * Return the generated javascript code for the `ast`.
 */
const genJS = (ast)=> transform(ast, {configFile: false}).code;


/**
 * Return a function `f(item)` that return `true` if `item` is
 * the same as the `expected`.
 *
 * e.g.
 * ```
 * path.findParent(isSameAs(maybeParent));
 * ```
 */
const isSameAs = (expected)=> (item)=> item === expected;


/**
 * Return a function `f(item)` that returns `true` if `item`
 * has a `parentPath` as a parent.
 *
 * e.g.
 * ```
 * [path1, path2].filter(hasParent(somePath));
 * ```
 */
const hasParent = (parentPath)=> (path)=> path.findParent(isSameAs(parentPath));


/**
 * Return `true` if `path` has been removed.
 *
 * e.g.
 * ```
 * [path1, path2].filter(isRemoved);
 * ```
 */
const isRemoved = (path)=> path.removed;


/**
 * Return the first removed parent of `path`.
 *
 * e.g.
 * ```
 * const removedPath = hasRemovedParent(path);
 * ```
 */
const hasRemovedParent = (path)=> path.findParent(isRemoved);


/**
 * Return a function `f(path) that returns `true` if `path`
 * looks like a react component with the given `name`.
 *
 * e.g.
 * ```
 * [path1, path2].filter(isReactComponent('AppInjector'));
 * ```
 */
const isReactComponent = (name)=> (path)=> (
  path.isCallExpression() && path.node.arguments[0].name === name
);


/**
 * Yield all import declarations from `imports`
 * if they are referenced by `appPath`.
 */
function* referencedImports(imports, appPath) {
  for (const [impPath, refPaths] of imports) {
    if (refPaths.some(hasParent(appPath))) {
      yield impPath;
    }
  }
}

/**
 * Yield all import declarations from `imports`
 * that are no longer referenced.
 */
function* unusedImports(imports) {
  for (const [impPath, refPaths] of imports) {
    if (refPaths.every(hasRemovedParent)) {
      yield impPath;
    }
  }
}


/**
 * Return the application component path and the imports it depends on
 * as `{appPath, imports}` given the file's `ast`.
 */
const getAppImports = (ast)=> {
  const imports = [];
  let appPath = null;

  traverse(ast, {
    CallExpression(path) {
      if (isReactComponent('AppInjector')(path.parentPath)) {
        appPath = path;
      }
    },

    ImportDeclaration(path) {
      const names = path.node.specifiers.map((node)=> node.local.name);
      const {bindings} = path.scope;

      for (const name of names) {
        imports.push([path, bindings[name].referencePaths]);
      }
    }
  });

  return {appPath, imports};
};

/**
 * Return the container id from the
 * `<AppInjector id="foobar"><App /></AppInjector>`
 * given the `<App />`'s `appPath`.
 */
const getContainerId = (appPath)=> {
  const [, props] = appPath.parent.arguments;
  return props.properties[0].value.value;
};


/**
 * Return the javascript code that will import all `imports`
 * and render the component `<App />` given as `appPath` into
 * a DOM element given identified by `id`.
 */
const getModuleCode = (imports, appPath, id)=> [
  ...[...referencedImports(imports, appPath)].map(genJS),
  `import ReactDom from 'react-dom';`,
  `const app = ${genJS(appPath)}`,
  `ReactDom.render(app, document.getElementById(${JSON.stringify(id)}));`
].join('\n');


/**
 * Return the javascript code for the `ast` after the `appPath`
 * and all of its non-shared `imports` have been removed.
 */
const getTemplateCode = (ast, imports, appPath)=> {
  appPath.remove();
  for (const impPath of unusedImports(imports)) {
    impPath.remove();
  }
  return genJS(appPath.findParent((path)=> path.isProgram()));
};


/**
 * Return a `{module, template}` object by splitting the `source` code
 * into a JSX template and application module.
 */
const splitModuleAndTemplate = (source)=> {
  const ast = parse(source);

  const {appPath, imports} = getAppImports(ast);
  const containerId = getContainerId(appPath);
  const module = getModuleCode(imports, appPath, containerId);
  const template = getTemplateCode(ast, imports, appPath);

  return {module, template};
};


/**
 * Implement the webpack loader interface for handling entrypoint modules.
 *
 * This loader handles any JS `source` that exports a react component as
 * as default.
 * It splits the code into two part: the module and the template code.
 * Only the module code will be returned, while the template code is
 * sent to the `entry-transform-plugin`.
 *
 * Code splitting is done by searching for a child of the `<AppInjector />`
 * component in the `source`. That child and all of it's dependencies are
 * assumed to be module code. The rest is template code.
 *
 * The module code will add a wrapper around the extracted child for it to
 * be rendered in place of the `<AppInjector />` at runtime.
 */
module.exports = function(source, map, meta) {
  const callback = this.async();

  const options = getOptions(this);
  const {context} = this;

  const {module, template} = splitModuleAndTemplate(source);

  this.foo({name: options.file, template: {context, code: template}});
  callback(null, module, map, meta);
};
