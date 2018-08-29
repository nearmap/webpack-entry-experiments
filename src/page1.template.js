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
