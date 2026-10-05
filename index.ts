export { PHPEngine } from "./src/PHPEngine.js";
export type { PHPEngineOptions } from "./src/PHPEngine.js";
export { PHPContext } from "./src/PHPContext.js";
export type { PHPContextOptions } from "./src/PHPContext.js";
export { PHPExtension } from "./src/PHPExtension.js";
export {
  PHPError,
  PHPException,
  PHPTypeError,
  PHPParseError,
  PHPFatalError,
  PHPNotice,
  PHPWarning,
  PHPExit,
  ErrorException,
} from "./src/runtime/PHPError.js";
export { PHPInterface } from "./src/runtime/PHPInterface.js";
export {
  defineFunction,
  SYMBOL_PHP_META,
  SYMBOL_PHP_NAME,
  SYMBOL_PHP_CONSTANTS,
  SYMBOL_PHP_PROPERTIES,
  SYMBOL_PHP_METHODS,
  SYMBOL_PHP_CLASS,
  SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS,
  SYMBOL_PHP_CLASS_INTERFACES,
  Reflection,
  ReflectionClass,
  ReflectionMethod,
  ReflectionProperty,
  ReflectionFunction,
  ReflectionParameter,
  ReflectionType,
} from "./src/runtime/Reflection.js";
export type { PHPMethodMetadata, PHPPropertyMetadata, PHPParameterMetadata, FunctionMetaOptions } from "./src/runtime/Reflection.js";
export { Superglobals } from "./src/runtime/Superglobals.js";
export { OutputBufferStack } from "./src/runtime/OutputBuffer.js";
export { PHPParser } from "./src/parser/PHPParser.js";
export { ASTOptimizer } from "./src/parser/ASTOptimizer.js";
export { JSTranspiler } from "./src/parser/JSTranspiler.js";
export { runHTTPServer, runHTTPServerCLI } from "./src/cli/php-http-server.js";
export { runFPM } from "./src/cli/php-fpm.js";
export {
  NodeJSExtension,
} from "./src/extensions/nodejs.js";
