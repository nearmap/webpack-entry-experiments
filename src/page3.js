import React from 'react';

import {AppInjector, StylesInjector, ScriptsInjector} from './wp/app-injector';

import App from './app';
import theme from './page3.css';


const Html = ({scripts, styles})=> (
  <html>
    <head>
      <title>JSX entrypoint</title>
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
