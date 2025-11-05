const path = require('path');

module.exports = {
  entry: {
    main: './public/javascripts/index.js',
    chatbot: './public/javascripts/chatbot-index.js'
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name]-bundle.js',
    publicPath: '/dist/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: 'development',
  devtool: 'source-map'
};
