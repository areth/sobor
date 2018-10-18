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
  txt: 'generic text',
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
};

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

const patternGood = {
  type: 'object',
  properties: {
    txt: { type: 'string' },
    date: { type: 'integer' },
  },
  required: ['txt', 'date'],
};

const patternBad = {
  type: 'object',
  required: ['dummy'],
};

const initMessageAlt = {
  txt: 'alt text',
  alt: true,
};

const patternAlt = {
  type: 'object',
  properties: {
    alt: { type: 'boolean' },
  },
  required: ['alt'],
};

const routeEnd = (context, msg, err) => {
  debug('%o %o %s', msg, context, err);
};

const checkMsgTxt = (txt) => {
  return (context, msg, err) => {
    debug('%o %o %s', msg, context, err);
    msg.txt.should.be.equal(`${initMessage.txt}${txt}`);
  };
};

const checkMsgTxtSep = (txt, txtAlt) => {
  return (context, msg, err) => {
    debug('%o %o %s', msg, context, err);
    if(msg.alt){
      msg.txt.should.be.equal(`${initMessageAlt.txt}${txtAlt}`);
    } else {
      msg.txt.should.be.equal(`${initMessage.txt}${txt}`);  
    }
  };
};

const checkMsgUndefined = (txt) => {
  return (context, msg, err) => {
    debug('%o %o %s', msg, context, err);
    chai.should().equal(msg, undefined);
  };
};

const checkMsgUndefinedErr = (txt) => {
  return (context, msg, err) => {
    debug('%o %o %s', msg, context, err);
    chai.should().equal(msg, undefined);
    chai.should().not.equal(err, undefined);
  };
};

describe('router', () => {
  describe('do_if_message helper', () => {
    const someMsg = 'some message';
    const messageArrived = 'message arrived: ';

    it('it should do if message provided', () => Promise.resolve(someMsg)
      .then(Router.doIfMessage(msg => messageArrived + msg))
      .then(msg => msg.should.be.equal(messageArrived + someMsg)));

    it('it shouldn`t do if message not provided', () => Promise.resolve()
      .then(Router.doIfMessage(msg => messageArrived + msg))
      .then(msg => chai.should().equal(msg, undefined)));
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
      router.end(checkMsgTxt(' -0 -1'));

      router.handle(context, message);
    });

    it('it should process message with 1 step, 20 middlewares', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares.slice(0, 20), middlewares[20]);
      router.end(checkMsgTxt(' -0 -1 -2 -3 -4 -5 -6 -7 -8 -9 -10'+
        ' -11 -12 -13 -14 -15 -16 -17 -18 -19 -20'));

      router.handle(context, message);
    });

    it('it should break the chain in the no_next case', () => {
      const spy = sinon.spy();

      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], nextlessMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.end(spy);

      router.handle(context, message);

      spy.should.have.not.been.called;
    });

    it('it should break the chain in the no_message case', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], msglessMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.end(checkMsgUndefined);

      router.handle(context, message);
    });

    it('it should break the chain on error', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.end(checkMsgTxt(' -0 -1 -err'));

      router.handle(context, message);
    });
  });

  describe('errors middlewares', () => {
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
      router.end(checkMsgTxt(' -0 -1 -err -err catched 0'));

      router.handle(context, message);
    });

    it('it should catch thrown error once', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errThrowMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.end(checkMsgTxt(' -0 -1 -err -err catched 0'));

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
      router.end(checkMsgTxt(' -0 -1 -err -err catched 0 -err catched 1 -err catched 2' +
        ' -err catched 3 -err catched 4 -err catched 5 -err catched 6 -err catched 7'+
        ' -err catched 8 -err catched 9'));

      router.handle(context, message);
    });

    it('it should catch error without next', () => {
      const spy = sinon.spy();

      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.use(nextlessErrMiddleware);
      router.use(errMiddlewares[1]);
      router.end(spy);

      router.handle(context, message);

      spy.should.have.not.been.called;
    });

    it('it should catch error without msg', () => {
      router = new Router(ajvMatcher);
      router.use(middlewares[0]);
      router.use([middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(middlewares[3]);
      router.use(errMiddlewares[0]);
      router.use(msglessErrMiddleware);
      router.use(errMiddlewares[1]);
      router.end(checkMsgUndefinedErr);

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
      router.end(checkMsgTxt(' -0 -1 -err -err catched 0 -err dimmed -4 -5'));

      router.handle(context, message);
    });
  });

  describe('route with patterns', () => {
    beforeEach(() => {
      message = clone(initMessage);
      context = clone(initContext);
    });

    it('it should process message once', () => {
      router = new Router(ajvMatcher);
      router.use(patternBad, middlewares[0]);
      router.use(patternGood, middlewares[1]);
      router.end(checkMsgTxt(' -1'));

      router.handle(context, message);
    });

    it('it should process message with 1 step, 20 middlewares', () => {
      router = new Router(ajvMatcher);
      router.use(patternGood, middlewares.slice(0, 20), middlewares[20]);
      router.use(patternBad, middlewares.slice(0, 20), middlewares[20]);
      router.end(checkMsgTxt(' -0 -1 -2 -3 -4 -5 -6 -7 -8 -9 -10'+
        ' -11 -12 -13 -14 -15 -16 -17 -18 -19 -20'));

      router.handle(context, message);
    });

    it('it should break the chain in the no_message case', () => {
      router = new Router(ajvMatcher);
      router.use(patternGood, middlewares[0]);
      router.use(patternGood, [middlewares[1], msglessMiddleware, middlewares[2]]);
      router.use(patternGood, middlewares[3]);
      router.end(checkMsgUndefined);

      router.handle(context, message);
    });

    it('it should break the chain on error', () => {
      router = new Router(ajvMatcher);
      router.use(patternGood, middlewares[0]);
      router.use(patternGood, [middlewares[1], errMakeMiddleware, middlewares[2]]);
      router.use(patternGood, middlewares[3]);
      router.end(checkMsgTxt(' -0 -1 -err'));

      router.handle(context, message);
    });

    it('it should catch error once', () => {
      router = new Router(ajvMatcher);
      router.use(patternGood, middlewares[0]);
      router.use(patternGood, [middlewares[1], errThrowMiddleware, middlewares[2]]);
      router.use(patternGood, middlewares[3]);
      router.use(patternBad, errMiddlewares[0]);
      router.use(patternGood, errMiddlewares[1]);
      router.end(checkMsgTxt(' -0 -1 -err -err catched 1'));

      router.handle(context, message);
    });

    it('it should process messages separatedly', () => {
      router = new Router(ajvMatcher);
      router.use(patternBad, middlewares[0]);
      router.use(patternGood, middlewares[1]);
      router.use(patternAlt, middlewares[2]);
      router.use(patternBad, middlewares[3]);
      router.use(patternGood, middlewares[4]);
      router.use(patternAlt, middlewares[5]);
      router.use(patternBad, [middlewares[6], errThrowMiddleware, middlewares[9]]);
      router.use(patternGood, [middlewares[7], errThrowMiddleware, middlewares[10]]);
      router.use(patternAlt, [middlewares[8], errThrowMiddleware, middlewares[11]]);
      router.use(patternBad, errMiddlewares[0]);
      router.use(patternGood, errMiddlewares[1]);
      router.use(patternAlt, errMiddlewares[2]);
      router.end(checkMsgTxtSep(' -1 -4 -7 -err -err catched 1',
        ' -2 -5 -8 -err -err catched 2'));

      router.handle(context, message);
      router.handle(clone(initContext), clone(initMessageAlt));
    });

    it('it should process messages separatedly then together', () => {
      router = new Router(ajvMatcher);
      router.use(patternBad, middlewares[0]);
      router.use(patternGood, middlewares[1]);
      router.use(patternAlt, middlewares[2]);
      router.use(patternBad, middlewares[3]);
      router.use(patternGood, middlewares[4]);
      router.use(patternAlt, middlewares[5]);
      router.use({}, middlewares.slice(6, 9));
      router.end(checkMsgTxtSep(' -1 -4 -6 -7 -8', ' -2 -5 -6 -7 -8'));

      router.handle(context, message);
      router.handle(clone(initContext), clone(initMessageAlt));
    });
  });
});
