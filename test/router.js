const Router = require('../src/router');
const ajvMatcher = require('../src/ajvMatcher');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const clone = require('clone');
const simpleMiddleware = require('../src/simpleMiddleware');
const simpleErrMiddleware = require('../src/simpleErrMiddleware');
const debug = require('debug')('sobor:test:router');

chai.use(sinonChai);
chai.should();

let router;
const initMessage = {
  txt: 'very important text',
  date: Date.now(),
};
const initContext = { steps: [] };
const middlewares = [];
for (let i = 0; i < 100; i += 1) {
  // intentionally don't use simpleMiddleware for example
  middlewares.push((handle, next) => {
    handle((context, msg) => {
      context.steps.push(i);
      msg.txt += ` -${i}`;
      next(context, msg);
    });
  });
}

const msglessMiddleware = simpleMiddleware((context, msg, next) => {
  context.steps.push('no msg');
  msg.txt += ' -no msg';
  next();
});

const nextlessMiddleware = simpleMiddleware((context, msg, next) => {
  context.steps.push('no next');
  msg.txt += ' -no next';
});

const errMakeMiddleware = simpleMiddleware((context, msg, next) => {
  context.steps.push('err');
  msg.txt += ' -err';
  next(context, msg, new Error('Error in middleware'));
});

const errThrowMiddleware = simpleMiddleware((context, msg, next) => {
  context.steps.push('err');
  msg.txt += ' -err';
  throw new Error('Error in middleware');
});

const errMiddlewares = [];
for (let i = 0; i < 10; i += 1) {
  errMiddlewares.push(simpleErrMiddleware((context, msg, err, next) => {
    context.steps.push(`err catched ${i}`);
    msg.txt += ` -err catched ${i}`;
    next(context, msg, err);
  }));
}

const nextlessErrMiddleware = simpleErrMiddleware((context, msg, err, next) => {
  context.steps.push('err catched no next');
  msg.txt += ' -err catched no next';
});

const msglessErrMiddleware = simpleErrMiddleware((context, msg, err, next) => {
  context.steps.push('err catched no msg');
  msg.txt += ' -err catched no msg';
  next(undefined, undefined, err);
});

const dimErrMiddleware = simpleErrMiddleware((context, msg, err, next) => {
  context.steps.push('err dimmed');
  msg.txt += ' -err dimmed';
  next(context, msg);
});

const routeEnd = (context, msg, err) => {
  debug('%o %o %s', msg, context, err);
};

describe('router', () => {
  describe('do_if_message helper', () => {
    it('it should do if message provided', () => Promise.resolve('some message')
      .then(Router.doIfMessage(msg => console.log(msg))));

    it('it shouldn`t do if message not provided', () => Promise.resolve()
      .then(Router.doIfMessage(msg => console.log('msg'))));
  });

  describe('ajv matcher', () => {
    it('should match', () => {
      const schema = ajvMatcher.makeSchema({});
      ajvMatcher.match(schema, initMessage).should.to.be.true;
    });

    it('shouldn`t match', () => {
      const schema = ajvMatcher.makeSchema({
        type: 'object',
        required: ['dummy'],
      });
      ajvMatcher.match(schema, initMessage).should.to.be.false;
    });
  });

  describe('patternless route', () => {
    beforeEach(() => {
      message = clone(initMessage);
      context = clone(initContext);
    });

    it('it should process message with 2 steps', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use(middlewares[1]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should process message with 1 step, 20 middlewares', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares.slice(0, 20), middlewares[20]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should break the chain in the no_next case', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], nextlessMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should break the chain in the no_message case', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], msglessMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should break the chain on error', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.end(routeEnd);

      router.handle(context, message);
    });
  });

  describe.only('errors middlewares', () => {
    beforeEach(() => {
      message = clone(initMessage);
      context = clone(initContext);
    });

    it('it should catch passed error once', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should catch thrown error once', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errThrowMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should catch error 10 times', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares.slice(0, 5));
      router.use(middlewares.slice(4, 9)); // trying to break errors handlers chain
      router.use(errMiddlewares.slice(5));
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should catch error without next', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.use(nextlessErrMiddleware);
      router.use(errMiddlewares[1]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should catch error without msg', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.use(msglessErrMiddleware);
      router.use(errMiddlewares[1]);
      router.end(routeEnd);

      router.handle(context, message);
    });

    it('it should dim out the error', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.use(dimErrMiddleware);
      router.use(errMiddlewares[1]);
      router.use(middlewares[4]);
      router.use(middlewares[5]);
      router.use(errMiddlewares[2]);
      router.end(routeEnd);

      router.handle(context, message);
    });
  });
});
