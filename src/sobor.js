const { EventEmitter } = require('events');
const Router = require('./router');
const debug = require('debug')('sobor');
const ajvMatcher = require('./ajvMatcher');

const defaultOptions = {
  matcher: ajvMatcher,
};

class Sobor extends EventEmitter {
  constructor(networkManager, options) {
    super();
    this.networkManager = networkManager;
    this.options = Object.assign({}, defaultOptions, options);
    this.routerIn = new Router(this.options.matcher);
    this.routerIn.end(this.endIn);
    this.routerOut = new Router(this.options.matcher);
    this.routerOut.end(this.endOut);
  }

  in(fn) {
    this.routerIn.use(fn);
  }

  out(fn) {
    this.routerOut.use(fn);
  }

  // handleIn(context, msg) {
  //   const nmDone = (nextMsg, err) => this.handle(this.inStack, context, nextMsg, err);
  //   this.networkManager.in(context, msg, nmDone);
  // }

  // handleOut(context, msg) {
  //   const nmDone = nextMsg => this.sendDirect(context.peer, nextMsg);
  //   const done = (nextMsg, err) => {
  //     if(err) {
  //       debug('out error %s', err);
  //     } else {
  //       this.networkManager.out(context, nextMsg, nmDone)
  //     }
  //   };
  //   this.handle(this.outStack, context, msg, undefined, done);
  // }

  handleIn(context, message) {
    this.networkManager.in(context, message)
      .then(Router.doIfMessage(msg => this.routerIn.handle(context, msg)))
      .catch(err => debug('in router error %s', err));
  }

  endIn(context, message, error) {
    const promise = error ? Promise.reject(error) : Promise.resolve(message);
    promise
      .catch(err => debug('in router error %s', err));
  }

  handleOut(context, message) {
    this.routerOut.handle(context, message);
      // .then(Router.doIfMessage(msg => this.networkManager.out(context, msg)))
      // .then(Router.doIfMessage(msg => this.sendDirect(context.peer, msg)))
      // .catch(err => debug('out stack error %s', err));
  }

  endOut(context, message, error) {
    const promise = error ? Promise.reject(error) : Promise.resolve(message);
    promise
      .then(Router.doIfMessage(msg => this.networkManager.out(context, msg)))
      .then(Router.doIfMessage(msg => this.sendDirect(context.peer, msg)))
      .catch(err => debug('out router error %s', err));
  }

  listen(protocol) {

  }

  send(peer, msg) {
    this.handleOut(this.makeContext(peer, msg), msg);
  }

  sendDirect(peer, msg) {

  }

  makeContext(peer, msg) {
    const context = { peer };
    this.networkManager.prepareContext(context, peer, msg);
    return context;
  }
}

module.exports = Sobor;
