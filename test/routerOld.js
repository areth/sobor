const Router = require('../src/router');
const ajvMatcher = require('../src/ajvMatcher');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const clone = require('clone');

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
  middlewares.push((context, msg, next) => {
    context.steps.push(i);
    msg.txt += ` -${i}`;
    next(msg);
  });
}

const msglessMiddleware = (context, msg, next) => {
  context.steps.push('no msg');
  msg.txt += ' -no msg';
  next();
};

const nextlessMiddleware = (context, msg, next) => {
  context.steps.push('no next');
  msg.txt += ' -no next';
};

const errMiddleware = (context, msg, next) => {
  context.steps.push('err');
  msg.txt += ' -err';
  next(msg, new Error('Error in middleware'));
};

describe.skip('router old', () => {
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

      return router.handle(context, message)
        .then(msg => console.log(msg, context.steps));
    });

    it('it should process message with 1 step, 20 middlewares', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares.slice(0, 20), middlewares[20]);

      return router.handle(context, message)
        .then(msg => console.log(msg, context.steps));
    });

    it('it should break chain in the no_next case', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], nextlessMiddleware, middlewares[2]]);
      router.use(middlewares[3]);

      return router.handle(context, message)
        .then(msg => console.log(msg, context.steps));
    });

    it('it should break chain in the no_message case', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], msglessMiddleware, middlewares[2]]);
      router.use(middlewares[3]);

      return router.handle(context, message)
        .then(msg => console.log(msg, context.steps));
    });

    it('it should break chain on error', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMiddleware, middlewares[2]]);
      router.use(middlewares[3]);

      return router.handle(context, message)
        .then(msg => console.log(msg, context.steps))
        .catch(err => console.log(message, context.steps, err.message));
    });
  });
});
