import path from "path";
import { fileURLToPath } from "url";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: "production",
  entry: "./web/index.js",
  output: {
    path: path.resolve(__dirname, "web"),
    filename: "bundle.js",
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "babel-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      fs: false,
      net: false,
      tls: false
    }
  },
  plugins: [new NodePolyfillPlugin()],
  target: "web"
};
