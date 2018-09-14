/* eslint-env node */
/* eslint no-console: 0 */
/* eslint no-process-env: 0 */
const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');
const EntryTransformPlugin = require('./src/wp/entry-transform-plugin');


const nodeEnv = process.env.npm_config_node_env || 'webpack-dev';


const reactEntryLoader = ({output})=> (src)=> (
  `./src/wp/react-entry-loader.js?file=${output}!${src}`
);

const htmlEntryLoader = ({output})=> (src)=> (
  `./src/wp/entry-loader?file=${output}!html-loader?attrs=:src!${src}`
);


module.exports = ()=> {
  const isProduction = (nodeEnv === 'production');

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      page1: './src/page1.js',
      page2: htmlEntryLoader({output: 'page2.html'})('./src/page2.html'),
      page3: reactEntryLoader({output: 'page3.html'})('./src/page3.js')
    },

    output: {
      path: path.join(__dirname, 'build', 'pkg'),
      filename: '[name]-[contenthash].js'
    },

    optimization: {
      minimize: isProduction,
      // Imported modules are initialized for each runtime chunk separately,
      // so if you include multiple entry points on a page, beware of this
      // behavior. You will probably want to set it to single or use another
      // configuration that allows you to only have one runtime instance.
      runtimeChunk: {
        name: 'runtime'
      },
      splitChunks: {
        chunks: 'all'
      }
    },

    plugins: [
      // new BundleAnalyzerPlugin(),
      new webpack.DefinePlugin({
        // used by react to switch on/off dev warnings
        'process.env': {
          NODE_ENV: `"${nodeEnv}"`
        }
      }),
      new EntryTransformPlugin(),
      new HtmlWebpackPlugin({
        template: './src/page1.template.js',
        inject: false,
        entrypoint: 'page1',
        filename: 'page1.html'
      }),
      new MiniCssExtractPlugin({chunkFilename: '[name]-[contenthash].css'})
    ],

    module: {
      rules: [{
        test: /(\.css)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: !isProduction,
              minimize: isProduction,
              importLoaders: true,
              localIdentName: '[name]_[local]_[hash:base64:5]',
              camelCase: true
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: ()=> [
                require('postcss-nested')({ /* options */ }),
                require('autoprefixer')
              ],
              sourceMap: !isProduction
            }
          }
        ]
      },
      {
        test: /\.(png|jpg|ico|gif)$/,
        loader: 'url-loader?limit=1'
      }, {
        test: /\.jsx?$/,
        include: [
          path.resolve(__dirname, 'src')
        ],
        loader: 'babel-loader',
        options: {
          // making sure babel gets the right environment and thus
          // picks up the correct config.
          envName: nodeEnv
        }
      }]
    },
    devtool: isProduction
      ? '#nosources-source-map'
      : '#cheap-module-source-map',
    devServer: {
      clientLogLevel: 'error',
      // noInfo: true,
      stats: 'minimal',
      port: 8080,
      host: '0.0.0.0',
      inline: true,
      contentBase: './build',
      publicPath: `/test/`,
      historyApiFallback: {
        index: `/test/`
      }
    }
  };
};
