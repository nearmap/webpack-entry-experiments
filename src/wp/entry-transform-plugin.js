/* eslint-env node */
const vm = require('vm');
const {transform} = require('@babel/core');


/**
 * Run `source` as if it were a file named `filename` inside the
 * `context` director and return the result.
 */
const exec = (filename, source, context)=> {
  const vmContext = vm.createContext({
    exports: {},
    require(req) {
      const path = require.resolve(req, {paths: [context]});
      return require(path);
    }
  });

  const {code} = transform(source, {envName: 'development'});

  // add `@babel/register` to allow importing of es-next modules
  source = `
    require("@babel/register");
    ${code}
  `;

  const vmScript = new vm.Script(source, {filename});
  return vmScript.runInContext(vmContext);
};


/**
 * Exectue the template `code` and render the exported
 * react component with the given `props`.
 */
const execTemplate = async ({code, context}, props)=> {
  const React = require('react');
  const ReactDomServer = require('react-dom/server');

  const Html = exec(`${context}/foo.js`, code, context);

  const html = ReactDomServer.renderToStaticMarkup(
    React.createElement(Html, props)
  );
  return html;
};


/**
 * Yield all entry modules from the `compilation`.
 */
function* entryModules(compilation) {
  for (const [, entry] of compilation.entrypoints.entries()) {
    for (const {entryModule} of entry.chunks) {
      if (entryModule) {
        yield [entry, entryModule];
      }
    }
  }
}


/**
 * Yield all `[entry, template]` items for every entry module
 * for which a loader has sent this plugin a template.
 */
function* findEntries(compilation) {
  for (const [entry, entryModule] of entryModules(compilation)) {
    for (const {module} of entryModule.dependencies) {
      if (module && module.foooooooooo) {
        yield [entry, module.foooooooooo];
      } else if (module && module.rootModule && module.rootModule.foooooooooo) {
        yield [entry, module.rootModule.foooooooooo];
      }
    }
  }
}


/**
 * Return a `{scripts, styles}` object containing
 * all chunks for a given `entry` separated
 * into js scripts and css style sheets.
 */
const getFiles = (entry)=> {
  const files = [];
  for (const chunk of entry.chunks) {
    files.push(...chunk.files);
  }
  const scripts = files.filter((fle)=> fle.endsWith('.js'));
  const styles = files.filter((fle)=> fle.endsWith('.css'));

  return {scripts, styles};
};


/**
 * Inject `jsFiles` and `cssFiles` into a entry-loader generated `template`.
 */
const injectScripts = (template, jsFiles, cssFiles)=> (
  template.replace(
    /<script.+?src=.+?(@.+?@).+?><\/script>/g,
    ()=> jsFiles.map(
      (fle)=> `<script src='${fle}'></script>`
    ).join('\n')
  ).replace(
    /<style.+?src=.+?(@.+?@).+?>/g,
    ()=> cssFiles.map(
      (fle)=> `<link href="${fle}" rel="stylesheet">`
    ).join('\n')
  )
);


/**
 * Return a tapable hook that will add HTML assets to the `compilation`
 * for every entry module that has a templated generated by compatible loaders.
 */
const addHtmlAssets = (compilation)=> async ()=> {
  for (const [entry, {name, template, ...props}] of findEntries(compilation)) {
    const {scripts, styles} = getFiles(entry);

    const source = template.context
      ? await execTemplate(template, {scripts, styles, ...props})
      : injectScripts(template, scripts, styles);

    compilation.assets[name] = {
      source: ()=> source,
      size: ()=> source.length
    };
  }
};


/**
 * Register a callback on the `module` loader `context`.
 *
 * The callback allows any compatible loader to report a template back
 * to this plugin.
 */
const registerModuleLoaderCallback = (context, module)=> {
  context.foo = (data)=> {
    module.foooooooooo = data;
  };
};


/**
 * Return a tapable hook  for the plugin named `name` that registers
 * hokes for a `compilation`.
 */
const thisCompilation = (name)=> (compilation)=> {
  const {hooks} = compilation;

  hooks.additionalAssets.tapPromise(name, addHtmlAssets(compilation));
  hooks.normalModuleLoader.tap(name, registerModuleLoaderCallback);
};


/**
 * A webpack plugin for generating HTML assets from templates sent by
 * compatible webpack loaders.
 */
class EntryTransformPlugin {
  apply(compiler) {
    const name = this.constructor.name;
    compiler.hooks.thisCompilation.tap(name, thisCompilation(name));
  }
}

module.exports = EntryTransformPlugin;
