# webpack-entry-experiments

Experimenting with [webpack](https://webpack.js.org) [plugins](https://webpack.js.org/concepts/plugins/) and
[loaders](https://webpack.js.org/concepts/loaders/).



## The challenge
Webpack only supports anything that compiles to JS as entry-points.
Though for web applications the entry point is usually a HTML page referencing
other dependencies.

The [HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/)
can help, and it will generate a page and automatically inject CSS and JS files
for the generated chunks an entry-point depends on.

As soon as we want to share code across multiple pages and entry-points,
things get a bit more interesting.

You can pass an explicit list of chunks to the [HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/)
but it does not appear to be able to resolve chunks only used by a particular
entry-point.
When using code splitting you don't really want to manage an explicit lists of
chunks for each page, this should be handled automatically.


## Diving deeper

### HtmlWebpackPlugin with a custom template

The [HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/)
supports custom templates which is enough to find an entry-point's chunks and
inject them manually into the HTML.

[./webpack.config.js](./webpack.config.js):
```javascript
{
  entry: {
    page1: 'src/page1.js',
    page2: 'src/page2.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/page1.html.template.js',
      inject: false,
      entrypoint: 'page1',
      filename: 'page1.html'
    }),
    new HtmlWebpackPlugin({
      template: './src/page2.html.template.js',
      inject: false,
      entrypoint: 'page2',
      filename: 'page2.html'
    })
  ]
}
```

[./src/page1.js](./src/page1.js)
```javascript
import React from 'react';
import ReactDOM from 'react-dom';

import App from './app';
import './page1.css';

ReactDOM.render(<App />, document.getElementById('page1-app'));
```

The template can be any webpack loadable JS module
that exports a default render function which must return a string.
[HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/)
will pass enough data to that function for us to find all chunks for a given
entry-point.

[./src/page1.template.js](./src/page1.template.js)
```javascript
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import {StylesInjector, ScriptsInjector} from './wp/app-injector';


const Html = ({scripts, styles})=> (
  <html>
    <head>
      <title>JSX template</title>
      <StylesInjector files={styles} />
    </head>
    <body>
      <div id="page1-app" />
      <ScriptsInjector files={scripts} />
    </body>
  </html>
);


const render = ({htmlWebpackPlugin, webpack})=> {
  const {options, files} = htmlWebpackPlugin;
  const {entrypoints} = webpack;

  const {assets} = entrypoints[options.entrypoint];

  const jsFiles = files.js.filter((path)=> assets.includes(path));
  const cssFiles = files.css.filter((path)=> assets.includes(path));

  return ReactDOMServer.renderToStaticMarkup(
    <Html scripts={jsFiles} styles={cssFiles} />
  );
};

export default render;
```

One great think about using a custom template is that we can run any JS code.
As in the example above we can just use react to render our HTML and
we have full control over what, how and where chunks are injected.


### html-loader, entry-loader and entry-transform-plugin

The [html-loader](https://webpack.js.org/loaders/html-loader/) already
transforms HTML into JS with all referenced scripts and styles being turned
into imports.

We can chain it with our custom [entry-loader](./src/wp/entry-loader.js),
which can extract the HTML and dependencies, generate a new JS module with only
the dependencies and send the extracted HTML to our custom
[entry-transform-plugin](./src/wp/entry-transform-plugin.js).

When webpack has finished optimizing all chunks at the end of the compilation,
we can then take the extracted HTML and inject the entry module's
style and script chunk references.

[./webpack.config.js](./webpack.config.js):
```javascript
{
  entry: {
    page1: 'entry-loader?file=page1.html!html-loader?attrs=:src!src/page1.html',
    page2: 'entry-loader?file=page2.html!html-loader?attrs=:src!src/page2.html'
  },
  plugins: {
    new EntryTransformPlugin()
  }
}
```

[./src/page2.html](./src/page2.html):
```html
<html>
  <head>
    <title>HTML entry-point</title>
    <style type="text/css" src="./page2.css"></style>
  </head>
  <body>
    <div id="page2-app"></div>
    <script type="text/javascript" src="./page2.js"></script>
  </body>
</html>
```

[./src/page2.js](./src/page2.js):
```javascript
import React from 'react';
import ReactDOM from 'react-dom';

import App from './app';

ReactDOM.render(<App />, document.getElementById('page2-app'));
```

The nice thing about using the
[html-loader](https://webpack.js.org/loaders/html-loader/) is that it feels
rather natural to have the HTML file as an entry point and simply let everything
referenced load automatically.


### react-entry-loader and entry-transform-plugin

One nice thing about using a custom template with the [HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/)
is that we can generate our HTML code using the same tech as we use
for the rest of our react application. I.e. it is just a react component
that we can test and render exactly the way we want.

A downside is having to define the entry-point, a
[HtmlWebpackPlugin](https://webpack.js.org/plugins/html-webpack-plugin/)
instance for each entry-point, and passing the entry-point to the plugin for
filtering chunks.

We also need some boilerplate for the template function, though that
could be extracted into its own module to keep the template lean.

The last approach is a combination of the two options above.
We take the simplicity of the HTML file and combine it with the power of
a custom template.

We use another [custom loader](src/wp/react-entry-loader.js)
for our entry-point.

[./webpack.config.js](./webpack.config.js):
```javascript
{
  entry: {
    page1: 'react-entry-loader?file=page1.html!src/page1.js',
    page2: 'react-entry-loader?file=page2.html!src/page2.js'
    page2: 'react-entry-loader?file=page3.html!src/page3.js'
  },
  plugins: {
    new EntryTransformPlugin()
  }
}
```

The loader expects a JS module that has a react component as the default export.
This component is a mix of template and application code.

[./src/page3.js](./src/page3.js):
```javascript
import React from 'react';

import {AppInjector, StylesInjector, ScriptsInjector} from './wp/app-injector';

import App from './app';
import theme from './page3.css';


const Html = ({scripts, styles})=> (
  <html>
    <head>
      <title>JSX entry-point</title>
      <StylesInjector files={styles} />
    </head>
    <body>
      <AppInjector id="page3-app">
        <App style={theme} />
      </AppInjector>

      <ScriptsInjector files={scripts} />
    </body>
  </html>
);

export default Html;
```

The child component of the `AppInjector`,
and any code that that child depends on, is treated as the application code.
That application code will be transformed into the final entry module
that will render itself in place of the `AppInjector`.

The template is everything left over after the child component has been removed.

The loader will return the entry module code and send the extracted template to
our [custom plugin](./src/wp/entry-transform-plugin.js). It in turn will
generate HTML using that template code at the end of webpack's compilation run.



## Running the examples:

The code has been developed using node v10.
It is best to also use that version to make sure things run.

```bash
npm install
npm start
```
