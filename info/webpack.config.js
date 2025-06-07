//A bundler which take autofill.js file and its axios dependency and create a single bundled js file.

//import path from 'path'
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Dotenv=require('dotenv-webpack');

//export default

module.exports ={
    entry: {
      background: './extension/background.js', //tells the webpack that it is an entry point
      autofill: './extension/scripts/autofill.js',
    },
    output: {
        filename: '[name].bundle.js', //Dynamic name assigning based on filename  // this tells to create a new file named ... and in directory dist. known as output of webpack and contains code from js file and axios.
        path: path.resolve(__dirname, 'dist'),
        module: true,//Enables ES module output.
        libraryTarget: 'module', //specifying the output format of ES module.
       
    },
  mode:'development', //productionfor debugging otherwise production mode
  devtool: 'cheap-module-source-map', //instead of eval use source-map or another safer option.
  plugins: [new webpack.DefinePlugin({
    'process.env.REACT_APP_BACKEND_URL': JSON.stringify(process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process':'undefined', //or '{}' if some libraries expect it to exists.
  }),new CopyWebpackPlugin({
    patterns: [{from: 'extension/manifest.json',to: ''},{from: 'extension/images', to:'images'},{from: 'extension/popup', to:'popup'}, {from:'extension/scripts', to: 'scripts'},],
  }),new Dotenv({path: './.env',safe:true,systemvars: true}),], //true is to verify variables, systemvars, allowin process.env to overwrite 
  module:{
    rules:[
      {
        test: /\.js$/, //Reges for only .js files
        exclude: /node_modules/, //Exclude node modules
        use: {
          loader: 'babel-loader', //Transpile means converting the code from source code from one high level language to another language instead of Machine language.
          options: {
            presets: ['@babel/preset-env'], // Target modern js syntax.
          }
        }, //Transpile ES6+ code

      },
    ],
  },
  experiments: {
    outputModule: true, //requred for midule output.
  }
};
//Optimization to ensure only necessary code is bundled for each entry

//Expose the exported function as a global variable
//library: 'autofillInit',
//libraryTarget: 'window',
//libraryExport: 'autofillInit', // Expose only autofillInit