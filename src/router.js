const Layer = require('./layer');
const flatten = require('array-flatten');
const debug = require('debug')('sobor:router');

const { slice } = Array.prototype;
const { toString } = Object.prototype;

const objectRegExp = /^\[object (\S+)\]$/;
// get type for error message
const gettype = (obj) => {
  const type = typeof obj;

  if (type !== 'object') {
    return type;
  }

  // inspect [[Class]] for objects
  return toString.call(obj)
    .replace(objectRegExp, '$1');
};

class Router {
  constructor(matcher) {
    this.matcher = matcher;
    this.stack = [];
  }

  // helper func for promise steps
  static doIfMessage(fn) {
    return msg => (msg ? fn(msg) : msg);
  }

  end(fn) {
    this.endHandler = fn;
  }

  doEnd(context, msg, error) {
    if (this.endHandler) {
      this.endHandler(context, msg, error);
    }
  }

  doEndAsync(context, msg, error) {
    setImmediate(this.doEnd.bind(this), context, msg, error);
  }

  use(...args) {
    let offset = 0;
    let pattern = {};

    // default pattern to {}
    // disambiguate router.use([fn])
    const [fn] = args;
    if (typeof fn !== 'function') {
      let arg = fn;

      while (Array.isArray(arg) && arg.length !== 0) {
        [arg] = arg;
      }

      // first arg is the pattern
      if (typeof arg !== 'function') {
        offset = 1;
        pattern = fn;
      }
    }

    const middlewares = flatten(slice.call(args, offset));
    if (middlewares.length === 0) {
      throw new TypeError('Router.use() requires a middleware function');
    }

    for (let i = 0; i < middlewares.length; i += 1) {
      const mw = middlewares[i];

      if (typeof mw !== 'function') {
        throw new TypeError(`Router.use() requires a middleware function but got a ${gettype(mw)}`);
      }

      const step = this.stack.length;

      // add the middleware
      debug('use %o %s', pattern, mw.name || '<anonymous>');
      mw((handler) => {
        const layer = new Layer(step, this.matcher.makeSchema(pattern), handler);
        this.stack.push(layer);
      }, (context, msg, err) => {
        this.next(step + 1, context, msg, err);
      });
    }
  }

  next(nextStep, context, msg, incomeError) {
    let err = incomeError;

    // signal to exit router
    if (err === 'end') {
      this.doEndAsync(context, msg, null);
      return;
    }

    // message doesn't provided
    if (!msg) {
      this.doEndAsync(context, msg, err);
      return;
    }

    // no more matching layers
    if (nextStep >= this.stack.length) {
      this.doEndAsync(context, msg, err);
      return;
    }

    // find next matching layer
    let layer;
    let match;
    let idx = nextStep;
    while (match !== true && idx < this.stack.length) {
      layer = this.stack[idx];
      match = this.matchLayer(layer, msg);

      if (typeof match !== 'boolean') {
        // hold on to err
        err = err || match;
      }

      idx += 1;
    }

    // no match
    if (match !== true) {
      this.doEnd(context, msg, err);
      return;
    }

    // / we have a matched layer
    if (err && layer.handle.length !== 3) {
      // not a standard error handler
      this.next(layer.step + 1, context, msg, err);
      return;
    }
    if (!err && layer.handle.length > 2) {
      // not a standard request handler
      this.next(layer.step + 1, context, msg);
      return;
    }

    try {
      layer.handle(context, msg, err);
    } catch (nextErr) {
      this.next(layer.step + 1, context, msg, nextErr);
    }
  }

  handle(context, message) {
    debug('dispatching %o', message);
    this.next(0, context, message);
  }

  matchLayer(layer, obj) {
    try {
      return this.matcher.match(layer.schema, obj);
    } catch (err) {
      return err;
    }
  }
}

module.exports = Router;
